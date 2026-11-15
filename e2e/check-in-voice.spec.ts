import { expect, test } from "@playwright/test";
import { getPrisma } from "../src/lib/db";
import { signInAsPatient } from "./helpers";

test.describe("Package I: On-device text and spoken answers on /check-in", () => {
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

  test("1. Typing answers selects prompt scores in order and leaves zero device storage", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context);
    await page.goto("/check-in", { waitUntil: "networkidle" });

    const input = page.getByTestId("check-in-text-input");
    const submit = page.getByTestId("check-in-text-submit");

    await input.fill("Good");
    await submit.click();
    await expect(
      page.getByRole("button", { name: "Mood: 3 of 4" })
    ).toHaveAttribute("aria-pressed", "true");

    await input.fill("1");
    await submit.click();
    await expect(
      page.getByRole("button", { name: "Interest: 1 of 4" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("status")).toContainText(
      "All 2 answers selected"
    );

    const storage = await page.evaluate(() => ({
      local: Object.keys(window.localStorage),
      session: Object.keys(window.sessionStorage),
    }));
    expect(storage.local).toEqual([]);
    expect(storage.session).toEqual([]);
  });

  test("2. Browser SpeechRecognition handles spoken 'Not today' on-device without uploading audio", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context);
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        lang = "en-US";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onresult: ((ev: unknown) => void) | null = null;
        onerror: ((ev: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          setTimeout(() => {
            this.onresult?.({
              results: [[{ transcript: "not today" }]],
            });
            this.onend?.();
          }, 20);
        }
        stop() {}
      }
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
        MockSpeechRecognition;
    });

    const unexpectedUploads: string[] = [];
    page.on("request", (req) => {
      if (req.method() !== "POST") return;
      if (req.url().includes("/api/auth/")) return;
      if (req.url().includes("/api/check-in/not-today")) {
        const body = req.postData() ?? "";
        if (body !== "{}") {
          unexpectedUploads.push(`${req.url()} (${body})`);
        }
        return;
      }
      unexpectedUploads.push(req.url());
    });

    await page.goto("/check-in", { waitUntil: "networkidle" });
    await page.getByTestId("check-in-speak-button").click();

    await expect(page.getByRole("status").first()).toContainText(
      "Taking a day off"
    );
    expect(unexpectedUploads).toEqual([]);
  });

  test("3. Typing a crisis phrase shows direct human support links immediately", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context);
    await page.goto("/check-in", { waitUntil: "networkidle" });

    await page.getByTestId("check-in-text-input").fill("help");
    await page.getByTestId("check-in-text-submit").click();

    const alert = page.getByTestId("check-in-voice-crisis");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("112");
    await expect(alert).toContainText("09 2525 0111");
    await expect(page.getByTestId("crisis-path")).toBeVisible();
  });
});
