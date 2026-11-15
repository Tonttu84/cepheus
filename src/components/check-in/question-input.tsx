"use client";

import { useEffect, useState } from "react";
import { parseSpokenChoice, type VoiceChoiceMode } from "@/domain/arduino/voice";
import { getOnDeviceSpeechRecognizer } from "./on-device-speech";

export interface QuestionInputProps {
  readonly mode: VoiceChoiceMode;
  readonly itemLabel: string;
  readonly itemId?: string;
  readonly disabled?: boolean;
  readonly onSelect: (choice: number) => void;
  readonly onCrisisHelp?: () => void;
  readonly onNotToday?: () => void;
}

export interface QuestionAnswerCallbacks {
  readonly onSelectScore: (choice: number) => void;
  readonly onCrisisHelp?: () => void;
  readonly onNotToday?: () => void;
  readonly onUnclearHint: (hint: string) => void;
}

export function processQuestionAnswer({
  rawAnswer,
  mode,
  itemId,
  callbacks,
}: {
  rawAnswer: string;
  mode: VoiceChoiceMode;
  itemId?: string;
  callbacks: QuestionAnswerCallbacks;
}): void {
  const parsed = parseSpokenChoice(rawAnswer, mode);

  if (parsed.kind === "crisis_help") {
    callbacks.onCrisisHelp?.();
    return;
  }

  if (parsed.kind === "not_today") {
    callbacks.onNotToday?.();
    return;
  }

  if (parsed.kind === "score") {
    if (itemId === "9" && parsed.value > 0) {
      callbacks.onCrisisHelp?.();
    }
    callbacks.onSelectScore(parsed.value);
    return;
  }

  // Kind is unclear - ask again with a short neutral hint
  const maxScore = mode === "tap" ? 4 : 3;
  const example = mode === "tap" ? '"okay" or "good"' : '"not at all" or "several days"';
  callbacks.onUnclearHint(
    `Could not understand answer. Please enter a number from 0 to ${maxScore} or an option like ${example}.`
  );
}

export function QuestionInput({
  mode,
  itemLabel,
  itemId,
  disabled = false,
  onSelect,
  onCrisisHelp,
  onNotToday,
}: QuestionInputProps) {
  const [typedText, setTypedText] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    let mounted = true;
    getOnDeviceSpeechRecognizer()
      .isAvailable()
      .then((avail) => {
        if (mounted) {
          setVoiceAvailable(avail);
        }
      })
      .catch(() => {
        if (mounted) {
          setVoiceAvailable(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  function processRawAnswer(raw: string) {
    setHint(null);
    processQuestionAnswer({
      rawAnswer: raw,
      mode,
      itemId,
      callbacks: {
        onSelectScore: onSelect,
        onCrisisHelp,
        onNotToday,
        onUnclearHint: (msg) => setHint(msg),
      },
    });
  }

  function handleTypeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || !typedText.trim()) return;
    const submitted = typedText;
    setTypedText(""); // Clear immediately, never keep typed text
    processRawAnswer(submitted);
  }

  function handleVoiceClick() {
    if (disabled) return;
    if (isListening) return;

    setHint(null);
    setIsListening(true);
    const recognizer = getOnDeviceSpeechRecognizer();

    recognizer.startListening({
      onResult: (transcript) => {
        setIsListening(false);
        processRawAnswer(transcript);
      },
      onError: () => {
        setIsListening(false);
        const maxScore = mode === "tap" ? 4 : 3;
        setHint(`Could not understand speech. Please try again or type a number from 0 to ${maxScore}.`);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  }

  const idSuffix = itemId ?? itemLabel.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="mt-3.5 space-y-2">
      <form
        onSubmit={handleTypeSubmit}
        className="flex flex-wrap items-center gap-2"
        data-testid={`question-input-form-${idSuffix}`}
      >
        <div className="relative flex-1 min-w-[160px] sm:max-w-xs">
          <input
            type="text"
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            disabled={disabled}
            placeholder={
              mode === "tap"
                ? "Type 0–4 or word (e.g. okay)..."
                : "Type 0–3 or word (e.g. several days)..."
            }
            aria-label={`Type answer for ${itemLabel}`}
            data-testid={`type-input-${idSuffix}`}
            className="w-full min-h-11 rounded-xl border border-border-tactile bg-surface-card px-3 py-2 text-xs text-ink-primary placeholder:text-ink-muted transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={disabled || !typedText.trim()}
          data-testid={`type-submit-${idSuffix}`}
          className="min-h-11 rounded-xl border border-border-tactile bg-surface-subtle px-3.5 py-2 text-xs font-semibold text-ink-primary transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          Enter
        </button>

        {voiceAvailable ? (
          <button
            type="button"
            disabled={disabled || isListening}
            onClick={handleVoiceClick}
            aria-label={`Voice answer for ${itemLabel}`}
            data-testid={`voice-answer-button-${idSuffix}`}
            className={`min-h-11 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
              isListening
                ? "border-accent-sage bg-accent-sage-soft text-accent-sage-hover animate-pulse"
                : "border-border-tactile bg-surface-card text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isListening ? "bg-accent-sage-hover" : "bg-ink-muted"
              }`}
              aria-hidden="true"
            />
            {isListening ? "Listening..." : "Speak"}
          </button>
        ) : null}
      </form>

      {hint ? (
        <p
          role="status"
          data-testid={`question-hint-${idSuffix}`}
          className="text-xs text-amber-900 bg-amber-50/80 border border-amber-200 rounded-lg px-2.5 py-1.5 font-medium leading-relaxed"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
