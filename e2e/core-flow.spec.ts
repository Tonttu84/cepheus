import { expect, test } from "@playwright/test";
import { getPrisma } from "../src/lib/db";
import { signInAsPatient, signInAsStaff, signOutSession } from "./helpers";

test.describe("Core functional flow end to end", () => {
  test.beforeAll(async () => {
    const prisma = getPrisma();
    await prisma.clinicFlag.deleteMany({
      where: { clinicId: "sim-clinic-01", causeType: { not: null } },
    });
  });

  test.afterAll(async () => {
    const prisma = getPrisma();
    const patient = await prisma.participant.findFirst({
      where: { participantCode: "P-SIM-001" },
    });
    if (patient) {
      await prisma.checkInRound.deleteMany({
        where: { participantId: patient.id, roundNumber: { gt: 1 } },
      });
      await prisma.phq9Assessment.deleteMany({
        where: { participantId: patient.id },
      });
      await prisma.clinicFlag.deleteMany({
        where: { participantId: patient.id, causeType: { not: null } },
      });
    }
  });

  test("patient check-in on /check-in raises a flag, nurse sees it on /clinic, other clinic does not, and self-harm shows crisis path", async ({
    page,
    context,
  }) => {
    // 1. Before check-in: nurse sees no flags
    await signInAsStaff(page, context);
    await page.goto("/clinic");
    await expect(page.getByTestId("no-flags")).toBeVisible();
    await expect(page.getByTestId("clinic-flag-card")).toHaveCount(0);

    // 2. Simulated patient signs in and visits /check-in
    await signOutSession(context);
    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/check-in");

    // 3. Answer the twice-weekly taps
    const moodChoice = page.getByRole("button", { name: "Mood: 1 of 4" });
    const interestChoice = page.getByRole("button", { name: "Interest: 1 of 4" });
    await moodChoice.click();
    await interestChoice.click();
    await expect(moodChoice).toHaveAttribute("aria-pressed", "true");
    await expect(interestChoice).toHaveAttribute("aria-pressed", "true");

    // 4. Answer PHQ-9 items 1 through 8
    for (let item = 1; item <= 8; item++) {
      const option = page.getByRole("button", {
        name: `Question ${item}: 2 of 3`,
      });
      await option.click();
      await expect(option).toHaveAttribute("aria-pressed", "true");
    }

    // 5. Answer item 9 (self-harm) with choice 1 (> 0)
    const item9Choice = page.getByRole("button", {
      name: "Question 9: 1 of 3",
    });
    await item9Choice.click();

    // The crisis path is shown by the device at once
    const crisisPath = page.getByTestId("crisis-path");
    await expect(crisisPath).toBeVisible();
    await expect(crisisPath).toContainText("Direct connection to a person");
    await expect(crisisPath).toContainText("112");
    await expect(crisisPath).toContainText("09 2525 0111");

    // 6. Simulated nurse of the same clinic visits /clinic and sees the flag
    await signOutSession(context);
    await signInAsStaff(page, context);
    await page.goto("/clinic");

    const flagCard = page.getByTestId("clinic-flag-card");
    await expect(flagCard).toBeVisible();
    await expect(page.getByTestId("clinic-broad-area-check_in")).toBeVisible();

    // 7. Nurse of another clinic does not see this flag
    await signOutSession(context);
    await signInAsStaff(page, context, { otherClinic: true });
    await page.goto("/clinic");

    await expect(page.getByTestId("clinic-flag-card")).toHaveCount(0);
    await expect(page.getByTestId("no-flags")).toBeVisible();
  });
});
