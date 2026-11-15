"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CRISIS_RESOURCES } from "@/lib/constants";
import {
  parseSpokenChoice,
  type VoiceChoiceMode,
} from "@/domain/arduino/voice";

interface BrowserSpeechRecognitionResultItem {
  transcript?: string;
}

interface BrowserSpeechRecognitionEvent {
  results?: ArrayLike<ArrayLike<BrowserSpeechRecognitionResultItem>>;
}

interface BrowserSpeechRecognitionErrorEvent {
  error?: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function startBrowserRecognition(handlers: {
  onResult: (transcript: string) => void;
  onError: (code: string) => void;
  onEnd: () => void;
}): BrowserSpeechRecognition | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    return null;
  }
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (event) => {
    handlers.onResult(event.results?.[0]?.[0]?.transcript ?? "");
  };
  rec.onerror = (event) => {
    handlers.onError(event.error ?? "unavailable");
  };
  rec.onend = handlers.onEnd;
  rec.start();
  return rec;
}

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
  onChangeText: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function VoiceAnswerForm({
  textValue,
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
        value={textValue}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder="Type: Very low, Low, Okay, Good, Very good, 0–4, or Not today"
        className="min-h-11 flex-1 rounded-xl border border-border-tactile bg-surface-card px-3.5 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:border-accent-sage focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
      />
      <button
        type="submit"
        data-testid="check-in-text-submit"
        className="min-h-11 shrink-0 rounded-xl bg-accent-sage px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer"
      >
        Apply answer
      </button>
    </form>
  );
}

export interface CheckInVoiceInputProps {
  activeItemLabel: string | null;
  mode?: VoiceChoiceMode;
  onSelectScore: (score: number) => void;
  onNotToday: () => void;
  onCrisisHelp: () => void;
}

export function CheckInVoiceInput({
  activeItemLabel,
  mode = "tap",
  onSelectScore,
  onNotToday,
  onCrisisHelp,
}: CheckInVoiceInputProps) {
  const [textValue, setTextValue] = useState("");
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [crisisVisible, setCrisisVisible] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  function applyTranscript(raw: string, source: "spoken" | "typed") {
    const parsed = parseSpokenChoice(raw, mode);
    if (parsed.kind === "crisis_help") {
      setCrisisVisible(true);
      setFeedback("Showing direct emergency and nurse support links.");
      onCrisisHelp();
      return;
    }
    if (parsed.kind === "not_today") {
      setFeedback("Applied: Not today.");
      onNotToday();
      return;
    }
    if (parsed.kind === "score") {
      const target = activeItemLabel ?? "prompt";
      setFeedback(`Applied ${parsed.value} of 4 to ${target} (${source}).`);
      onSelectScore(parsed.value);
      return;
    }
    setFeedback(
      "Could not match that to 0–4 or Not today. Try saying or typing 0–4, Low, Okay, Good, Very good, or Not today."
    );
  }

  function handleTextSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = textValue.trim();
    if (!trimmed) return;
    applyTranscript(trimmed, "typed");
    setTextValue("");
  }

  function handleToggleSpeech() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    try {
      const started = startBrowserRecognition({
        onResult: (transcript) => {
          setListening(false);
          applyTranscript(transcript, "spoken");
        },
        onError: (code) => {
          setListening(false);
          setFeedback(
            code === "not-allowed"
              ? "Microphone permission was declined. You can type an answer or tap 0–4."
              : "Could not recognise speech clearly. You can try again, type, or tap 0–4."
          );
        },
        onEnd: () => setListening(false),
      });
      if (!started) {
        setFeedback(
          "Browser speech recognition is unavailable here. Type an answer below or tap 0–4."
        );
        return;
      }
      recognitionRef.current = started;
      setFeedback("Listening on this device...");
      setListening(true);
    } catch {
      setListening(false);
      setFeedback("Unable to start browser speech recognition.");
    }
  }

  const promptHint = activeItemLabel
    ? `Answering: ${activeItemLabel}`
    : "All prompts answered (tap or enter to update)";

  return (
    <div
      data-testid="check-in-voice-panel"
      className="mt-6 rounded-xl border border-border-hairline bg-surface-subtle/70 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink-primary">
            Speak or type an answer (stays on this device)
          </p>
          <p className="text-xs text-ink-secondary">
            {promptHint} · Audio is processed in your browser only and never
            kept or uploaded.
          </p>
        </div>
        <button
          type="button"
          data-testid="check-in-speak-button"
          aria-pressed={listening}
          onClick={handleToggleSpeech}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer ${
            listening
              ? "border-accent-sage bg-accent-sage text-white"
              : "border-border-tactile bg-surface-card text-ink-primary hover:border-accent-sage hover:bg-accent-sage-soft/60"
          }`}
        >
          {listening ? "Stop listening" : "Speak answer"}
        </button>
      </div>

      <VoiceAnswerForm
        textValue={textValue}
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
