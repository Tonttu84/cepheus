import { expect, test } from "@playwright/test";
import { signInAsStaff } from "./helpers";

test.describe("Demo page: time advance, clinic warning, and reset", () => {
  test("advance two weeks, see the warning on /clinic, reset, see it gone", async ({
    page,
    context,
  }) => {
    // 1. Sign in as clinic nurse
    await signInAsStaff(page, context);

    // 2. Navigate to /demo and ensure we start in clean seeded state
    await page.goto("/demo");
    await expect(page.getByTestId("demo-controls-panel")).toBeVisible();

    const resetBtn = page.getByTestId("btn-reset-demo");
    await resetBtn.click();
    await expect(page.getByTestId("current-demo-offset")).toContainText("+0 days");

    // 3. Check clinic view before time advancement: no flags
    await page.goto("/clinic");
    await expect(page.getByTestId("no-flags")).toBeVisible();
    await expect(page.getByTestId("clinic-flag-card")).toHaveCount(0);

    // 4. Return to /demo and advance two weeks (+14 days)
    await page.goto("/demo");
    const advance2wBtn = page.getByTestId("btn-advance-2w");
    await advance2wBtn.click();

    // Verify offset updated to +14 days
    await expect(page.getByTestId("current-demo-offset")).toContainText("+14 days");

    // Verify P-SIM-001 line shows missed rounds and silence warning
    await expect(page.getByTestId("missed-rounds-P-SIM-001")).not.toContainText("Missed rounds: 0");
    await expect(page.getByTestId("patient-line-P-SIM-001")).toContainText("Clinic warning");

    // 5. Navigate to /clinic: care team now sees the raised flag for missed rounds
    await page.goto("/clinic");
    await expect(page.getByTestId("clinic-flag-card")).toHaveCount(1);
    await expect(page.getByTestId("clinic-flag-card").first()).toContainText("Check-in silence");

    // 6. Return to /demo and click Reset
    await page.goto("/demo");
    await page.getByTestId("btn-reset-demo").click();
    await expect(page.getByTestId("current-demo-offset")).toContainText("+0 days");
    await expect(page.getByTestId("missed-rounds-P-SIM-001")).toContainText("Missed rounds: 0");

    // 7. Check /clinic again: the warning is completely gone
    await page.goto("/clinic");
    await expect(page.getByTestId("no-flags")).toBeVisible();
    await expect(page.getByTestId("clinic-flag-card")).toHaveCount(0);
  });
});
