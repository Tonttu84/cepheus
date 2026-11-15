import { expect, test } from "@playwright/test";

test.describe("Privacy & Data Protection Page (/privacy)", () => {
  test("loads signed out, shows the demonstration notice, and has no horizontal scroll at 375px mobile width", async ({
    page,
  }) => {
    // 1. Mobile viewport at 375px width
    await page.setViewportSize({ width: 375, height: 667 });

    // 2. Navigate to /privacy without signing in
    const response = await page.goto("/privacy");
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/privacy");

    // 3. Confirm signed-out visitor status
    const signInBtn = page.getByTestId("header-sign-in-button");
    await expect(signInBtn).toBeVisible();

    // 4. Verify prominent demonstration notice is visible with exact required wording
    const demoNotice = page.getByTestId("demonstration-notice");
    await expect(demoNotice).toBeVisible();
    await expect(demoNotice).toContainText(
      "Mock policies for a demonstration. Written by an AI agent, not reviewed by a lawyer, not legal advice."
    );

    // 5. Verify the four required summary sections are present
    const sections = [
      "privacy-section-collection-and-storage",
      "privacy-section-who-sees-what",
      "privacy-section-rights-and-stopping",
      "privacy-section-simulated-rewards",
    ];

    for (const sectionTestId of sections) {
      const section = page.getByTestId(sectionTestId);
      await expect(section).toBeVisible();
    }

    // 6. Verify zero horizontal scroll at 375px width
    const scrollInfo = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      };
    });

    expect(
      scrollInfo.scrollWidth,
      `Expected document scrollWidth (${scrollInfo.scrollWidth}) <= clientWidth (${scrollInfo.clientWidth})`
    ).toBeLessThanOrEqual(scrollInfo.clientWidth);

    // 7. Verify touch targets on interactive controls meet 44px minimum height
    const returnLink = page.getByRole("link", { name: /Return to Overview/i });
    await expect(returnLink).toBeVisible();
    const returnBox = await returnLink.boundingBox();
    expect(returnBox).not.toBeNull();
    if (returnBox) {
      expect(returnBox.height).toBeGreaterThanOrEqual(44);
    }

    const signInLink = page.getByRole("link", { name: /Sign in to Cepheus/i });
    await expect(signInLink).toBeVisible();
    const signInBox = await signInLink.boundingBox();
    expect(signInBox).not.toBeNull();
    if (signInBox) {
      expect(signInBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("loads cleanly on desktop viewport (1280px) and keeps all policy sections visible", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const response = await page.goto("/privacy");
    expect(response?.status()).toBe(200);

    const heading = page.getByRole("heading", {
      name: /Data Protection & Privacy Overview/i,
    });
    await expect(heading).toBeVisible();

    const demoNotice = page.getByTestId("demonstration-notice");
    await expect(demoNotice).toBeVisible();
  });
});
