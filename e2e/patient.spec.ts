import { expect, test } from "@playwright/test";
import { signInAsPatient } from "./helpers";

test.describe("Patient page with storage", () => {
  test("sign in as a sample patient, choose I'll try this today, reload, choice is shown; switch a method off, reload, it is off", async ({
    page,
    context,
  }) => {
    // 1. Sign in as a sample patient and navigate to /patient
    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/patient");

    // 2. The suggestion card shows today's suggestion
    const card = page.getByTestId("patient-suggestion-card");
    await expect(card).toBeVisible();

    const acceptButton = page.getByTestId("patient-suggestion-accept");
    await expect(acceptButton).toBeVisible();

    // 3. Choose "I'll try this today"
    await acceptButton.click();
    const acceptedStatus = page.getByTestId("patient-suggestion-accepted-status");
    await expect(acceptedStatus).toBeVisible();
    await expect(acceptedStatus).toContainText("You've chosen to try this today");
    await expect(page.getByTestId("patient-suggestion-accept")).not.toBeVisible();
    await expect(page.getByTestId("patient-suggestion-skip")).not.toBeVisible();

    // 4. Reload: the choice is persisted and shown
    await page.reload();
    await expect(page.getByTestId("patient-suggestion-accepted-status")).toBeVisible();
    await expect(page.getByTestId("patient-suggestion-accept")).not.toBeVisible();
    await expect(page.getByTestId("patient-suggestion-skip")).not.toBeVisible();

    // 5. Switch a measuring method off (e.g. ring)
    const ringToggle = page.getByTestId("toggle-consent-ring");
    await expect(ringToggle).toBeVisible();
    await expect(ringToggle).toHaveText("Pause this method");
    await ringToggle.click();

    await expect(ringToggle).toHaveText("Enable this method");
    await expect(page.getByTestId("consent-status-ring")).toHaveText("Paused");

    // 6. Reload: the measuring method remains off
    await page.reload();
    const reloadedRingToggle = page.getByTestId("toggle-consent-ring");
    await expect(reloadedRingToggle).toBeVisible();
    await expect(reloadedRingToggle).toHaveText("Enable this method");
    await expect(page.getByTestId("consent-status-ring")).toHaveText("Paused");
  });

  test("sign in as a sample patient, decline suggestion with Not today, reload, choice is preserved", async ({
    page,
    context,
  }) => {
    // 1. Sign in as a sample patient and navigate to /patient
    await signInAsPatient(page, context, "P-SIM-DEP-01");
    await page.goto("/patient");

    // 2. The suggestion card shows a suggestion
    const card = page.getByTestId("patient-suggestion-card");
    await expect(card).toBeVisible();

    const skipButton = page.getByTestId("patient-suggestion-skip");
    await expect(skipButton).toBeVisible();

    // 3. Choose "Not today"
    await skipButton.click();
    const skippedStatus = page.getByTestId("patient-suggestion-skipped-status");
    await expect(skippedStatus).toBeVisible();
    await expect(skippedStatus).toContainText("Not today");
    await expect(page.getByTestId("patient-suggestion-skip")).not.toBeVisible();
    await expect(page.getByTestId("patient-suggestion-accept")).not.toBeVisible();

    // 4. Reload: the choice is persisted and shown
    await page.reload();
    await expect(page.getByTestId("patient-suggestion-skipped-status")).toBeVisible();
    await expect(page.getByTestId("patient-suggestion-skip")).not.toBeVisible();
    await expect(page.getByTestId("patient-suggestion-accept")).not.toBeVisible();
  });
});
