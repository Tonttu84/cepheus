import { expect, test } from "@playwright/test";
import { signInAsPatient, signInAsStaff } from "./helpers";

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

  test("rotating extra question appears on /check-in when switch is on and hides when switch is off", async ({
    page,
    context,
  }) => {
    // 1. Sign in as staff and ensure clean reset state with extra question switch OFF
    await signInAsStaff(page, context);
    await page.goto("/demo");
    await expect(page.getByTestId("demo-controls-panel")).toBeVisible();
    await page.getByTestId("btn-reset-demo").click();
    await expect(page.getByTestId("switch-status-extra")).toContainText("OFF");

    // 2. Visit /check-in as patient with switch OFF: extra question does NOT appear
    await signInAsPatient(page, context);
    await page.goto("/check-in");
    await expect(page.getByTestId("extra-question-section")).toHaveCount(0);

    // 3. Return to /demo as staff and toggle extra question switch ON
    await signInAsStaff(page, context);
    await page.goto("/demo");
    await page.getByTestId("switch-toggle-extra").click();
    await expect(page.getByTestId("switch-status-extra")).toContainText("ON");

    // 4. Visit /check-in as patient with switch ON: extra question appears after the two taps
    await signInAsPatient(page, context);
    await page.goto("/check-in");
    await expect(page.getByTestId("extra-question-section")).toBeVisible();

    // 5. Turn switch back OFF
    await signInAsStaff(page, context);
    await page.goto("/demo");
    await page.getByTestId("switch-toggle-extra").click();
    await expect(page.getByTestId("switch-status-extra")).toContainText("OFF");

    // 6. Visit /check-in: extra question does not appear
    await signInAsPatient(page, context);
    await page.goto("/check-in");
    await expect(page.getByTestId("extra-question-section")).toHaveCount(0);
  });

  test("advancing demo clock clears unfinished PHQ-9 and questionnaire starts from first question", async ({
    page,
    context,
  }) => {
    // 1. Sign in as staff and ensure clean reset state
    await signInAsStaff(page, context);
    await page.goto("/demo");
    await expect(page.getByTestId("demo-controls-panel")).toBeVisible();
    await page.getByTestId("btn-reset-demo").click();
    await expect(page.getByTestId("current-demo-offset")).toContainText("+0 days");

    // 2. Sign in as patient and open /check-in
    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/check-in");

    // Complete the two taps to unlock PHQ-9
    await page.getByRole("button", { name: "Mood: 3 of 4" }).click();
    await page.getByRole("button", { name: "Interest: 3 of 4" }).click();

    // Verify PHQ-9 section is visible
    const phq9Section = page.getByTestId("phq9-section");
    await expect(phq9Section).toBeVisible();

    // Answer two PHQ-9 questions (items 1 and 2)
    const q1Choice = page.getByRole("button", { name: "Question 1: 1 of 3" });
    await q1Choice.click();
    await expect(q1Choice).toHaveAttribute("aria-pressed", "true");

    const q2Choice = page.getByRole("button", { name: "Question 2: 2 of 3" });
    await q2Choice.click();
    await expect(q2Choice).toHaveAttribute("aria-pressed", "true");

    // 3. Advance two weeks via /demo as staff
    await signInAsStaff(page, context);
    await page.goto("/demo");
    await page.getByTestId("btn-advance-2w").click();
    await expect(page.getByTestId("current-demo-offset")).toContainText("+14 days");

    // 4. Open /check-in as patient: the questionnaire starts from its first question
    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/check-in");

    // Complete the two taps for the newly opened round
    await page.getByRole("button", { name: "Mood: 3 of 4" }).click();
    await page.getByRole("button", { name: "Interest: 3 of 4" }).click();

    await expect(page.getByTestId("phq9-section")).toBeVisible();
    await expect(page.getByRole("button", { name: "Question 1: 1 of 3" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: "Question 2: 2 of 3" })).toHaveAttribute("aria-pressed", "false");
  });
});
