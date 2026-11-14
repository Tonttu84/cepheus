import { expect, test } from "@playwright/test";

test.describe("Verda EU Gemma Nurse Pre-Call Brief & Guardrails (Trail #31)", () => {
  test("1. /patient remains clean without unapproved AI step controls or streaks", async ({
    page,
  }) => {
    await page.goto("/patient");
    await expect(page.getByTestId("patient-suggestion-card")).toBeVisible();
    await expect(page.getByTestId("verda-patient-step-btn")).toHaveCount(0);

    const mainText = await page.locator("main").innerText();
    expect(mainText.toLowerCase()).not.toContain("streak");
  });

  test("2. /clinic generates a faithfulness-checked nurse pre-call brief with source metrics & HITL confirmation", async ({
    page,
  }) => {
    await page.goto("/clinic");

    await page.getByTestId("verda-nurse-brief-btn").click();
    const briefCard = page.getByTestId("verda-nurse-brief-result");
    await expect(briefCard).toBeVisible();
    await expect(briefCard).toContainText("Faithfulness checked");
    await expect(page.getByTestId("verda-source-metrics")).toContainText("-18%");
    await expect(page.getByTestId("verda-nurse-confirm")).toBeVisible();
    await page.getByTestId("verda-nurse-confirm").check();
    await expect(page.getByTestId("verda-nurse-confirm")).toBeChecked();
  });

  test("3. AI endpoints enforce off-by-default patient switch, same-origin, and strict schema validation", async ({
    request,
  }) => {
    const patientStepRes = await request.post("/api/ai/patient-step", {
      headers: { origin: "http://127.0.0.1:3100" },
      data: {
        participantCode: "sim-01",
        dayIndex: 29,
        broadAreasShifted: ["daily_routine"],
        lowDaylight: true,
        highStationaryBout: true,
        pastActionOutcomes: [],
      },
    });
    expect(patientStepRes.status()).toBe(403);

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
