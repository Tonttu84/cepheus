import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const prepareScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "prepare-face-model.mjs"
);

// Configure fake Chromium media stream devices strictly for this camera spec
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  permissions: ["camera"],
});

/**
 * Injects a wrapper around navigator.mediaDevices.getUserMedia before page scripts execute.
 * Records all issued MediaStreams and MediaStreamTracks onto window so tests can inspect
 * their live readyState even if video.srcObject has been cleared to null.
 */
async function installMediaSpy(page: Page) {
  await page.addInitScript(() => {
    const win = window as unknown as {
      __recordedMediaStreams: MediaStream[];
      __recordedTracks: MediaStreamTrack[];
      __gumCallCount: number;
      __gumDelayMs: number;
    };

    win.__recordedMediaStreams = [];
    win.__recordedTracks = [];
    win.__gumCallCount = 0;
    win.__gumDelayMs = 0;

    const originalGUM = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices
    );

    navigator.mediaDevices.getUserMedia = async (...args) => {
      win.__gumCallCount++;
      if (win.__gumDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, win.__gumDelayMs));
      }
      const stream = await originalGUM(...args);
      win.__recordedMediaStreams.push(stream);
      for (const track of stream.getTracks()) {
        win.__recordedTracks.push(track);
      }
      return stream;
    };
  });
}

function getTrackStates(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const win = window as unknown as { __recordedTracks?: MediaStreamTrack[] };
    return (win.__recordedTracks ?? []).map((t) => t.readyState);
  });
}

function getGumCallCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const win = window as unknown as { __gumCallCount?: number };
    return win.__gumCallCount ?? 0;
  });
}

