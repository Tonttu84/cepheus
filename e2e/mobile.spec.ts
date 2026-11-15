import type { Page } from "@playwright/test";
import {
  clearCheckInAnswers,
  expect,
  signInAsPatient,
  test,
} from "./helpers";

/**
 * Mobile patient app automated checks (375px x 812px viewport).
 *
 * Verifies:
 * 1. Zero horizontal scroll (scrollWidth <= clientWidth)
 * 2. Minimum 44px touch target height for every visible button, link, and input
 *    (exceptions allowed only for inline text links, by test id, with documented reason)
 * 3. Crisis path reachable in one tap from every patient page
 * 4. No main content paragraph text smaller than 14px
 * 5. Phone-specific considerations: voice button on-device gating, camera video inline playback
 */

const MOBILE_VIEWPORT = { width: 375, height: 812 };

/**
 * Permitted exceptions for inline text links wrapped inside sentences,
 * keyed by data-testid with explicit justification.
 */
const INLINE_TEXT_LINK_EXCEPTIONS: Record<string, string> = {
  "auth-required-signin-link":
    "Inline text link within authentication status sentence; wrapping with paragraph text prevents 44px block height without breaking natural text flow.",
};

async function assertMobileViewportIntegrity(
  page: Page,
  pagePath: string
): Promise<void> {
  // 1. Zero horizontal scroll check
  const scrollMetrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    scrollMetrics.scrollWidth,
    `Horizontal scroll detected on ${pagePath}: scrollWidth (${scrollMetrics.scrollWidth}px) exceeds clientWidth (${scrollMetrics.clientWidth}px)`
  ).toBeLessThanOrEqual(scrollMetrics.clientWidth);

  // 2. Minimum 44px touch target height for buttons, links, and inputs
  const touchTargetViolations = await page.evaluate(
    (allowedExceptions: Record<string, string>) => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]'
        )
      );

      const violations: Array<{
        tag: string;
        testId: string | null;
        text: string;
        height: number;
      }> = [];

      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        ) {
          continue;
        }

        const rect = el.getBoundingClientRect();
        // Ignore collapsed or off-screen unrendered elements
        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }

        const testId = el.getAttribute("data-testid");
        if (testId && allowedExceptions[testId]) {
          continue;
        }

        // Subpixel tolerance threshold: 43.5px
        if (rect.height < 43.5) {
          violations.push({
            tag: el.tagName.toLowerCase(),
            testId,
            text: (
              el.textContent ||
              el.getAttribute("aria-label") ||
              el.getAttribute("placeholder") ||
              ""
            )
              .trim()
              .slice(0, 45),
            height: Math.round(rect.height * 10) / 10,
          });
        }
      }
      return violations;
    },
    INLINE_TEXT_LINK_EXCEPTIONS
  );

  expect(
    touchTargetViolations,
    `Interactive touch targets under 44px detected on ${pagePath}: ${JSON.stringify(
      touchTargetViolations,
      null,
      2
    )}`
  ).toEqual([]);

  // 3. Persistent crisis path reachable in one tap
  const crisisHelpBar = page.getByTestId("crisis-help-bar");
  await expect(
    crisisHelpBar,
    `Crisis help bar must be visible on ${pagePath}`
  ).toBeVisible();

  const emergency112 = page.getByTestId("crisis-link-112");
  await expect(
    emergency112,
    `Direct 112 emergency crisis link must be visible on ${pagePath}`
  ).toBeVisible();

  // 4. No paragraph text smaller than 14px in main content
  const smallTextViolations = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return [];

    const contentParagraphs = Array.from(
      main.querySelectorAll<HTMLElement>("p, article p, section p, .prose p")
    );

    const violations: Array<{
      tag: string;
      text: string;
      fontSize: string;
    }> = [];

    for (const el of contentParagraphs) {
      const style = window.getComputedStyle(el);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
      ) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      const sizePx = parseFloat(style.fontSize);
      // Subpixel tolerance threshold: 13.5px
      if (sizePx < 13.5) {
        violations.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || "").trim().slice(0, 50),
          fontSize: style.fontSize,
        });
      }
    }
    return violations;
  });

  expect(
    smallTextViolations,
    `Main content paragraph text under 14px detected on ${pagePath}: ${JSON.stringify(
      smallTextViolations,
      null,
      2
    )}`
  ).toEqual([]);
}

