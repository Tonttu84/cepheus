import { expect, test } from "@playwright/test";
import { resetPatientConsentForTest, signInAsPatient } from "./helpers";

test.describe("Patient consent screen on first sign-in and layered consent", () => {
  test("sign in, see the screen, agree to take part only, reach /check-in; then tick layer 3 on monitoring page and see it on", async ({
    page,
  }) => {
    // Ensure patient has not agreed to take part yet
    await resetPatientConsentForTest("P-SIM-001");

    // Sign in as simulated patient
    await signInAsPatient(page, "P-SIM-001");

    // Attempting to visit /check-in redirects to /consent
    await page.goto("/check-in");
    await page.waitForURL("**/consent");

    // 1. Verify consent screen elements
    await expect(page.getByTestId("consent-screen")).toBeVisible();
    await expect(page.getByTestId("consent-layer1-section")).toBeVisible();
    await expect(page.getByTestId("consent-layer2-section")).toBeVisible();
    await expect(page.getByTestId("consent-layer3-section")).toBeVisible();

    // Verify crisis path stays visible
    const crisisBar = page.getByTestId("crisis-help-bar");
    await expect(crisisBar).toBeVisible();
    await expect(crisisBar).toContainText("112");

    // Verify privacy link is present and accessible
    const privacyLink = page.getByTestId("privacy-link");
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute("href", "/privacy");

    // Verify optional checkboxes are all unticked by default
    const ringCheckbox = page.getByTestId("checkbox-layer2-ring");
    const cameraCheckbox = page.getByTestId("checkbox-layer2-camera");
    const homeCheckbox = page.getByTestId("checkbox-layer2-home");
    const detailedAnswersCheckbox = page.getByTestId("checkbox-layer3-detailed-answers");

    await expect(ringCheckbox).not.toBeChecked();
    await expect(cameraCheckbox).not.toBeChecked();
    await expect(homeCheckbox).not.toBeChecked();
    await expect(detailedAnswersCheckbox).not.toBeChecked();

    // 2. Agree to take part only (Layer 1 required button)
    const agreeButton = page.getByTestId("agree-taking-part-button");
    await expect(agreeButton).toContainText("I agree to take part");
    await agreeButton.click();

    // 3. Reach /check-in
    await page.waitForURL("**/check-in");
    await expect(page).toHaveURL(/\/check-in$/);

    // 4. Navigate to monitoring page to change consent later
    await page.goto("/monitoring");
    await page.waitForURL("**/monitoring");

    // Layer 3 switch is visible beside methods
    const layer3Card = page.getByTestId("consent-card-detailed_answers");
    await expect(layer3Card).toBeVisible();
    await expect(page.getByTestId("consent-status-detailed_answers")).toContainText("Paused");

    // 5. Tick / enable Layer 3 on the monitoring page
    const toggleLayer3 = page.getByTestId("toggle-consent-detailed_answers");
    await toggleLayer3.click();

    // 6. See Layer 3 switch on
    await expect(page.getByTestId("consent-status-detailed_answers")).toContainText("Allowed");
  });
});
