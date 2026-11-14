import type { FaithfulnessCheckResult } from "./types";

const FORBIDDEN_PATTERNS: ReadonlyArray<{ label: string; regex: RegExp }> = [
  { label: "diagnostic claim", regex: /\bdiagnos(?:e|ed|is|tic)\b/i },
  { label: "relapse claim", regex: /\brelapse(?:d|s|ing)?\b/i },
  { label: "clinical depression label", regex: /\bmajor\s+depress(?:ion|ive)\b/i },
  { label: "depressed label", regex: /\bis\s+depressed\b/i },
  { label: "prediction claim", regex: /\bpredict(?:ed|s|ing|ion)?\b/i },
  { label: "severity or triage judgment", regex: /\b(?:severity|risk\s+level|triage|recommend(?:ed|s|ing|ation)?)\b/i },
  { label: "prescription advice", regex: /\b(?:prescrib\w*|medication\s+dose|dosage)\b/i },
  { label: "self-harm text", regex: /\bsuicid\w*\b/i },
  { label: "backfire happy memory", regex: /\bhappy\s+memor(?:y|ies)\b/i },
  { label: "backfire sad music", regex: /\bsad\s+music\b/i },
  { label: "backfire cold water", regex: /\bcold\s+water\b/i },
  { label: "gamification streak", regex: /\bstreak(?:s)?\b/i },
  { label: "gamification score", regex: /\b(?:your\s+score|risk\s+score|mood\s+score)\b/i },
];

export function extractNumericTokens(text: string): string[] {
  const matches = text.match(/-?\d+(?:\.\d+)?/g);
  return matches ? [...matches] : [];
}

/**
 * Verifies AI output obeys clinical safety rules and contains no invented numbers.
 * When `enforceStrictNumberGrounding` is true (used for nurse briefs), every numeric
 * token in `outputText` must appear in the concatenated `allowedSourceTexts`.
 */
export function verifyOutputFaithfulness(
  outputText: string,
  allowedSourceTexts: readonly string[],
  options: {
    enforceStrictNumberGrounding?: boolean;
    forbidAllDigits?: boolean;
  } = {}
): FaithfulnessCheckResult {
  const trimmed = outputText.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "AI output was empty." };
  }

  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.regex.test(trimmed)) {
      return {
        ok: false,
        reason: `Refused output containing forbidden ${rule.label}.`,
      };
    }
  }

  if (options.forbidAllDigits && /\d/.test(trimmed)) {
    return {
      ok: false,
      reason: "Refused patient-facing message containing digits.",
    };
  }

  if (options.enforceStrictNumberGrounding) {
    const allowedNumbers = new Set(
      extractNumericTokens(allowedSourceTexts.join(" "))
    );
    const producedNumbers = extractNumericTokens(trimmed);
    for (const num of producedNumbers) {
      if (!allowedNumbers.has(num)) {
        return {
          ok: false,
          reason: `Refused ungrounded number "${num}" not present in input metrics.`,
        };
      }
    }
  }

  return { ok: true };
}
