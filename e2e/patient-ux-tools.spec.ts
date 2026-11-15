import { expect } from "@playwright/test";
import { getPrisma } from "../src/lib/db";
import { signInAsPatient, test } from "./helpers";

test.describe("Package O: Word-Labelled Tap Pills & Guided Activity Tools", () => {
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
      await prisma.patientSuggestion.updateMany({
        where: { participantId: patient.id, isSimulated: true, status: { in: ["accepted", "completed"] } },
        data: { status: "shown", respondedAt: null },
      });
    }
  });

  test("1. /check-in renders tactile word labels with 0..4 aria labels and completes preview", async ({
    page,
  }) => {
    await signInAsPatient(page);
    await page.goto("/check-in");

    const moodBtn = page.getByRole("button", { name: "Mood: 2 of 4" });
    await expect(moodBtn).toContainText("Okay");
    await moodBtn.click();

    const interestBtn = page.getByRole("button", { name: "Interest: 3 of 4" });
    await expect(interestBtn).toContainText("Quite a bit");
    await interestBtn.click();

    const status = page.getByRole("status");
    await expect(status).toBeVisible();
    await expect(status).toContainText("simulated");
  });

  test("2. /patient opens guided walk timer and 3-min breathing circle when accepted", async ({
    page,
  }) => {
    await signInAsPatient(page);
    await page.goto("/patient");

    await page.getByTestId("patient-suggestion-accept").click();
    await expect(page.getByTestId("guided-activity-widget")).toBeVisible();

    await page.getByTestId("guided-mode-breathing").click();
    await expect(page.getByTestId("breathing-circle")).toContainText("03:00");

    await page.getByTestId("guided-start-pause").click();
    await expect(page.getByTestId("guided-start-pause")).toHaveText("Pause");

    await page.getByTestId("guided-done-btn").click();
    await expect(page.getByTestId("guided-activity-widget")).toContainText(
      "Pause complete"
    );

    const mainText = await page.locator("main").innerText();
    expect(mainText.toLowerCase()).not.toContain("streak");
  });
});
