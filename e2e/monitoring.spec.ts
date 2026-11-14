import { expect, test } from "@playwright/test";

test.describe("Home Sensors Monitoring & Security Boundaries (/monitoring)", () => {
  test("1. /monitoring loads with security headers, crisis bar, simulated badge, and consent toggles", async ({
    page,
  }) => {
    const response = await page.goto("/monitoring");
    expect(response?.status()).toBe(200);

    const headers = response?.headers() ?? {};
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");

    const crisisRegion = page.getByRole("region", {
      name: /Immediate support and emergency help/i,
    });
    await expect(crisisRegion).toBeVisible();
    await expect(crisisRegion).toContainText("112");

    await expect(page.getByTestId("simulated-badge").first()).toBeVisible();
    await expect(page.getByTestId("consent-card-ring_rhythm")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("consent-card-camera_expressivity")).toBeVisible();
    await expect(page.getByTestId("consent-card-home_routine")).toBeVisible();
  });

  test("2. Simulated Fitbit sync and Arduino UNO Q push compute rhythm metrics and store derived numbers", async ({
    page,
  }) => {
    await page.goto("/monitoring");

    await page.getByTestId("fitbit-sync-simulated").click();
    await expect(page.getByTestId("monitoring-feedback")).toContainText(
      "simulated Fitbit days"
    );
    await expect(page.getByText("Relative Amplitude")).toBeVisible();
    await expect(page.getByText("Sleep Reg. (SRI)")).toBeVisible();

    await page.getByTestId("health-connect-simulate").click();
    await expect(page.getByTestId("monitoring-feedback")).toContainText(
      "simulated Health Connect days"
    );

    await page.getByTestId("arduino-simulate-push").click();
    await expect(page.getByTestId("monitoring-feedback")).toContainText(
      "0 bytes video"
    );
    await expect(page.getByTestId("arduino-light-cue")).toContainText(
      "Suggested"
    );
    await expect(page.getByText("home_immobility_bouts").first()).toBeVisible();

    await page.getByTestId("arduino-simulate-voice").click();
    await expect(page.getByTestId("monitoring-feedback")).toContainText(
      "0 bytes audio stored"
    );
  });

  test("3. Security API boundaries reject raw media payloads and cross-origin POSTs", async ({
    request,
  }) => {
    const rawMediaRes = await request.post("/api/arduino/ingest", {
      data: {
        deviceId: "unoq-bad",
        date: "2026-11-14",
        isSimulated: true,
        camera: {
          durationSec: 20,
          effectiveFps: 15,
          faceDetectedRatio: 0.9,
          expressivityScore: 0.05,
          angularPathDegPerMin: 100,
          imageBase64: "data:image/jpeg;base64,/9j/4AAQ",
        },
      },
    });
    expect(rawMediaRes.status()).toBe(400);
    const rawJson = await rawMediaRes.json();
    expect(rawJson.error).toMatch(/raw media field/i);

    const crossOriginSync = await request.post("/api/fitbit/sync", {
      headers: {
        origin: "https://attacker.example.com",
      },
      data: { mode: "simulated" },
    });
    expect(crossOriginSync.status()).toBe(403);

    const missingAuthWebhook = await request.post("/api/webhooks/health-connect", {
      data: { test: true },
    });
    expect(missingAuthWebhook.status()).toBe(401);

    const badSigWebhook = await request.post("/api/webhooks/health-connect", {
      headers: {
        "x-signature": "sha256=0000000000000000000000000000000000000000000000000000000000000000",
      },
      data: { test: true },
    });
    expect(badSigWebhook.status()).toBe(401);

    const staffRes = await request.get("/api/monitoring/summary?viewer=staff");
    expect(staffRes.status()).toBe(200);
    const staffJson = await staffRes.json();
    expect(staffJson.demoOnly).toBe(true);
    expect(staffJson.summary.readingsRedactedForStaff).toBe(true);
    expect(staffJson.summary.recentWearableDays).toEqual([]);
    expect(staffJson.summary.recentCameraReadings).toEqual([]);
  });

  test("4. End-user Health Connect QR pairing provisions credentials, verifies phone test ping, and revokes cleanly", async ({
    page,
    request,
  }) => {
    await page.goto("/monitoring");

    await expect(page.getByTestId("hc-pair-button")).toBeVisible();
    await page.getByTestId("hc-pair-button").click();

    await expect(page.getByTestId("hc-pairing-card")).toBeVisible();
    await expect(page.getByTestId("hc-pairing-qr")).toBeVisible();

    const ldHref = await page
      .getByTestId("hc-lifedashboard-link")
      .getAttribute("href");
    expect(ldHref).toMatch(/^lifedashboard:\/\/pair#v=1&url=/);

    const webhookUrl = (
      await page.getByTestId("hc-webhook-url").textContent()
    )?.trim();
    const apiKeyHeaderLine = (
      await page.getByTestId("hc-webhook-apikey-header").textContent()
    )?.trim();
    expect(webhookUrl).toBeTruthy();
    expect(apiKeyHeaderLine).toMatch(/^X-API-Key:\s+\S+/);
    const apiKey = apiKeyHeaderLine!.replace(/^X-API-Key:\s+/, "");

    const pingRes = await request.post(webhookUrl!, {
      headers: { "x-api-key": apiKey },
      data: { test: true, source: "health_connect" },
    });
    expect(pingRes.status()).toBe(204);

    await page.getByTestId("hc-refresh-status").click();
    await expect(page.getByTestId("hc-status-badge")).toContainText(
      "Phone verified"
    );

    await page.getByTestId("hc-disconnect-button").click();
    await expect(page.getByTestId("hc-status-badge")).not.toContainText(
      "Phone verified"
    );

    const revokedRes = await request.post(webhookUrl!, {
      headers: { "x-api-key": apiKey },
      data: { test: true },
    });
    expect(revokedRes.status()).toBe(401);
  });
});
