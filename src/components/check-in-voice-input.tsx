"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CRISIS_RESOURCES } from "@/lib/constants";
import {
  parseSpokenChoice,
  type VoiceChoiceMode,
} from "@/domain/arduino/voice";
import {
  getOnDeviceSpeechRecognizer,
  type SpeechRecognitionController,
} from "@/components/check-in/on-device-speech";

function VoiceCrisisAlert() {
  return (
    <div
      role="alert"
      data-testid="check-in-voice-crisis"
      className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-stone-900"
    >
      <p className="font-semibold">
        Need someone right now? Direct connection to a person — nothing
        automated in between.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {CRISIS_RESOURCES.map((res) => (
          <a
            key={res.id}
            href={res.href}
            className="inline-flex min-h-10 items-center rounded-lg border border-amber-400 bg-white px-3 py-1.5 font-semibold text-stone-900 hover:bg-amber-100"
          >
            {res.label} ({res.phone})
          </a>
        ))}
      </div>
    </div>
  );
}

interface VoiceAnswerFormProps {
  textValue: string;
  placeholder: string;
  disabled: boolean;
  onChangeText: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function VoiceAnswerForm({
  textValue,
  placeholder,
  disabled,
  onChangeText,
  onSubmit,
}: VoiceAnswerFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <label htmlFor="check-in-text-answer" className="sr-only">
        Type your check-in answer
      </label>
      <input
        id="check-in-text-answer"
        data-testid="check-in-text-input"
        type="text"
        maxLength={80}
        disabled={disabled}
        value={textValue}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder={placeholder}
        className="min-h-11 flex-1 rounded-xl border border-border-tactile bg-surface-card px-3.5 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:border-accent-sage focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="submit"
        data-testid="check-in-text-submit"
        disabled={disabled}
        className={`min-h-11 shrink-0 rounded-xl bg-accent-sage px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        Apply answer
      </button>
    </form>
  );
}

function SpeakButton({
  listening,
  disabled,
  onClick,
}: {
  listening: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="check-in-speak-button"
      disabled={disabled}
      aria-pressed={listening}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${
        listening
          ? "border-accent-sage bg-accent-sage text-white"
          : "border-border-tactile bg-surface-card text-ink-primary hover:border-accent-sage hover:bg-accent-sage-soft/60"
      }`}
    >
      {listening ? "Stop listening" : "Speak answer"}
    </button>
  );
}

export interface ProcessVoiceOrTextInputOptions {
  raw: string;
  source: "spoken" | "typed";
  mode: VoiceChoiceMode;
  activeItemLabel: string | null;
  activeItemId?: string;
  onSelectScore: (score: number) => void;
  onNotToday: () => void;
  onCrisisHelp: () => void;
}

export interface ProcessVoiceOrTextInputResult {
  kind: "score" | "not_today" | "crisis_help" | "unclear";
  feedback: string;
  crisisVisible?: boolean;
}

export function processVoiceOrTextInput({
  raw,
  source,
  mode,
  activeItemLabel,
  activeItemId,
  onSelectScore,
  onNotToday,
  onCrisisHelp,
}: ProcessVoiceOrTextInputOptions): ProcessVoiceOrTextInputResult {
  const parsed = parseSpokenChoice(raw, mode);
  if (parsed.kind === "crisis_help") {
    onCrisisHelp();
    return {
      kind: "crisis_help",
      feedback: "Showing direct emergency and nurse support links.",
      crisisVisible: true,
    };
  }
  if (parsed.kind === "not_today") {
    onNotToday();
    return {
      kind: "not_today",
      feedback: "Applied: Not today.",
    };
  }
  if (parsed.kind === "score") {
    if (!activeItemLabel) {
      return {
        kind: "unclear",
        feedback:
          "All prompts are already answered — tap any word pill below to change one.",
      };
    }
    const isItem9Crisis = activeItemId === "9" && parsed.value > 0;
    if (isItem9Crisis) {
      onCrisisHelp();
    }
    const maxScore = mode === "tap" ? 4 : 3;
    onSelectScore(parsed.value);
    return {
      kind: "score",
      feedback: `Applied ${parsed.value} of ${maxScore} to ${activeItemLabel} (${source}).`,
      crisisVisible: isItem9Crisis,
    };
  }
  const maxScore = mode === "tap" ? 4 : 3;
  const example =
    mode === "tap"
      ? "Low, Okay, Good, Very good"
      : "Not at all, Several days, Nearly every day";
  return {
    kind: "unclear",
    feedback: `Could not match that to 0–${maxScore} or Not today. Try saying or typing 0–${maxScore}, ${example}, or Not today.`,
  };
}

