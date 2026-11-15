import { expect } from "@playwright/test";
import { clearCheckInAnswers, signInAsPatient, signOutSession, test } from "./helpers";

test.describe("Check-in screen: GAD-7, typing answers, and on-device voice gating", () => {
  // These tests answer and skip the open round of three sample patients.
  test.afterAll(async () => {
    await clearCheckInAnswers(["P-SIM-001", "P-SIM-DEP-01", "P-SIM-ANX-01"]);
  });

  test("1. completes a check-in by typing (taps and questionnaire items)", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/check-in");

    const textInput = page.getByTestId("check-in-text-input");
    const submitBtn = page.getByTestId("check-in-text-submit");

    // Answer Mood tap by typing
    await expect(textInput).toBeVisible();
    await textInput.fill("good");
    await submitBtn.click();

    const moodChoice3 = page.getByRole("button", { name: "Mood: 3 of 4" });
    await expect(moodChoice3).toHaveAttribute("aria-pressed", "true");

    // Answer Interest tap by typing
    await expect(textInput).toBeVisible();
    await textInput.fill("2");
    await submitBtn.click();

    const interestChoice2 = page.getByRole("button", { name: "Interest: 2 of 4" });
    await expect(interestChoice2).toHaveAttribute("aria-pressed", "true");

    // Answer PHQ-9 items 1 through 8 by typing
    for (let item = 1; item <= 8; item++) {
      await expect(textInput).toBeVisible();
      await textInput.fill("0");
      await submitBtn.click();

      const option0 = page.getByRole("button", {
        name: `Question ${item}: 0 of 3`,
      });
      await expect(option0).toHaveAttribute("aria-pressed", "true");
    }

    // Answer item 9 with 0
    await textInput.fill("not at all");
    await submitBtn.click();

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

    const textInput = page.getByTestId("check-in-text-input");
    const submitBtn = page.getByTestId("check-in-text-submit");

    // Answer taps
    await textInput.fill("2");
    await submitBtn.click();
    await textInput.fill("2");
    await submitBtn.click();

    // Answer items 1 through 8
    for (let item = 1; item <= 8; item++) {
      await textInput.fill("0");
      await submitBtn.click();
    }

    // Answer PHQ-9 item 9 with score 1 by typing
    await expect(textInput).toBeVisible();
    await textInput.fill("several days");
    await submitBtn.click();

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
    await expect(page.getByTestId("check-in-speak-button")).toHaveCount(0);

    // Text typing input remains available for everyone
    await expect(page.getByTestId("check-in-text-input")).toBeVisible();
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

    // Answer taps to advance to GAD-7
    const textInput = page.getByTestId("check-in-text-input");
    const submitBtn = page.getByTestId("check-in-text-submit");
    await textInput.fill("2");
    await submitBtn.click();
    await textInput.fill("2");
    await submitBtn.click();

    // Answer PHQ-9 items 1..9 to reach GAD-7
    for (let item = 1; item <= 9; item++) {
      await textInput.fill("0");
      await submitBtn.click();
    }

    // Now active prompt is GAD-7 Question 1
    await textInput.fill("not at all");
    await submitBtn.click();

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

    const textInput = page.getByTestId("check-in-text-input");
    const submitBtn = page.getByTestId("check-in-text-submit");

    // Answer taps to trigger PHQ-9
    await textInput.fill("2");
    await submitBtn.click();
    await textInput.fill("2");
    await submitBtn.click();

    // Verify PHQ-9 section is visible
    const phq9Section = page.getByTestId("phq9-section");
    await expect(phq9Section).toBeVisible();

    // Type "not today" in the text input during PHQ-9
    await textInput.fill("not today");
    await submitBtn.click();

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

    const textInput = page.getByTestId("check-in-text-input");
    const submitBtn = page.getByTestId("check-in-text-submit");

    // Answer taps
    await textInput.fill("2");
    await submitBtn.click();
    await textInput.fill("2");
    await submitBtn.click();

    // Answer PHQ-9 items 1..9 to reach GAD-7
    for (let item = 1; item <= 9; item++) {
      await textInput.fill("0");
      await submitBtn.click();
    }

    // Verify GAD-7 section is visible
    const gad7Section = page.getByTestId("gad7-section");
    await expect(gad7Section).toBeVisible();

    // Type "skip" into input
    await textInput.fill("skip");
    await submitBtn.click();

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
    const textInput = page.getByTestId("check-in-text-input");
    const submitBtn = page.getByTestId("check-in-text-submit");
    await textInput.fill("emergency");
    await submitBtn.click();

    // The crisis path is displayed immediately on screen without waiting for the server
    const crisisPath = page.getByTestId("crisis-path");
    await expect(crisisPath).toBeVisible();
    await expect(crisisPath).toContainText("Direct connection to a person");
    await expect(crisisPath).toContainText("112");
  });

  test("9. voice button is absent when on-device recognition is unavailable and present when available", async ({
    page,
    context,
  }) => {
    // 1. Without on-device recognition confirmed: voice button is absent
    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/check-in");
    await expect(page.getByTestId("check-in-speak-button")).toHaveCount(0);
    await expect(page.getByTestId("check-in-text-input")).toBeVisible();

    // 2. With on-device recognition stubbed: voice button is present
    await signOutSession(context);
    await page.addInitScript(() => {
      class MockOnDeviceSpeechRecognition {
        static async available(opts?: { langs?: string[]; processLocally?: boolean }) {
          return opts?.processLocally ? true : false;
        }
        lang = "en-US";
        processLocally = true;
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onresult: ((ev: unknown) => void) | null = null;
        onerror: ((ev: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        start() {}
        stop() {}
        abort() {}
      }
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
        MockOnDeviceSpeechRecognition;
    });

    await signInAsPatient(page, context, "P-SIM-001");
    await page.goto("/check-in");
    await expect(page.getByTestId("check-in-speak-button")).toBeVisible();
    await expect(page.getByTestId("check-in-speak-button")).toContainText("Speak answer");
  });
});
