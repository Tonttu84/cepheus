import { expect, test } from "@playwright/test";

test.describe("Interactive Redesign Fixes & Invariants", () => {
  test("1. /check-in handles scale tapping with accessible names, Not Today skip, and no saving claims", async ({
    page,
  }) => {
    await page.goto("/check-in");

    // Tap choice 3 in the first row ("Overall mood") reached by its accessible name
    const choice3 = page.getByRole("button", {
      name: "Overall mood: 3 of 5",
    });
    await choice3.click();
    await expect(choice3).toHaveAttribute("aria-pressed", "true");

    // Assert the other buttons in that row are not aria-pressed="true"
    for (const choice of [1, 2, 4, 5]) {
      const otherChoice = page.getByRole("button", {
        name: `Overall mood: ${choice} of 5`,
      });
      await expect(otherChoice).not.toHaveAttribute("aria-pressed", "true");
    }

    // Tap "Not today"
    const notTodayButton = page.getByTestId("not-today-button");
    await notTodayButton.click();

    // Assert preview status message appears and contains "simulated"
    const statusMessage = page.getByRole("status");
    await expect(statusMessage).toBeVisible();
    await expect(statusMessage).toContainText("simulated");

    // Assert page contains none of the words "saved", "recorded", "queued"
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.toLowerCase()).not.toContain("saved");
    expect(bodyText.toLowerCase()).not.toContain("recorded");
    expect(bodyText.toLowerCase()).not.toContain("queued");
  });

  test("2. /patient action buttons show simulated status message", async ({
    page,
  }) => {
    await page.goto("/patient");

    const acceptButton = page.getByTestId("patient-suggestion-accept");
    await acceptButton.click();
    const status = page.getByRole("status");
    await expect(status).toBeVisible();
    await expect(status).toContainText("simulated");

    const skipButton = page.getByTestId("patient-suggestion-skip");
    await skipButton.click();
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("simulated");
  });

  test("3. /clinic action buttons show simulated status message", async ({
    page,
  }) => {
    await page.goto("/clinic");

    const nurseCallButton = page.getByTestId("clinic-action-nurse-call");
    await nurseCallButton.click();
    const status = page.getByRole("status");
    await expect(status).toBeVisible();
    await expect(status).toContainText("simulated");

    const boosterButton = page.getByTestId("clinic-action-booster");
    await boosterButton.click();
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("simulated");
  });

  test("4. / and /check-in show both crisis links at 375px phone viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    for (const path of ["/", "/check-in"]) {
      await page.goto(path);
      const emergencyLink = page.getByTestId("crisis-link-112");
      const helplineLink = page.getByTestId("crisis-link-mieli");

      await expect(emergencyLink).toBeVisible();
      await expect(emergencyLink).toBeInViewport({ ratio: 1 });
      await expect(helplineLink).toBeVisible();
      await expect(helplineLink).toBeInViewport({ ratio: 1 });
      await expect(emergencyLink).toHaveAttribute("href", "tel:112");
      await expect(helplineLink).toHaveAttribute("href", /^tel:/);
    }
  });
});
