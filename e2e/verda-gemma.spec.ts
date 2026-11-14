import { expect, test } from "@playwright/test";

test.describe("Verda EU Gemma Patient Step & Nurse Pre-Call Brief (Trail #31)", () => {
  test("1. /patient tailors a safe low-effort step without scores or streaks", async ({
    page,
  }) => {
    await page.goto("/patient");

    await page.getByTestId("verda-patient-step-btn").click();
    const resultCard = page.getByTestId("verda-patient-step-result");
    await expect(resultCard).toBeVisible();
    await expect(resultCard).toContainText("daylight");

    const mainText = await page.locator("main").innerText();
    expect(mainText.toLowerCase()).not.toContain("streak");
    expect(mainText.toLowerCase()).not.toContain("relapse");
  });

  test("2. /clinic generates a faithfulness-checked nurse pre-call brief", async ({
    page,
  }) => {
    await page.goto("/clinic");

    await page.getByTestId("verda-nurse-brief-btn").click();
    const briefCard = page.getByTestId("verda-nurse-brief-result");
    await expect(briefCard).toBeVisible();
    await expect(briefCard).toContainText("Faithfulness checked");
    await expect(page.getByTestId("verda-source-metrics")).toContainText("-18%");
    await expect(page.getByTestId("verda-nurse-confirm")).toBeVisible();
    await expect(briefCard).toContainText("Gentle call-opener suggestions");
  });

  test("3. AI endpoints enforce same-origin and strict schema validation", async ({
    request,
  }) => {
    const crossOriginRes = await request.post("/api/ai/nurse-brief", {
      headers: { origin: "https://attacker.example.com" },
      data: {
        participantCode: "sim-01",
        sinceDate: "2026-11-05",
        triggerKind: "silence",
        broadAreas: ["check_in"],
        ringActiveDuringSilence: true,
        metrics: [],
      },
    });
    expect(crossOriginRes.status()).toBe(403);

    const invalidTriggerRes = await request.post("/api/ai/nurse-brief", {
      headers: { origin: "http://127.0.0.1:3100" },
      data: {
        participantCode: "sim-01",
        sinceDate: "2026-11-05",
        triggerKind: "crisis_self_harm",
        broadAreas: ["check_in"],
        ringActiveDuringSilence: true,
        metrics: [],
      },
    });
    expect(invalidTriggerRes.status()).toBe(400);
  });
});