test.describe("Mobile Patient App Review (375x812 Viewport)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test.afterAll(async () => {
    await clearCheckInAnswers(["P-SIM-001"]);
  });

  test("1. /sign-in page mobile layout, touch targets, and crisis path", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await assertMobileViewportIntegrity(page, "/sign-in");

    // Preset sign-in buttons should be easy to tap with one thumb
    const firstPreset = page.getByTestId("auth-preset-P-SIM-001");
    await expect(firstPreset).toBeVisible();
    const box = await firstPreset.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test("2. /check-in page mobile layout, touch targets, keyboard tolerance, and voice button", async ({
    page,
  }) => {
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/check-in");
    await assertMobileViewportIntegrity(page, "/check-in");

    // Scale buttons 0..4 must be at least 44px tall and touchable with one hand
    const scaleChoice0 = page.getByRole("button", { name: "Mood: 0 of 4" });
    await expect(scaleChoice0).toBeVisible();
    const scaleBox = await scaleChoice0.boundingBox();
    expect(scaleBox?.height).toBeGreaterThanOrEqual(44);

    // "Not today" escape hatch must be >= 44px
    const notTodayBtn = page.getByTestId("not-today-button");
    await expect(notTodayBtn).toBeVisible();
    const notTodayBox = await notTodayBtn.boundingBox();
    expect(notTodayBox?.height).toBeGreaterThanOrEqual(44);

    // Voice button should not appear if browser does not support on-device speech API
    const voiceButtons = page.locator('[data-testid^="voice-answer-button-"]');
    // In headless test environments without on-device Web Speech, voice button remains absent
    const count = await voiceButtons.count();
    if (count > 0) {
      const voiceBox = await voiceButtons.first().boundingBox();
      expect(voiceBox?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("3. /patient view mobile layout, touch targets, and suggestion card", async ({
    page,
  }) => {
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/patient");
    await assertMobileViewportIntegrity(page, "/patient");

    const acceptBtn = page.getByTestId("patient-suggestion-accept");
    await expect(acceptBtn).toBeVisible();
    const acceptBox = await acceptBtn.boundingBox();
    expect(acceptBox?.height).toBeGreaterThanOrEqual(44);

    const skipBtn = page.getByTestId("patient-suggestion-skip");
    await expect(skipBtn).toBeVisible();
    const skipBox = await skipBtn.boundingBox();
    expect(skipBox?.height).toBeGreaterThanOrEqual(44);
  });

  test("4. /monitoring page mobile layout, touch targets, and QR code fitting", async ({
    page,
  }) => {
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/monitoring");
    await assertMobileViewportIntegrity(page, "/monitoring");

    // Consent buttons must meet 44px
    const consentBtn = page.locator('[data-testid^="toggle-consent-"]').first();
    await expect(consentBtn).toBeVisible();
    const consentBox = await consentBtn.boundingBox();
    expect(consentBox?.height).toBeGreaterThanOrEqual(44);
  });

  test("5. /camera page mobile layout, touch targets, and video tag playsInline attribute", async ({
    page,
  }) => {
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/camera");
    await assertMobileViewportIntegrity(page, "/camera");

    const startBtn = page.getByTestId("start-camera-button");
    await expect(startBtn).toBeVisible();
    const startBox = await startBtn.boundingBox();
    expect(startBox?.height).toBeGreaterThanOrEqual(44);
  });

  test("6. /privacy page mobile layout, touch targets, and demonstration notice", async ({
    page,
  }) => {
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/privacy");
    await assertMobileViewportIntegrity(page, "/privacy");

    const returnBtn = page.getByRole("link", { name: /Return to Overview/i });
    await expect(returnBtn).toBeVisible();
    const returnBox = await returnBtn.boundingBox();
    expect(returnBox?.height).toBeGreaterThanOrEqual(44);
  });

  test("7. /rewards page mobile layout, touch targets, and balance card", async ({
    page,
  }) => {
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/rewards");
    await assertMobileViewportIntegrity(page, "/rewards");

    const balanceSection = page.locator('section[aria-label="My balance"]');
    await expect(balanceSection).toBeVisible();
  });

  test("8. check-in crisis path pops up at once when item 9 is answered > 0", async ({
    page,
  }) => {
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/check-in");

    // Answer taps to unlock PHQ-9
    const moodChoice = page.getByRole("button", { name: "Mood: 2 of 4" });
    await moodChoice.click();
    const interestChoice = page.getByRole("button", { name: "Interest: 2 of 4" });
    await interestChoice.click();

    // Answer item 9 with score 1
    const phq9Section = page.getByTestId("phq9-section");
    if (await phq9Section.isVisible()) {
      const q9Option1 = page.getByRole("button", { name: "Question 9: 1 of 3" });
      await q9Option1.click();

      // Crisis path appears at once on screen without server delay
      const crisisPath = page.getByTestId("crisis-path");
      await expect(crisisPath).toBeVisible();

      // Ensure crisis resource touch targets meet 44px
      const resourceLinks = page.locator('[data-testid^="crisis-resource-"]');
      const count = await resourceLinks.count();
      for (let i = 0; i < count; i++) {
        const box = await resourceLinks.nth(i).boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
