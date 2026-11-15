"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

function Layer1Section() {
  return (
    <section
      aria-labelledby="layer1-title"
      data-testid="consent-layer1-section"
      className="space-y-4 rounded-2xl border border-border-hairline bg-surface-card p-5 sm:p-6"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-sage text-xs font-bold text-white"
        >
          1
        </span>
        <h2 id="layer1-title" className="font-display text-lg font-semibold text-ink-primary">
          Taking part in check-ins (required)
        </h2>
      </div>

      <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
        What the service does:
      </p>

      <ul className="space-y-2 text-sm text-ink-secondary">
        <li className="flex items-start gap-2">
          <span className="text-accent-sage">•</span>
          <span>Short check-ins twice a week (takes about 20 seconds).</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-accent-sage">•</span>
          <span>Questionnaire totals and their changes go to your clinic.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-accent-sage">•</span>
          <span>A nurse may call you if answers stay low or stop.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-accent-sage">•</span>
          <span>Immediate crisis support is always visible and available.</span>
        </li>
      </ul>

      <p className="text-xs text-ink-muted">
        To use Cepheus, agree to take part below.
      </p>
    </section>
  );
}

interface Layer2SectionProps {
  ringRhythm: boolean;
  setRingRhythm: (val: boolean) => void;
  cameraExpressivity: boolean;
  setCameraExpressivity: (val: boolean) => void;
  homeRoutine: boolean;
  setHomeRoutine: (val: boolean) => void;
  facialMovementUsualRange: boolean;
  setFacialMovementUsualRange: (val: boolean) => void;
}

