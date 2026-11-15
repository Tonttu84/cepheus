import { expect } from "@playwright/test";
import { signInAsPatient, signInAsStaff, test } from "./helpers";

test.describe("Interactive Redesign Fixes & Invariants", () => {
  test("1. /check-in handles scale tapping with accessible names, Not Today skip, and plain save explanation", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context);
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

    // Assert status message explains answers are saved, missed is never scored zero, and data is simulated
    const statusMessage = page.getByRole("status");
    await expect(statusMessage).toBeVisible();
    await expect(statusMessage).toContainText("The answers of this round are saved");
    await expect(statusMessage).toContainText("never scored as zero");
    await expect(statusMessage).toContainText("simulated");
  });

  test("2. /patient stores the choice, says so, and offers no second answer", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context);
    await page.goto("/patient");

    // The page is labelled as simulated data.
    await expect(page.getByTestId("simulated-badge").first()).toContainText("Simulated data");

    const acceptButton = page.getByTestId("patient-suggestion-accept");
    await acceptButton.click();

    // The choice is stored, so the message states it instead of calling itself a preview.
    const status = page.getByRole("status");
    await expect(status).toBeVisible();
    await expect(status).toContainText("You’ve chosen to try this today");
    await expect(status).not.toContainText("nothing is sent yet");

    // An answered suggestion has no buttons: one answer a day.
    await expect(page.getByTestId("patient-suggestion-accept")).toHaveCount(0);
    await expect(page.getByTestId("patient-suggestion-skip")).toHaveCount(0);
  });

  test("3. /clinic nurse call is stored and named on a flag labelled simulated", async ({
    page,
    context,
  }) => {
    await signInAsStaff(page, context, { ensureFlag: true });
    await page.goto("/clinic");

    const flagCard = page.getByTestId("clinic-flag-card").first();
    await expect(flagCard).toContainText("Simulated flag");

    const nurseCallButton = flagCard.getByTestId("clinic-action-nurse-call");
    await nurseCallButton.click();

    // The request is stored, so the message names who asked instead of calling itself a preview.
    const status = flagCard.getByTestId("nurse-call-status");
    await expect(status).toBeVisible();
    await expect(status).toHaveRole("status");
    await expect(status).toContainText("Nurse call requested by");

    // The booster offer is not a button on the card: it is an outcome a nurse records after the call.
    await expect(page.getByTestId("clinic-action-booster")).toHaveCount(0);
  });

  test("4. / and /check-in show all crisis links in viewport at 375px, 640px, and 768px", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context);
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
