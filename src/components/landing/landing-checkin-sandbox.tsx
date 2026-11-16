"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SimulatedBadge } from "@/components/simulated-badge";
import { CHECK_IN_ITEMS } from "@/lib/constants";

const SCALE_VALUES = [0, 1, 2, 3, 4] as const;

interface OutcomeSummary {
  badge: string;
  headline: string;
  participantView: string;
  clinicView: string;
  tone: "steady" | "gentle" | "nurse" | "skipped";
}

function getSandboxOutcome(
  skipped: boolean,
  interest: number,
  energy: number
): OutcomeSummary {
  if (skipped) {
    return {
      badge: "Skipped without penalty",
      headline: "Recorded simply as skipped — never scored as zero",
      participantView:
        "No broken streaks or red warnings. Direct human crisis lines stay at the top of the page.",
      clinicView:
        "Logged as missed. Only repeated unanswered rounds while a wearable stays active raise a nurse check-in.",
      tone: "skipped",
    };
  }

  const total = interest + energy;
  if (total >= 6) {
    return {
      badge: "Steady week",
      headline: "Steady week — Cepheus stays quiet",
      participantView:
        "Close to your own post-TMS baseline. Nothing extra is asked at home today.",
      clinicView: "No clinic flag raised. Routine outer-loop monitoring continues.",
      tone: "steady",
    };
  }

  if (total >= 3) {
    return {
      badge: "Single mild dip",
      headline: "One optional small step at home",
      participantView:
        "Shows one gentle suggestion, such as “Take a 10-minute walk outside”, with no scores or graphs.",
      clinicView:
        "A single heavier round stays privately with the participant rather than raising a clinic alarm.",
      tone: "gentle",
    };
  }

  return {
    badge: "Sustained shift threshold",
    headline: "If this holds across two rounds, a nurse calls",
    participantView:
      "Follow-up moves to a human phone call from your TMS clinic nurse, never an automated bot.",
    clinicView:
      "Sustained drop below personal baseline raises a broad-area follow-up flag for the clinic nurse.",
    tone: "nurse",
  };
}

export function LandingDemoLaunchActions({
  isPrimaryCard = false,
}: {
  isPrimaryCard?: boolean;
}) {
  const router = useRouter();
  const { signIn, secondFactor } = useAuth();
  const [pendingRole, setPendingRole] = useState<"patient" | "nurse" | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handlePatientDemo() {
    setErrorMessage(null);
    setPendingRole("patient");
    const result = await signIn({
      mode: "patient_eid",
      participantCode: "P-SIM-001",
    });
    setPendingRole(null);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }
    router.refresh();
  }

  async function handleNurseDemo() {
    setErrorMessage(null);
    if (secondFactor === "time_based") {
      router.push("/sign-in");
      return;
    }
    setPendingRole("nurse");
    const result = await signIn({
      mode: "staff",
      email: "nurse@sim-clinic.local",
      password: "cepheus-local-only",
      totpCode: "123456",
    });
    setPendingRole(null);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }
    router.push("/clinic");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/sign-in"
          data-testid={
            isPrimaryCard ? "landing-sign-in-link" : "hero-sign-in-link"
          }
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-sage px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
        >
          Sign in to Cepheus
        </Link>

        <button
          type="button"
          data-testid={
            isPrimaryCard ? undefined : "landing-demo-patient"
          }
          onClick={handlePatientDemo}
          disabled={pendingRole !== null}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-tactile bg-surface-card px-4 py-2.5 text-sm font-medium text-ink-primary transition hover:bg-surface-subtle disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
        >
          {pendingRole === "patient" ? "Opening..." : "Try participant view"}
        </button>

        <button
          type="button"
          data-testid={isPrimaryCard ? undefined : "landing-demo-nurse"}
          onClick={handleNurseDemo}
          disabled={pendingRole !== null}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-tactile bg-surface-card px-4 py-2.5 text-sm font-medium text-ink-primary transition hover:bg-surface-subtle disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
        >
          {pendingRole === "nurse" ? "Opening..." : "Try clinic nurse view"}
        </button>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-urgent-border bg-rose-urgent-bg px-3.5 py-2 text-sm text-rose-urgent-ink"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

