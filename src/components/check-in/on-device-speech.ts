/**
 * On-device speech recognition detection and adapter interface.
 *
 * Rules enforced:
 * - Feature-detects on-device Web Speech API: `processLocally = true`
 *   and static `SpeechRecognition.available({ langs, processLocally: true })`.
 * - If the browser cannot confirm on-device recognition, speech recognition
 *   is marked unavailable and never falls back to cloud recognition.
 * - Raw transcripts and audio are never stored on device or sent anywhere;
 *   they are parsed immediately by pure deterministic logic and dropped.
 * - Placed behind a small interface so tests can fake it cleanly.
 */

export interface SpeechRecognitionCallbacks {
  readonly onResult: (transcript: string) => void;
  readonly onError?: (error: unknown) => void;
  readonly onEnd?: () => void;
}

export interface SpeechRecognitionController {
  readonly stop: () => void;
  readonly abort: () => void;
}

export interface OnDeviceSpeechRecognizer {
  isAvailable(): Promise<boolean>;
  startListening(callbacks: SpeechRecognitionCallbacks): SpeechRecognitionController;
}

export interface SpeechRecognitionEventLike {
  readonly results?: {
    [index: number]: {
      [index: number]: {
        readonly transcript?: string;
      };
    };
  };
}

export interface SpeechRecognitionErrorEventLike {
  readonly error?: unknown;
}

export interface SpeechRecognitionInstanceLike {
  processLocally: boolean;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionInstanceLike;
  available?: (options: {
    langs?: readonly string[];
    processLocally?: boolean;
  }) => Promise<unknown>;
}

interface WindowWithSpeech {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  __CEPHEUS_SPEECH_RECOGNIZER__?: OnDeviceSpeechRecognizer;
}

export class WebSpeechOnDeviceRecognizer implements OnDeviceSpeechRecognizer {
  private checkedAvailability: boolean | null = null;

  async isAvailable(): Promise<boolean> {
    if (this.checkedAvailability !== null) {
      return this.checkedAvailability;
    }

    if (typeof window === "undefined") {
      this.checkedAvailability = false;
      return false;
    }

    const win = window as unknown as WindowWithSpeech;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      this.checkedAvailability = false;
      return false;
    }

    // Static check for on-device recognition support
    if (typeof SpeechRecognitionClass.available !== "function") {
      this.checkedAvailability = false;
      return false;
    }

    try {
      const status = await SpeechRecognitionClass.available({
        langs: ["en-US", "en"],
        processLocally: true,
      });

      // Only confirm if local processing is explicitly available / ready
      const isConfirmed =
        status === true ||
        status === "available" ||
        status === "downloaded" ||
        (typeof status === "string" && status.toLowerCase().includes("available"));

      this.checkedAvailability = Boolean(isConfirmed);
      return this.checkedAvailability;
    } catch {
      this.checkedAvailability = false;
      return false;
    }
  }

  startListening(callbacks: SpeechRecognitionCallbacks): SpeechRecognitionController {
    if (typeof window === "undefined") {
      callbacks.onError?.(new Error("Window is not available"));
      return { stop: () => {}, abort: () => {} };
    }

    const win = window as unknown as WindowWithSpeech;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      callbacks.onError?.(new Error("Speech recognition not supported"));
      return { stop: () => {}, abort: () => {} };
    }

    try {
      const recognition = new SpeechRecognitionClass();
      // Enforce on-device processing strictly
      recognition.processLocally = true;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? "";
        callbacks.onResult(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        callbacks.onError?.(event?.error ?? event);
      };

      recognition.onend = () => {
        callbacks.onEnd?.();
      };

      recognition.start();

      return {
        stop: () => {
          try {
            recognition.stop();
          } catch {
            // ignore if already stopped
          }
        },
        abort: () => {
          try {
            recognition.abort();
          } catch {
            // ignore if already aborted
          }
        },
      };
    } catch (err) {
      callbacks.onError?.(err);
      return { stop: () => {}, abort: () => {} };
    }
  }
}

let activeRecognizer: OnDeviceSpeechRecognizer | null = null;

export function setOnDeviceSpeechRecognizer(recognizer: OnDeviceSpeechRecognizer | null): void {
  activeRecognizer = recognizer;
}

export function getOnDeviceSpeechRecognizer(): OnDeviceSpeechRecognizer {
  if (activeRecognizer) {
    return activeRecognizer;
  }
  if (typeof window !== "undefined") {
    const win = window as unknown as WindowWithSpeech;
    if (win.__CEPHEUS_SPEECH_RECOGNIZER__) {
      return win.__CEPHEUS_SPEECH_RECOGNIZER__;
    }
  }
  return new WebSpeechOnDeviceRecognizer();
}
