/**
 * Pure deterministic spoken-answer parser for the Arduino UNO Q (2 GB)
 * on-device voice kiosk (Trail #24).
 *
 * Rules enforced:
 * - Maps spoken choice text strictly to fixed item scores (0..4 taps, 0..3 PHQ-9),
 *   "not_today", or immediate "crisis_help".
 * - Never infers mood, emotion, or prosody from voice.
 * - Zero external imports outside src/domain/.
 */

export type VoiceChoiceMode = "tap" | "phq9";

export type ParsedVoiceChoice =
  | { readonly kind: "score"; readonly value: number }
  | { readonly kind: "not_today" }
  | { readonly kind: "crisis_help" }
  | { readonly kind: "unclear" };

const CRISIS_PHRASES = [
  "help",
  "crisis",
  "emergency",
  "112",
  "hurt myself",
  "end my life",
  "call nurse",
  "nurse",
];

const NOT_TODAY_PHRASES = [
  "not today",
  "skip",
  "skip today",
  "pass",
  "later",
  "no thanks",
];

const NUMBER_WORDS: Record<string, number> = {
  "0": 0,
  zero: 0,
  "1": 1,
  one: 1,
  "2": 2,
  two: 2,
  "3": 3,
  three: 3,
  "4": 4,
  four: 4,
};

const TAP_LABELS: ReadonlyArray<{ phrase: string; score: number }> = [
  { phrase: "very low", score: 0 },
  { phrase: "not at all", score: 0 },
  { phrase: "low", score: 1 },
  { phrase: "a little", score: 1 },
  { phrase: "okay", score: 2 },
  { phrase: "ok", score: 2 },
  { phrase: "somewhat", score: 2 },
  { phrase: "moderate", score: 2 },
  { phrase: "good", score: 3 },
  { phrase: "quite a bit", score: 3 },
  { phrase: "very good", score: 4 },
  { phrase: "very much", score: 4 },
];

const PHQ9_LABELS: ReadonlyArray<{ phrase: string; score: number }> = [
  { phrase: "not at all", score: 0 },
  { phrase: "several days", score: 1 },
  { phrase: "more than half the days", score: 2 },
  { phrase: "more than half", score: 2 },
  { phrase: "nearly every day", score: 3 },
  { phrase: "every day", score: 3 },
];

function normalizeTranscript(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministically maps a local STT transcript string to a fixed score or action.
 * Any transcript containing a crisis/help keyword always resolves to `crisis_help` first.
 */
export function parseSpokenChoice(
  transcript: string,
  mode: VoiceChoiceMode
): ParsedVoiceChoice {
  const norm = normalizeTranscript(transcript);
  if (!norm) {
    return { kind: "unclear" };
  }

  for (const phrase of CRISIS_PHRASES) {
    if (norm === phrase || norm.includes(phrase)) {
      return { kind: "crisis_help" };
    }
  }

  for (const phrase of NOT_TODAY_PHRASES) {
    if (norm === phrase || norm.includes(phrase)) {
      return { kind: "not_today" };
    }
  }

  const maxScore = mode === "tap" ? 4 : 3;
  const labels = mode === "tap" ? TAP_LABELS : PHQ9_LABELS;

  // Match exact phrase labels first (longest match wins, e.g. "very good" before "good")
  const sortedLabels = [...labels].sort((a, b) => b.phrase.length - a.phrase.length);
  for (const item of sortedLabels) {
    if (norm === item.phrase || norm.includes(item.phrase)) {
      return { kind: "score", value: item.score };
    }
  }

  // Match spoken digits or number words
  const tokens = norm.split(" ");
  for (const tok of tokens) {
    if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, tok)) {
      const val = NUMBER_WORDS[tok];
      if (val >= 0 && val <= maxScore) {
        return { kind: "score", value: val };
      }
    }
  }

  return { kind: "unclear" };
}