export interface CheckInVoiceInputProps {
  activeItemLabel: string | null;
  activeItemId?: string;
  activeItemChoices?: readonly string[];
  disabled?: boolean;
  mode?: VoiceChoiceMode;
  onSelectScore: (score: number) => void;
  onNotToday: () => void;
  onCrisisHelp: () => void;
}

export function CheckInVoiceInput({
  activeItemLabel,
  activeItemId,
  activeItemChoices,
  disabled = false,
  mode = "tap",
  onSelectScore,
  onNotToday,
  onCrisisHelp,
}: CheckInVoiceInputProps) {
  const [textValue, setTextValue] = useState("");
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [crisisVisible, setCrisisVisible] = useState(false);
  const controllerRef = useRef<SpeechRecognitionController | null>(null);

  useEffect(() => {
    let mounted = true;
    const recognizer = getOnDeviceSpeechRecognizer();
    recognizer
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
      controllerRef.current?.stop();
      controllerRef.current = null;
    };
  }, []);

  function applyTranscript(raw: string, source: "spoken" | "typed") {
    const result = processVoiceOrTextInput({
      raw,
      source,
      mode,
      activeItemLabel,
      activeItemId,
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });
    setFeedback(result.feedback);
    if (result.crisisVisible) {
      setCrisisVisible(true);
    }
  }

  function handleTextSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const trimmed = textValue.trim();
    if (!trimmed) return;
    applyTranscript(trimmed, "typed");
    setTextValue("");
  }

  function handleToggleSpeech() {
    if (disabled || !voiceAvailable) return;
    if (listening) {
      controllerRef.current?.stop();
      setListening(false);
      return;
    }
    try {
      const recognizer = getOnDeviceSpeechRecognizer();
      const ctrl = recognizer.startListening({
        onResult: (transcript) => {
          setListening(false);
          applyTranscript(transcript, "spoken");
        },
        onError: () => {
          setListening(false);
          setFeedback(
            "Could not recognise speech clearly. You can try again, type, or tap below."
          );
        },
        onEnd: () => setListening(false),
      });
      controllerRef.current = ctrl;
      setFeedback("Listening on this device...");
      setListening(true);
    } catch {
      setListening(false);
      setFeedback("Unable to start on-device speech recognition.");
    }
  }

  const maxScore = mode === "tap" ? 4 : 3;
  const promptHint = activeItemLabel
    ? `Answering: ${activeItemLabel}`
    : "All prompts answered (tap any pill below to change)";
  const placeholder = activeItemChoices
    ? `Type: ${activeItemChoices.join(", ")}, 0–${maxScore}, or Not today`
    : "All prompts answered — type Not today or Help, or tap a pill below";

  return (
    <div
      data-testid="check-in-voice-panel"
      className="mt-6 rounded-xl border border-border-hairline bg-surface-subtle/70 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink-primary">
            {voiceAvailable ? "Speak or type an answer" : "Type an answer"}
          </p>
          <p className="text-xs text-ink-secondary">
            {promptHint}
            {voiceAvailable
              ? " · Uses confirmed on-device speech recognition when you tap Speak; Cepheus never records, keeps, or uploads audio."
              : " · Cepheus never records, keeps, or uploads audio."}
          </p>
        </div>
        {voiceAvailable ? (
          <SpeakButton
            listening={listening}
            disabled={disabled}
            onClick={handleToggleSpeech}
          />
        ) : null}
      </div>

      <VoiceAnswerForm
        textValue={textValue}
        placeholder={placeholder}
        disabled={disabled}
        onChangeText={setTextValue}
        onSubmit={handleTextSubmit}
      />

      {feedback ? (
        <p
          aria-live="polite"
          data-testid="check-in-voice-feedback"
          className="mt-2.5 text-xs font-medium text-ink-secondary"
        >
          {feedback}
        </p>
      ) : null}

      {crisisVisible ? <VoiceCrisisAlert /> : null}
    </div>
  );
}
