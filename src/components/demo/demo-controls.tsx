"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SimulatedBadge } from "@/components/simulated-badge";

interface SimulatedPatientSummary {
  readonly id: string;
  readonly participantCode: string;
  readonly label: string;
  readonly missedRoundsCount: number;
  readonly openWarnings: readonly string[];
}

interface DemoSwitches {
  readonly rewards: boolean;
  readonly counters: boolean;
  readonly extraQuestion: boolean;
}

interface DemoState {
  readonly ok: boolean;
  readonly isSimulated: true;
  readonly now: string;
  readonly offsetDays: number;
  readonly offsetMs: number;
  readonly switches: DemoSwitches;
  readonly patients: readonly SimulatedPatientSummary[];
}

function ClockSection({
  state,
  isPending,
  onAdvance,
  onReset,
}: {
  state: DemoState;
  isPending: boolean;
  onAdvance: (days: number) => void;
  onReset: () => void;
}) {
  const formattedDate = new Date(state.now).toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <section
      aria-labelledby="demo-clock-heading"
      className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="demo-clock-heading"
            className="font-display text-xl font-semibold tracking-tight text-ink-primary"
          >
            Demo clock &amp; time machine
          </h2>
          <p className="text-xs text-ink-secondary">
            Time moves forward only. Advancing closes elapsed rounds and runs the warning rule for simulated patients.
          </p>
        </div>
        <SimulatedBadge subtitle="Simulated calendar" />
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-3 rounded-xl border border-border-hairline bg-surface-subtle p-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
          Current Demo Time:
        </span>
        <span data-testid="current-demo-date" className="font-mono text-base font-semibold text-ink-primary">
          {formattedDate}
        </span>
        <span
          data-testid="current-demo-offset"
          className="rounded-full bg-accent-sage/15 px-2.5 py-0.5 text-xs font-medium text-accent-sage"
        >
          +{state.offsetDays} days ({Math.round((state.offsetMs / 86400000) * 10) / 10} d)
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="btn-advance-1d"
          disabled={isPending}
          onClick={() => onAdvance(1)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border-hairline bg-surface-subtle px-4 py-2.5 text-sm font-semibold text-ink-primary hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50"
        >
          +1 day
        </button>
        <button
          type="button"
          data-testid="btn-advance-3d"
          disabled={isPending}
          onClick={() => onAdvance(3)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border-hairline bg-surface-subtle px-4 py-2.5 text-sm font-semibold text-ink-primary hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50"
        >
          +3 days
        </button>
        <button
          type="button"
          data-testid="btn-advance-1w"
          disabled={isPending}
          onClick={() => onAdvance(7)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border-hairline bg-surface-subtle px-4 py-2.5 text-sm font-semibold text-ink-primary hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50"
        >
          +1 week
        </button>
        <button
          type="button"
          data-testid="btn-advance-2w"
          disabled={isPending}
          onClick={() => onAdvance(14)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-accent-sage px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-sage/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50"
        >
          +2 weeks
        </button>

        <div className="my-1 h-6 w-px bg-border-hairline" />

        <button
          type="button"
          data-testid="btn-reset-demo"
          disabled={isPending}
          onClick={onReset}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-950 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
        >
          Reset
        </button>
      </div>
    </section>
  );
}

function SwitchCard({
  title,
  description,
  statusKey,
  status,
  isPending,
  onToggle,
}: {
  title: string;
  description: string;
  statusKey: string;
  status: boolean;
  isPending: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border-hairline bg-surface-subtle p-4">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-primary">{title}</span>
          <span
            data-testid={`switch-status-${statusKey}`}
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              status ? "bg-emerald-100 text-emerald-900" : "bg-zinc-200 text-zinc-700"
            }`}
          >
            {status ? "ON" : "OFF"}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-secondary">{description}</p>
      </div>
      <button
        type="button"
        data-testid={`switch-toggle-${statusKey}`}
        disabled={isPending}
        onClick={onToggle}
        className="mt-4 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border-hairline bg-surface-card px-3 py-2 text-xs font-semibold text-ink-primary hover:bg-surface-subtle disabled:opacity-50"
      >
        Toggle {title.toLowerCase()}
      </button>
    </div>
  );
}

function SwitchesSection({
  switches,
  isPending,
  onToggle,
}: {
  switches: DemoSwitches;
  isPending: boolean;
  onToggle: (key: keyof DemoSwitches, val: boolean) => void;
}) {
  return (
    <section
      aria-labelledby="demo-switches-heading"
      className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-sm"
    >
      <h2
        id="demo-switches-heading"
        className="font-display text-xl font-semibold tracking-tight text-ink-primary"
      >
        Runtime switches
      </h2>
      <p className="mt-1 text-xs text-ink-secondary">
        Changeable while the server runs. Resets to environment defaults on Reset.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <SwitchCard
          title="Rewards"
          description="Simulated rewards for check-ins and tasks (D48)."
          statusKey="rewards"
          status={switches.rewards}
          isPending={isPending}
          onToggle={() => onToggle("rewards", !switches.rewards)}
        />
        <SwitchCard
          title="Counters"
          description="Count of walks (D38) and answered rounds (D42)."
          statusKey="counters"
          status={switches.counters}
          isPending={isPending}
          onToggle={() => onToggle("counters", !switches.counters)}
        />
        <SwitchCard
          title="Extra Question"
          description="Rotating experimental question on 0-4 scale (D25)."
          statusKey="extra"
          status={switches.extraQuestion}
          isPending={isPending}
          onToggle={() => onToggle("extraQuestion", !switches.extraQuestion)}
        />
      </div>
    </section>
  );
}

function PatientsSection({ patients }: { patients: readonly SimulatedPatientSummary[] }) {
  return (
    <section
      aria-labelledby="simulated-patients-heading"
      className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="simulated-patients-heading"
            className="font-display text-xl font-semibold tracking-tight text-ink-primary"
          >
            Simulated patients overview
          </h2>
          <p className="text-xs text-ink-secondary">What clinic staff currently see for each sample patient.</p>
        </div>
        <Link
          href="/clinic"
          data-testid="link-to-clinic-all"
          className="inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-xs font-semibold text-accent-sage hover:underline"
        >
          Open Clinic View →
        </Link>
      </div>

      <div className="mt-4 divide-y divide-border-hairline">
        {patients.map((patient) => {
          const hasSilence = patient.openWarnings.includes("silence");
          return (
            <div
              key={patient.id}
              data-testid={`patient-line-${patient.participantCode}`}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-ink-primary">{patient.participantCode}</span>
                  <span className="text-xs text-ink-secondary">· {patient.label}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    data-testid={`missed-rounds-${patient.participantCode}`}
                    className="rounded bg-surface-subtle px-2 py-0.5 font-medium text-ink-secondary"
                  >
                    Missed rounds: {patient.missedRoundsCount}
                  </span>

                  {patient.openWarnings.length > 0 ? (
                    <span
                      data-testid={`warning-tag-${patient.participantCode}`}
                      className={`rounded px-2 py-0.5 font-semibold ${
                        hasSilence
                          ? "border border-amber-300 bg-amber-50 text-amber-950"
                          : "border border-rose-300 bg-rose-50 text-rose-950"
                      }`}
                    >
                      Clinic warning: {patient.openWarnings.join(", ")}
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">
                      No warnings
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/check-in"
                  data-testid={`link-check-in-${patient.participantCode}`}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border-hairline bg-surface-subtle px-3 py-2 text-xs font-medium text-ink-primary hover:bg-surface-card"
                >
                  Check-in
                </Link>
                <Link
                  href="/clinic"
                  data-testid={`link-clinic-${patient.participantCode}`}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border-hairline bg-surface-subtle px-3 py-2 text-xs font-medium text-ink-primary hover:bg-surface-card"
                >
                  Clinic
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DemoControls() {
  const [state, setState] = useState<DemoState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const fetchState = async () => {
    try {
      const res = await fetch("/api/demo", { headers: { accept: "application/json" } });
      if (res.status === 401) {
        setErrorText("Please sign in to access demo controls.");
      } else if (res.status === 404) {
        setErrorText("Demo mode is currently disabled in this environment.");
      } else if (res.ok) {
        const data = await res.json();
        if (data.ok) setState(data);
      }
    } catch {
      setErrorText("Failed to connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const mutate = async (url: string, body?: unknown) => {
    setIsPending(true);
    setErrorText(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setState(data);
      } else {
        setErrorText(data.error ?? "Operation failed.");
      }
    } catch {
      setErrorText("Network request failed.");
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading) {
    return (
      <div data-testid="demo-loading" className="rounded-2xl border border-border-hairline bg-surface-subtle p-8 text-center text-sm text-ink-secondary">
        Loading demo controls...
      </div>
    );
  }

  if (errorText && !state) {
    return (
      <div role="alert" data-testid="demo-error" className="rounded-2xl border border-rose-300/80 bg-rose-50/90 p-6 text-sm text-rose-950">
        <p className="font-semibold">{errorText}</p>
      </div>
    );
  }

  if (!state) return null;

  return (
    <div className="space-y-8" data-testid="demo-controls-panel">
      {errorText ? (
        <div role="alert" className="rounded-xl border border-rose-300/80 bg-rose-50/90 p-3 text-xs font-medium text-rose-950">
          {errorText}
        </div>
      ) : null}

      <ClockSection
        state={state}
        isPending={isPending}
        onAdvance={(days) => mutate("/api/demo/advance", { days })}
        onReset={() => mutate("/api/demo/reset")}
      />

      <SwitchesSection
        switches={state.switches}
        isPending={isPending}
        onToggle={(key, val) => mutate("/api/demo/switch", { key, enabled: val })}
      />

      <PatientsSection patients={state.patients} />
    </div>
  );
}
