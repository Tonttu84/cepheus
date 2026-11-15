import type {
  NurseBriefInput,
  NurseBriefOutput,
  PatientStepInput,
  PatientStepOutput,
  SafeActionKey,
} from "./types";

export const SAFE_ACTION_DEFAULTS: Record<
  SafeActionKey,
  { title: string; message: string }
> = {
  short_walk: {
    title: "Take a 10-minute walk outside",
    message:
      "If today feels a little heavier, a brief 10-minute step outside can help reset your pace—skip it anytime with no pressure.",
  },
  bright_light: {
    title: "Spend 10 minutes near daylight or a bright window",
    message:
      "Daylight has been lower indoors today; sitting near a bright window or stepping outside briefly is an easy, zero-effort option.",
  },
  breathing_space: {
    title: "Try 3 minutes of slow breathing",
    message:
      "Settle in comfortably for 3 minutes of unhurried breathing whenever you feel ready—no goal to hit.",
  },
  social_contact: {
    title: "Send one short message to someone you trust",
    message:
      "A single low-pressure text to a friend or family member can keep a thread open when energy is low.",
  },
};

function findBestHistoricalAction(
  outcomes: PatientStepInput["pastActionOutcomes"]
): SafeActionKey | null {
  let bestKey: SafeActionKey | null = null;
  let bestScore = 0;

  for (const item of outcomes) {
    if (
      item.completedCount > 0 &&
      item.averageNextDelta !== null &&
      item.averageNextDelta > bestScore
    ) {
      bestScore = item.averageNextDelta;
      bestKey = item.actionKey;
    }
  }
  return bestKey;
}

/**
 * Deterministic safe fallback for patient step selection & calm wording.
 */
export function selectDeterministicPatientStep(
  input: PatientStepInput
): PatientStepOutput {
  const historicalBest = findBestHistoricalAction(input.pastActionOutcomes);
  let chosen: SafeActionKey = historicalBest ?? "short_walk";

  if (!historicalBest && input.lowDaylight && input.highStationaryBout) {
    chosen = "bright_light";
  } else if (!historicalBest && input.broadAreasShifted.includes("sleep")) {
    chosen = "bright_light";
  }

  const template = SAFE_ACTION_DEFAULTS[chosen];
  return {
    actionKey: chosen,
    actionTitle: template.title,
    message: template.message,
  };
}

/**
 * Deterministic safe fallback for the nurse pre-call brief.
 * Uses only the exact input numbers and broad areas, with zero clinical claims.
 */
export function buildDeterministicNurseBrief(
  input: NurseBriefInput
): NurseBriefOutput {
  const areasText =
    input.broadAreas.length > 0 ? input.broadAreas.join(", ") : "check_in";
  let triggerPhrase = "a sustained check-in shift below personal baseline";
  if (input.triggerKind === "silence") {
    triggerPhrase = "unanswered check-in rounds";
  } else if (input.triggerKind === "low_answers") {
    triggerPhrase = "check-in answers below personal baseline";
  } else if (input.triggerKind === "phq9") {
    triggerPhrase = "a shift on the PHQ-9 questionnaire";
  } else if (input.triggerKind === "gad7") {
    triggerPhrase = "a shift on the GAD-7 questionnaire";
  } else if (input.triggerKind === "mixed") {
    triggerPhrase = "a mixed pattern of low answers and unanswered check-in rounds";
  }

  const ringNote =
    input.ringActiveDuringSilence === true
      ? " Wearable contact remained active during the quiet period."
      : "";

  const metricSummary =
    input.metrics.length > 0
      ? ` Recorded context: ${input.metrics.map((m) => `${m.label} ${m.valueText}`).join("; ")}.`
      : "";

  const summary = `Participant ${input.participantCode} showed ${triggerPhrase} in ${areasText} since ${input.sinceDate}.${ringNote}${metricSummary} This summary supports the care team's follow-up call.`;

  const openers: string[] = [
    `Ask gently how their day-to-day energy and routines have felt since ${input.sinceDate}.`,
  ];
  if (input.broadAreas.includes("sleep")) {
    openers.push(
      "Check softly whether sleep timing or night waking has felt more fragmented lately."
    );
  }
  if (input.broadAreas.includes("daily_routine") || input.triggerKind === "silence") {
    openers.push(
      "Reassure them that missed check-ins are never a problem and ask if a booster check-in or lighter schedule would help."
    );
  }

  return {
    summary,
    conversationOpeners: openers.slice(0, 3),
  };
}