test.describe("Camera Wellbeing Check-in Flow & Safety Invariants", () => {
  // Model download, WASM compilation, and frame processing on CPU can take 1-2 minutes under machine load
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(() => {
    try {
      execFileSync(process.execPath, [prepareScriptPath], {
        timeout: 120_000,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      const error = err as {
        stderr?: string;
        stdout?: string;
        message?: string;
      };
      const failureDetails = (
        error.stderr ||
        error.stdout ||
        error.message ||
        ""
      ).trim();
      throw new Error(
        `Failed to prepare MediaPipe assets:\n${failureDetails}`
      );
    }
  });

  test("1. Camera is NOT opened before Start, explanation and crisis bar are visible, zero external requests", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const externalRequests: string[] = [];
    page.on("request", (req) => {
      try {
        const url = new URL(req.url());
        if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
          externalRequests.push(req.url());
        }
      } catch {
        // ignore data or internal urls
      }
    });

    await installMediaSpy(page);

    const response = await page.goto("/camera");
    expect(response?.status()).toBe(200);

    // Crisis bar must stay visible
    const crisisRegion = page.getByRole("region", {
      name: /Immediate support and emergency help/i,
    });
    await expect(crisisRegion).toBeVisible();
    await expect(crisisRegion).toContainText("112");
    await expect(crisisRegion).toContainText("09 2525 0111");

    // Simulated badge is present for dataset preview
    const badge = page.getByTestId("simulated-badge").first();
    await expect(badge).toBeVisible();

    // Plain explanation of what happens
    await expect(
      page.getByText(/movement of the face and head for about 20 seconds/i)
    ).toBeVisible();
    await expect(
      page.getByText(/video stays on this device.*is never recorded or saved/i)
    ).toBeVisible();
    await expect(
      page.getByText(/only two summary numbers measuring movement are kept/i)
    ).toBeVisible();

    // Large Start button is available
    const startButton = page.getByTestId("start-camera-button");
    await expect(startButton).toBeVisible();

    // Verify camera hardware was NOT requested before clicking Start via recorded spy
    const gumCallsBeforeStart = await getGumCallCount(page);
    expect(gumCallsBeforeStart).toBe(0);

    const trackStatesBeforeStart = await getTrackStates(page);
    expect(trackStatesBeforeStart).toEqual([]);

    // Video feed element must not be active
    const videoFeed = page.getByTestId("camera-video-feed");
    await expect(videoFeed).not.toBeVisible();

    // Zero external network requests
    expect(externalRequests).toEqual([]);
  });

  test("2. Stop button ends check-in at once and releases the camera", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const externalRequests: string[] = [];
    page.on("request", (req) => {
      try {
        const url = new URL(req.url());
        if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
          externalRequests.push(req.url());
        }
      } catch {
        // ignore
      }
    });

    await installMediaSpy(page);
    await page.goto("/camera");

    const startButton = page.getByTestId("start-camera-button");
    await startButton.click();

    // Wait for camera to be requested and a live track granted (allows generous time for WASM/model download and CPU compilation)
    await expect
      .poll(async () => getGumCallCount(page), { timeout: 90_000 })
      .toBeGreaterThan(0);

    await expect
      .poll(
        async () => {
          const states = await getTrackStates(page);
          return states.length > 0 && states.includes("live");
        },
        { timeout: 90_000 }
      )
      .toBe(true);

    // Video feed and stop button should be visible in active recording state
    const videoFeed = page.getByTestId("camera-video-feed");
    await expect(videoFeed).toBeVisible({ timeout: 30_000 });

    const stopButton = page.getByTestId("stop-camera-button");
    await expect(stopButton).toBeVisible({ timeout: 30_000 });

    // Click Stop button
    await stopButton.click();

    // Stopped state message appears
    await expect(page.getByText(/check-in stopped/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText(/camera was released immediately/i)
    ).toBeVisible({ timeout: 30_000 });

    // Assert that every recorded track has readyState === "ended"
    await expect
      .poll(
        async () => {
          const states = await getTrackStates(page);
          return states.length > 0 && states.every((s) => s === "ended");
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    // Zero external network requests
    expect(externalRequests).toEqual([]);
  });

  test("3. Fake camera produces no face detection; ends in 'no face found' state and releases the camera", async ({
    page,
  }) => {
    // Two full session start/run cycles in this test requires a generous deadline
    test.setTimeout(240_000);

    const externalRequests: string[] = [];
    page.on("request", (req) => {
      try {
        const url = new URL(req.url());
        if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
          externalRequests.push(req.url());
        }
      } catch {
        // ignore
      }
    });

    await installMediaSpy(page);

    // Use a 3000ms duration for automated testing to complete within CI limits
    await page.goto("/camera?durationMs=3000");

    const startButton = page.getByTestId("start-camera-button");
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Wait for camera request and live track
    await expect
      .poll(async () => getGumCallCount(page), { timeout: 90_000 })
      .toBeGreaterThan(0);

    // Progress indicator is visible while running
    await expect(page.getByRole("progressbar")).toBeVisible({ timeout: 60_000 });

    // With Chromium fake camera device, no real face exists.
    // The session finishes and surfaces the no-face-found state
    const noFaceState = page.getByTestId("no-face-found-state");
    await expect(noFaceState).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByText(/no face detected for most of the check-in/i)
    ).toBeVisible({ timeout: 30_000 });

    // Assert that every recorded track has readyState === "ended" after session ends by itself
    await expect
      .poll(
        async () => {
          const states = await getTrackStates(page);
          return states.length > 0 && states.every((s) => s === "ended");
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    // A clear way forward: "Try again" button
    const tryAgainButton = page.getByTestId("try-again-button");
    await expect(tryAgainButton).toBeVisible({ timeout: 30_000 });

    const gumCallsBeforeRetry = await getGumCallCount(page);

    // Clicking "Try again" restarts the flow
    await tryAgainButton.click();

    // Wait for next getUserMedia call and running progressbar
    await expect
      .poll(async () => getGumCallCount(page), { timeout: 60_000 })
      .toBeGreaterThan(gumCallsBeforeRetry);

    await expect(page.getByRole("progressbar")).toBeVisible({ timeout: 60_000 });

    // Cleanly stop
    const stopButton = page.getByTestId("stop-camera-button");
    await expect(stopButton).toBeVisible({ timeout: 30_000 });
    await stopButton.click();

    // Assert that all recorded tracks have readyState === "ended"
    await expect
      .poll(
        async () => {
          const states = await getTrackStates(page);
          return states.length > 0 && states.every((s) => s === "ended");
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    // Zero external network requests during entire run
    expect(externalRequests).toEqual([]);
  });

  test("4. Navigating away mid-session releases the camera", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await installMediaSpy(page);
    await page.goto("/camera");

    const startButton = page.getByTestId("start-camera-button");
    await startButton.click();

    // Wait until camera is requested and tracks are live
    await expect
      .poll(async () => getGumCallCount(page), { timeout: 90_000 })
      .toBeGreaterThan(0);

    await expect
      .poll(
        async () => {
          const states = await getTrackStates(page);
          return states.length > 0 && states.includes("live");
        },
        { timeout: 90_000 }
      )
      .toBe(true);

    // Video feed is visible in recording state
    const videoFeed = page.getByTestId("camera-video-feed");
    await expect(videoFeed).toBeVisible({ timeout: 30_000 });

    // Navigate away mid-session via client-side link (unmounts camera session component)
    await page.getByTestId("nav-check-in").click();
    await expect(page).toHaveURL(/\/check-in/, { timeout: 30_000 });

    // Assert that every recorded track has readyState === "ended" after navigating away
    await expect
      .poll(
        async () => {
          const states = await getTrackStates(page);
          return states.length > 0 && states.every((s) => s === "ended");
        },
        { timeout: 30_000 }
      )
      .toBe(true);
  });

  test("5. Navigating away while getUserMedia is pending releases camera as soon as stream resolves", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await installMediaSpy(page);
    await page.goto("/camera");

    // Introduce delay into getUserMedia to ensure it remains pending during navigation
    await page.evaluate(() => {
      const win = window as unknown as { __gumDelayMs: number };
      win.__gumDelayMs = 2000;
    });

    const startButton = page.getByTestId("start-camera-button");
    await startButton.click();

    // Wait until model loading completes and camera requesting is actively pending
    await expect(
      page.getByText(/Opening camera on this device/i)
    ).toBeVisible({ timeout: 90_000 });

    await expect
      .poll(async () => getGumCallCount(page), { timeout: 30_000 })
      .toBeGreaterThan(0);

    // Leave the page while getUserMedia is still pending
    await page.getByTestId("nav-check-in").click();
    await expect(page).toHaveURL(/\/check-in/, { timeout: 30_000 });

    // Wait for getUserMedia to resolve and assert all tracks are ended immediately upon arrival
    await expect
      .poll(
        async () => {
          const states = await getTrackStates(page);
          return states.length > 0 && states.every((s) => s === "ended");
        },
        { timeout: 30_000 }
      )
      .toBe(true);
  });

  test("6. Pressing Stop/Cancel while getUserMedia is pending releases camera as soon as stream resolves", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await installMediaSpy(page);
    await page.goto("/camera");

    // Introduce delay into getUserMedia to ensure it remains pending during cancellation
    await page.evaluate(() => {
      const win = window as unknown as { __gumDelayMs: number };
      win.__gumDelayMs = 2000;
    });

    const startButton = page.getByTestId("start-camera-button");
    await startButton.click();

    // Wait until model loading completes and camera requesting is actively pending
    await expect(
      page.getByText(/Opening camera on this device/i)
    ).toBeVisible({ timeout: 90_000 });

    await expect
      .poll(async () => getGumCallCount(page), { timeout: 30_000 })
      .toBeGreaterThan(0);

    // Cancel while getUserMedia is pending
    const cancelButton = page.getByRole("button", { name: /cancel/i });
    await expect(cancelButton).toBeVisible({ timeout: 30_000 });
    await cancelButton.click();

    // Wait for getUserMedia to resolve and assert all tracks are ended immediately
    await expect
      .poll(
        async () => {
          const states = await getTrackStates(page);
          return states.length > 0 && states.every((s) => s === "ended");
        },
        { timeout: 30_000 }
      )
      .toBe(true);
  });
});