function Layer2Section({
  ringRhythm,
  setRingRhythm,
  cameraExpressivity,
  setCameraExpressivity,
  homeRoutine,
  setHomeRoutine,
  facialMovementUsualRange,
  setFacialMovementUsualRange,
}: Layer2SectionProps) {
  return (
    <section
      aria-labelledby="layer2-title"
      data-testid="consent-layer2-section"
      className="space-y-4 rounded-2xl border border-border-hairline bg-surface-card p-5 sm:p-6"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-ink-secondary"
        >
          2
        </span>
        <h2 id="layer2-title" className="font-display text-lg font-semibold text-ink-primary">
          Optional measuring methods
        </h2>
      </div>

      <p className="text-xs text-ink-muted">
        Optional. All off by default. Switch on only what you wish to try.
      </p>

      <div className="space-y-3">
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-border-hairline bg-surface-subtle/60 p-3 transition hover:border-border-tactile hover:bg-surface-subtle">
          <input
            type="checkbox"
            data-testid="checkbox-layer2-ring"
            checked={ringRhythm}
            onChange={(e) => setRingRhythm(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-tactile text-accent-sage focus:ring-accent-sage"
          />
          <span className="text-xs leading-relaxed text-ink-primary">
            <strong className="block font-medium">Ring rhythm:</strong>
            Measures daily sleep regularity and activity rhythm. Only derived numbers are stored.
          </span>
        </label>

        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-border-hairline bg-surface-subtle/60 p-3 transition hover:border-border-tactile hover:bg-surface-subtle">
          <input
            type="checkbox"
            data-testid="checkbox-layer2-camera"
            checked={cameraExpressivity}
            onChange={(e) => setCameraExpressivity(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-tactile text-accent-sage focus:ring-accent-sage"
          />
          <span className="text-xs leading-relaxed text-ink-primary">
            <strong className="block font-medium">Camera check:</strong>
            Measures facial expressivity during check-in. Video never leaves your phone, only summary numbers are saved.
          </span>
        </label>

        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-border-hairline bg-surface-subtle/60 p-3 transition hover:border-border-tactile hover:bg-surface-subtle">
          <input
            type="checkbox"
            data-testid="checkbox-facial-movement-usual-range"
            checked={facialMovementUsualRange}
            onChange={(e) => setFacialMovementUsualRange(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-tactile text-accent-sage focus:ring-accent-sage"
          />
          <span className="text-xs leading-relaxed text-ink-primary">
            <strong className="block font-medium">Facial movement range comparison:</strong>
            Let my clinic see how my facial movement in the camera check compares with my own usual range (optional, research potential).
          </span>
        </label>

        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-border-hairline bg-surface-subtle/60 p-3 transition hover:border-border-tactile hover:bg-surface-subtle">
          <input
            type="checkbox"
            data-testid="checkbox-layer2-home"
            checked={homeRoutine}
            onChange={(e) => setHomeRoutine(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-tactile text-accent-sage focus:ring-accent-sage"
          />
          <span className="text-xs leading-relaxed text-ink-primary">
            <strong className="block font-medium">Home routine:</strong>
            Measures coarse weekly routine patterns. Only summary counts are stored.
          </span>
        </label>
      </div>
    </section>
  );
}

interface Layer3SectionProps {
  detailedAnswers: boolean;
  setDetailedAnswers: (val: boolean) => void;
}

function Layer3Section({ detailedAnswers, setDetailedAnswers }: Layer3SectionProps) {
  return (
    <section
      aria-labelledby="layer3-title"
      data-testid="consent-layer3-section"
      className="space-y-4 rounded-2xl border border-border-hairline bg-surface-card p-5 sm:p-6"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-ink-secondary"
        >
          3
        </span>
        <h2 id="layer3-title" className="font-display text-lg font-semibold text-ink-primary">
          Detailed answers (optional)
        </h2>
      </div>

      <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-border-hairline bg-surface-subtle/60 p-3.5 transition hover:border-border-tactile hover:bg-surface-subtle">
        <input
          type="checkbox"
          data-testid="checkbox-layer3-detailed-answers"
          checked={detailedAnswers}
          onChange={(e) => setDetailedAnswers(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-tactile text-accent-sage focus:ring-accent-sage"
        />
        <div className="space-y-1.5 text-xs leading-relaxed text-ink-primary">
          <span className="block font-semibold">
            Keep my individual answers so the service can learn what helps me.
          </span>
          <p className="text-ink-secondary">
            Kept on the service&apos;s server in the EU, never on this phone.
            Only your own answers from now on. Kept so it can be used for
            personalisation later.
          </p>
          <p className="text-ink-secondary">
            You can withdraw this at any time, and withdrawing deletes what
            was kept.
          </p>
        </div>
      </label>
    </section>
  );
}

export function ConsentScreen() {
  const router = useRouter();
  const [ringRhythm, setRingRhythm] = useState(false);
  const [cameraExpressivity, setCameraExpressivity] = useState(false);
  const [facialMovementUsualRange, setFacialMovementUsualRange] = useState(false);
  const [homeRoutine, setHomeRoutine] = useState(false);
  const [detailedAnswers, setDetailedAnswers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          takingPart: true,
          methods: {
            ring_rhythm: ringRhythm,
            camera_expressivity: cameraExpressivity,
            home_routine: homeRoutine,
            facial_movement_usual_range: facialMovementUsualRange,
          },
          detailedAnswers,
        }),
      });

      const json = (await res.json()) as { ok: boolean; redirectUrl?: string; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to save your consent choices.");
        setSubmitting(false);
        return;
      }

      router.push(json.redirectUrl ?? "/check-in");
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="consent-screen"
      className="mx-auto w-full max-w-xl space-y-8 px-4 py-6 sm:px-0"
    >
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-primary sm:text-3xl">
          Your consent choices
        </h1>
        <p className="text-sm leading-relaxed text-ink-secondary">
          Choose what you share with your clinic. You can change these choices
          anytime on your monitoring page.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Layer1Section />
        <Layer2Section
          ringRhythm={ringRhythm}
          setRingRhythm={setRingRhythm}
          cameraExpressivity={cameraExpressivity}
          setCameraExpressivity={setCameraExpressivity}
          homeRoutine={homeRoutine}
          setHomeRoutine={setHomeRoutine}
          facialMovementUsualRange={facialMovementUsualRange}
          setFacialMovementUsualRange={setFacialMovementUsualRange}
        />
        <Layer3Section
          detailedAnswers={detailedAnswers}
          setDetailedAnswers={setDetailedAnswers}
        />

        {error ? (
          <div
            role="alert"
            data-testid="consent-error-message"
            className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-950"
          >
            {error}
          </div>
        ) : null}

        <div className="space-y-4 pt-2">
          <button
            type="submit"
            data-testid="agree-taking-part-button"
            disabled={submitting}
            className="flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-xl bg-accent-sage px-6 py-3 font-display text-base font-semibold text-white shadow-sm transition hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-60"
          >
            {submitting ? "Saving choices..." : "I agree to take part"}
          </button>

          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <Link
              href="/privacy"
              data-testid="privacy-link"
              className="inline-flex min-h-[44px] items-center text-xs font-medium text-accent-sage hover:underline"
            >
              Read our full privacy notice →
            </Link>

            <span className="text-xs text-ink-muted">
              Emergency support is always available in the top bar.
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