interface ScaleRowProps {
  label: string;
  lowLabel: string;
  highLabel: string;
  value: number;
  disabled: boolean;
  onChange: (next: number) => void;
}

function ScaleRow({
  label,
  lowLabel,
  highLabel,
  value,
  disabled,
  onChange,
}: ScaleRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink-primary">{label}</span>
        <span className="tabular-nums text-xs text-ink-muted">
          0 {lowLabel} · 4 {highLabel}
        </span>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {SCALE_VALUES.map((num) => {
          const isSelected = !disabled && value === num;
          return (
            <button
              key={num}
              type="button"
              onClick={() => onChange(num)}
              aria-pressed={isSelected}
              className={`tabular-nums inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
                isSelected
                  ? "border-accent-sage bg-accent-sage text-white"
                  : "border-border-tactile bg-surface-card text-ink-primary hover:bg-surface-subtle"
              }`}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LandingCheckInSandbox() {
  const [mood, setMood] = useState<number>(3);
  const [interest, setInterest] = useState<number>(2);
  const [skipped, setSkipped] = useState<boolean>(false);

  const moodItem = CHECK_IN_ITEMS[0];
  const interestItem = CHECK_IN_ITEMS[1];
  const outcome = getSandboxOutcome(skipped, interest, mood);

  const outcomeToneClass =
    outcome.tone === "nurse"
      ? "border-amber-notice-border bg-amber-notice-bg"
      : outcome.tone === "gentle"
        ? "border-accent-sage-border bg-accent-sage-soft"
        : "border-border-hairline bg-surface-subtle";

  return (
    <section
      data-testid="landing-checkin-sandbox"
      aria-label="Interactive 20-second check-in preview"
      className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-xs sm:p-7"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SimulatedBadge subtitle="Interactive preview · Not saved" />
          <span className="tabular-nums text-xs text-ink-muted">~20 sec</span>
        </div>

        <div className="space-y-4">
          <ScaleRow
            label={moodItem.prompt}
            lowLabel={moodItem.lowAnchor}
            highLabel={moodItem.highAnchor}
            value={mood}
            disabled={skipped}
            onChange={(next) => {
              setSkipped(false);
              setMood(next);
            }}
          />

          <ScaleRow
            label={interestItem.prompt}
            lowLabel={interestItem.lowAnchor}
            highLabel={interestItem.highAnchor}
            value={interest}
            disabled={skipped}
            onChange={(next) => {
              setSkipped(false);
              setInterest(next);
            }}
          />

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setSkipped((prev) => !prev)}
              aria-pressed={skipped}
              className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
                skipped
                  ? "border-accent-sage bg-accent-sage-soft text-ink-primary"
                  : "border-border-hairline bg-surface-subtle text-ink-secondary hover:bg-surface-muted"
              }`}
            >
              Not today
            </button>
          </div>
        </div>

        <div className={`rounded-xl border p-4 space-y-2.5 ${outcomeToneClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-primary">
              {outcome.badge}
            </span>
            <span className="text-xs text-ink-muted">
              Compared with personal baseline
            </span>
          </div>
          <p className="font-display text-lg font-semibold text-ink-primary">
            {outcome.headline}
          </p>
          <dl className="space-y-1.5 text-xs leading-relaxed text-ink-secondary">
            <div>
              <dt className="inline font-semibold text-ink-primary">
                Participant sees:{" "}
              </dt>
              <dd className="inline">{outcome.participantView}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-ink-primary">
                Clinic sees:{" "}
              </dt>
              <dd className="inline">{outcome.clinicView}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
