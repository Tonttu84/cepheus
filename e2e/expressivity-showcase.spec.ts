import { expect, test } from "@playwright/test";
import { signInAsStaff } from "./helpers";

const LIMITS_SENTENCE =
  "This is not a reading of mood and not a judgement. No study shows that it warns of relapse. The clinician decides.";
const COST_SENTENCE =
  "Whether this is worth it is doubtful: it needs a camera in the home, and it adds privacy and data-security cost for an uncertain benefit. It is off by default.";

test.describe("Nurse flag card: Expressivity against own range showcase panel", () => {
  test("switch off: showcase panel is absent from nurse flag card", async ({
    page,
    context,
  }) => {
    await signInAsStaff(page, context, { ensureFlag: true });

    // Ensure the runtime switch is OFF
    const switchRes = await page.request.post("/api/demo/switch", {
      data: { key: "expressivityShowcase", enabled: false },
    });
    expect(switchRes.ok()).toBeTruthy();

    await page.goto("/clinic");

    const flagCard = page.getByTestId("clinic-flag-card").first();
    await expect(flagCard).toBeVisible();

    const showcasePanel = page.getByTestId("clinic-expressivity-showcase-panel");
    await expect(showcasePanel).toHaveCount(0);
  });

  test("switch on: showcase panel is present on nurse flag card with limits and cost sentences", async ({
    page,
    context,
  }) => {
    await signInAsStaff(page, context, { ensureFlag: true });

    // Enable the runtime switch
    const switchRes = await page.request.post("/api/demo/switch", {
      data: { key: "expressivityShowcase", enabled: true },
    });
    expect(switchRes.ok()).toBeTruthy();

    await page.goto("/clinic");

    const flagCard = page.getByTestId("clinic-flag-card").first();
    await expect(flagCard).toBeVisible();

    const showcasePanel = page.getByTestId("clinic-expressivity-showcase-panel").first();
    await expect(showcasePanel).toBeVisible();

    // Verify heading, limits sentence, and cost sentence
    await expect(showcasePanel).toContainText(
      "Facial movement, against this person's own usual range"
    );
    await expect(showcasePanel).toContainText(LIMITS_SENTENCE);
    await expect(showcasePanel).toContainText(COST_SENTENCE);
  });
});
