import { expect, test } from "@playwright/test";
import { signInAsPatient, signOutSession } from "./helpers";

test.describe("Check-in screen: GAD-7, typing answers, and on-device voice gating", () => {
  test("1. completes a check-in by typing (taps and questionnaire items)", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/check-in");

    // Answer Mood tap by typing
    const moodInput = page.getByTestId("type-input-moodScore");
    await expect(moodInput).toBeVisible();
    await moodInput.fill("good");
    await page.getByTestId("type-submit-moodScore").click();

    const moodChoice3 = page.getByRole("button", { name: "Mood: 3 of 4" });
    await expect(moodChoice3).toHaveAttribute("aria-pressed", "true");

    // Answer Interest tap by typing
    const interestInput = page.getByTestId("type-input-interestScore");
    await expect(interestInput).toBeVisible();
    await interestInput.fill("2");
    await page.getByTestId("type-submit-interestScore").click();

    const interestChoice2 = page.getByRole("button", { name: "Interest: 2 of 4" });
    await expect(interestChoice2).toHaveAttribute("aria-pressed", "true");

    // Answer PHQ-9 items 1 through 8 by typing
    for (let item = 1; item <= 8; item++) {
      const phqInput = page.getByTestId(`type-input-${item}`);
      await expect(phqInput).toBeVisible();
      await phqInput.fill("0");
      await page.getByTestId(`type-submit-${item}`).click();

      const option0 = page.getByRole("button", {
        name: `Question ${item}: 0 of 3`,
      });
      await expect(option0).toHaveAttribute("aria-pressed", "true");
    }

    // Answer item 9 with 0
    const phq9Input = page.getByTestId("type-input-9");
    await phq9Input.fill("not at all");
    await page.getByTestId("type-submit-9").click();

    const option9_0 = page.getByRole("button", {
      name: "Question 9: 0 of 3",
    });
    await expect(option9_0).toHaveAttribute("aria-pressed", "true");

    // Crisis path should NOT be visible when question 9 answered 0
    await expect(page.getByTestId("crisis-path")).toHaveCount(0);
  });

  test("2. answers item 9 by typing and sees the crisis path immediately", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/check-in");

    // Answer taps
    const moodInput = page.getByTestId("type-input-moodScore");
    await moodInput.fill("2");
    await page.getByTestId("type-submit-moodScore").click();

    const interestInput = page.getByTestId("type-input-interestScore");
    await interestInput.fill("2");
    await page.getByTestId("type-submit-interestScore").click();

    // Answer PHQ-9 item 9 with score 1 by typing
    const item9Input = page.getByTestId("type-input-9");
    await expect(item9Input).toBeVisible();
    await item9Input.fill("several days");
    await page.getByTestId("type-submit-9").click();

    // The crisis path is shown at once on the screen without waiting for server
    const crisisPath = page.getByTestId("crisis-path");
    await expect(crisisPath).toBeVisible();
    await expect(crisisPath).toContainText("Direct connection to a person");
    await expect(crisisPath).toContainText("112");
  });

  test("3. shows no voice button when on-device recognition is missing", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/check-in");

    // In default browser test environment without on-device Web Speech API confirmation,
    // the voice answer button is not rendered at all.
    const voiceButtons = page.locator('[data-testid^="voice-answer-button"]');
    await expect(voiceButtons).toHaveCount(0);

    // Text typing inputs remain available for everyone
    await expect(page.getByTestId("type-input-moodScore")).toBeVisible();
    await expect(page.getByTestId("type-input-interestScore")).toBeVisible();
  });

  test("4. check with both kinds of sample patient: anxiety patient gets GAD-7, depression patient never sees it", async ({
    page,
    context,
  }) => {
    // 1. Depression sample patient (P-SIM-DEP-01): has only PHQ-9 assigned
    await signInAsPatient(page, context, "P-SIM-DEP-01");
    await page.goto("/check-in");

    await expect(page.getByTestId("gad7-section")).toHaveCount(0);

    // 2. Anxiety sample patient (P-SIM-ANX-01): has PHQ-9 and GAD-7 assigned
    await signOutSession(context);
    await signInAsPatient(page, context, "P-SIM-ANX-01");
    await page.goto("/check-in");

    const gad7Section = page.getByTestId("gad7-section");
    await expect(gad7Section).toBeVisible();
    await expect(gad7Section).toContainText("GAD-7 anxiety questions");

    // Answer GAD-7 question 1 by typing
    const gad7Input1 = page.getByTestId("type-input-1");
    await expect(gad7Input1.first()).toBeVisible();
    await gad7Input1.last().fill("not at all");
    await page.locator('[data-testid="type-submit-1"]').last().click();

    const gad7Choice0 = page.getByRole("button", {
      name: "GAD-7 Question 1: 0 of 3",
    });
    await expect(gad7Choice0).toHaveAttribute("aria-pressed", "true");
  });

  test("5. typing 'not today' during PHQ-9 skips the round and shows the save explanation", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/check-in");

    // Answer taps to trigger PHQ-9
    const moodInput = page.getByTestId("type-input-moodScore");
    await moodInput.fill("2");
    await page.getByTestId("type-submit-moodScore").click();

    const interestInput = page.getByTestId("type-input-interestScore");
    await interestInput.fill("2");
    await page.getByTestId("type-submit-interestScore").click();

    // Verify PHQ-9 section is visible
    const phq9Section = page.getByTestId("phq9-section");
    await expect(phq9Section).toBeVisible();

    // Type "not today" in PHQ-9 item 1
    const phq1Input = page.getByTestId("type-input-1");
    await expect(phq1Input).toBeVisible();
    await phq1Input.fill("not today");
    await page.getByTestId("type-submit-1").click();

    // Status message appears confirming skip and plain save explanation
    const statusMessage = page.getByRole("status");
    await expect(statusMessage).toBeVisible();
    await expect(statusMessage).toContainText("The answers of this round are saved");
    await expect(statusMessage).toContainText("never scored as zero");
    await expect(statusMessage).toContainText("simulated");

    // Questionnaire section is dismissed
    await expect(phq9Section).toHaveCount(0);
  });

  test("6. typing 'skip' during GAD-7 skips the round and shows status message", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context, "P-SIM-ANX-01");
    await page.goto("/check-in");

    // Answer taps
    const moodInput = page.getByTestId("type-input-moodScore");
    await moodInput.fill("2");
    await page.getByTestId("type-submit-moodScore").click();

    const interestInput = page.getByTestId("type-input-interestScore");
    await interestInput.fill("2");
    await page.getByTestId("type-submit-interestScore").click();

    // Verify GAD-7 section is visible
    const gad7Section = page.getByTestId("gad7-section");
    await expect(gad7Section).toBeVisible();

    // Type "skip" into GAD-7 item 1 input
    const gad7Input1 = page.locator('[data-testid="type-input-1"]').last();
    await expect(gad7Input1).toBeVisible();
    await gad7Input1.fill("skip");
    await page.locator('[data-testid="type-submit-1"]').last().click();

    // Status message appears confirming skip and plain save explanation
    const statusMessage = page.getByRole("status");
    await expect(statusMessage).toBeVisible();
    await expect(statusMessage).toContainText("The answers of this round are saved");
    await expect(statusMessage).toContainText("never scored as zero");
    await expect(statusMessage).toContainText("simulated");

    // GAD-7 section is dismissed
    await expect(gad7Section).toHaveCount(0);
  });

  test("7. page header and completion status show true plain sentence without preview claims", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/check-in");

    // Verify page header contains the true plain sentence
    const header = page.getByRole("main").locator("header");
    await expect(header).toContainText("The answers of this round are saved");
    await expect(header).toContainText("never scored as zero");
    await expect(header).toContainText("simulated");
    await expect(header).not.toContainText("nothing is sent yet");

    // Complete the two taps
    const choiceMood = page.getByRole("button", { name: "Mood: 3 of 4" });
    await choiceMood.click();
    const choiceInterest = page.getByRole("button", { name: "Interest: 3 of 4" });
    await choiceInterest.click();

    // Completion status message appears with true sentence
    const statusMessage = page.getByRole("status");
    await expect(statusMessage).toBeVisible();
    await expect(statusMessage).toContainText("The answers of this round are saved");
    await expect(statusMessage).toContainText("never scored as zero");
    await expect(statusMessage).toContainText("simulated");
    await expect(statusMessage).not.toContainText("nothing is sent yet");
    await expect(statusMessage).not.toContainText("preview");
  });

  test("8. typing a help phrase immediately shows the crisis path", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/check-in");

    // Before typing help, crisis path is not visible
    await expect(page.getByTestId("crisis-path")).toHaveCount(0);

    // Type a fixed help phrase ("emergency") into the mood input
    const moodInput = page.getByTestId("type-input-moodScore");
    await expect(moodInput).toBeVisible();
    await moodInput.fill("emergency");
    await page.getByTestId("type-submit-moodScore").click();

    // The crisis path is displayed immediately on screen without waiting for the server
    const crisisPath = page.getByTestId("crisis-path");
    await expect(crisisPath).toBeVisible();
    await expect(crisisPath).toContainText("Direct connection to a person");
    await expect(crisisPath).toContainText("112");
  });
});
