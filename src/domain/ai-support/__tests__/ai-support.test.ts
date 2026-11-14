import { describe, expect, it } from "vitest";
import { verifyOutputFaithfulness } from "../faithfulness";
import {
  buildDeterministicNurseBrief,
  selectDeterministicPatientStep,
} from "../templates";

describe("AI Support Domain Guardrails & Templates (src/domain/ai-support)", () => {
  it("blocks forbidden diagnostic, relapse, backfire, and gamification terms", () => {
    const allowed = ["2026-11-05", "check_in", "18"];
    expect(
      verifyOutputFaithfulness(
        "This patient has relapsed and is diagnosed with major depression.",
        allowed
      ).ok
    ).toBe(false);

    expect(
      verifyOutputFaithfulness("Recall a happy memory and keep your streak!", allowed)
        .ok
    ).toBe(false);

    expect(
      verifyOutputFaithfulness(
        "High severity risk level: recommend triage for booster TMS.",
        allowed
      ).ok
    ).toBe(false);

    expect(
      verifyOutputFaithfulness("Take a 10-minute walk outside when ready.", allowed)
        .ok
    ).toBe(true);

    expect(
      verifyOutputFaithfulness(
        "Your score is 4 today, try a short walk.",
        allowed,
        { forbidAllDigits: true }
      ).ok
    ).toBe(false);
    expect(
      verifyOutputFaithfulness(
        "Step outside for a short daylight walk when ready.",
        allowed,
        { forbidAllDigits: true }
      ).ok
    ).toBe(true);
  });

  it("rejects ungrounded numbers invented in nurse briefs", () => {
    const allowed = ["P-042", "2026-11-05", "2 missed rounds", "18%"];

    expect(
      verifyOutputFaithfulness(
        "Participant P-042 had 2 missed rounds since 2026-11-05 (sleep regularity down 18%).",
        allowed,
        { enforceStrictNumberGrounding: true }
      ).ok
    ).toBe(true);

    const hallucinated = verifyOutputFaithfulness(
      "Participant P-042 had 7 missed rounds since 2026-11-05 (PHQ-9 22).",
      allowed,
      { enforceStrictNumberGrounding: true }
    );
    expect(hallucinated.ok).toBe(false);
    if (!hallucinated.ok) {
      expect(hallucinated.reason).toMatch(/ungrounded number/i);
    }
  });

  it("selects personalized safe patient step from outcomes or low-daylight context", () => {
    const fromHistory = selectDeterministicPatientStep({
      participantCode: "sim-01",
      dayIndex: 29,
      broadAreasShifted: ["check_in"],
      lowDaylight: false,
      highStationaryBout: false,
      pastActionOutcomes: [
        { actionKey: "short_walk", completedCount: 2, averageNextDelta: 0.2 },
        { actionKey: "social_contact", completedCount: 3, averageNextDelta: 0.7 },
      ],
      isSimulated: true,
    });
    expect(fromHistory.actionKey).toBe("social_contact");

    const fromLight = selectDeterministicPatientStep({
      participantCode: "sim-01",
      dayIndex: 29,
      broadAreasShifted: ["daily_routine"],
      lowDaylight: true,
      highStationaryBout: true,
      pastActionOutcomes: [],
      isSimulated: true,
    });
    expect(fromLight.actionKey).toBe("bright_light");
  });

  it("builds a faithful deterministic nurse brief with grounded numbers only", () => {
    const brief = buildDeterministicNurseBrief({
      participantCode: "sim-01",
      sinceDate: "2026-11-05",
      triggerKind: "silence",
      broadAreas: ["check_in", "sleep"],
      ringActiveDuringSilence: true,
      metrics: [
        { label: "Missed rounds:", valueText: "2" },
        { label: "Sleep regularity shift:", valueText: "-18%" },
      ],
      isSimulated: true,
    });

    const check = verifyOutputFaithfulness(
      brief.summary,
      ["sim-01", "2026-11-05", "2", "-18%"],
      { enforceStrictNumberGrounding: true }
    );
    expect(check.ok).toBe(true);
    expect(brief.conversationOpeners.length).toBeGreaterThanOrEqual(2);
  });
});
