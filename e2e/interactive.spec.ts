import { expect, test } from "@playwright/test";

test.describe("Interactive Redesign Fixes & Invariants", () => {
  test("1. /check-in handles scale tapping with accessible names, Not Today skip, and no saving claims", async ({
    page,
  }) => {
    await page.goto("/check-in");

    // Tap choice 2 in the first row ("Mood") reached by its accessible name
    const choice2 = page.getByRole("button", {
      name: "Mood: 2 of 4",
    });
    await choice2.click();
    await expect(choice2).toHaveAttribute("aria-pressed", "true");

    // Assert the other buttons in that row are not aria-pressed="true"
    for (const choice of [0, 1, 3, 4]) {
      const otherChoice = page.getByRole("button", {
        name: `Mood: ${choice} of 4`,
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

  test("4. / and /check-in show all crisis links in viewport at 375px, 640px, and 768px", async ({
    page,
  }) => {
    for (const width of [375, 640, 768]) {
      await page.setViewportSize({ width, height: 667 });

      for (const path of ["/", "/check-in"]) {
        await page.goto(path);
        const emergencyLink = page.getByTestId("crisis-link-112");
        const helplineLink = page.getByTestId("crisis-link-mieli");
        const clinicLink = page.getByTestId("crisis-link-clinic");

        for (const link of [emergencyLink, helplineLink, clinicLink]) {
          await expect(link).toBeVisible();
          await expect(link).toBeInViewport({ ratio: 1 });
        }
        await expect(emergencyLink).toHaveAttribute("href", "tel:112");
        await expect(helplineLink).toHaveAttribute("href", /^tel:/);
        await expect(clinicLink).toHaveAttribute("href", /^tel:/);
      }
    }
  });
});
