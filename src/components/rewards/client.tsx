"use client";

import React, { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskKey, SmallTask } from "@/domain/small-tasks/types";

export function TodayTaskCard({
  task,
  status,
  reason,
  alreadyRewardedToday,
}: {
  task?: SmallTask;
  status?: "offered" | "completed" | "not_today";
  reason?: "check_in_day";
  alreadyRewardedToday?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

  if (reason === "check_in_day") {
    return (
      <section className="rounded-2xl border border-accent-sage-border bg-surface-card p-7 sm:p-10" aria-label="Today's task">
        <p className="text-base leading-relaxed text-ink-secondary">
          Today is a check-in day. No extra small task is offered today, so you can focus on the check-in.
        </p>
      </section>
    );
  }

  if (!task) {
    return null;
  }

  const isCompleted = status === "completed";
  const isNotToday = status === "not_today";

  const handleDone = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/rewards/task/done", { method: "POST" });
        if (!res.ok) {
          setActionError("It could not be saved and nothing was lost.");
        } else {
            router.refresh();
        }
      } catch {
        setActionError("It could not be saved and nothing was lost.");
      }
    });
  };

  const handleNotToday = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/rewards/task/not-today", { method: "POST" });
        if (!res.ok) {
          setActionError("It could not be saved and nothing was lost.");
        } else {
            router.refresh();
        }
      } catch {
        setActionError("It could not be saved and nothing was lost.");
      }
    });
  };

  return (
    <section className="rounded-2xl border border-accent-sage-border bg-surface-card p-7 sm:p-10" aria-label="Today's small task">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-primary mb-2">
        {task.title}
      </h2>
      <p className="text-base leading-relaxed text-ink-secondary mb-6">
        {task.detail}
      </p>

      {actionError && (
        <div className="rounded-xl border border-border-hairline bg-surface-subtle px-4 py-3.5 text-sm font-medium text-ink-secondary mb-4" role="status">
          {actionError}
        </div>
      )}

      {isCompleted && (
        <div className="rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 px-4 py-3.5 text-sm font-medium text-accent-sage-hover" role="status">
          Done. {alreadyRewardedToday ? "" : "The reward has been added."}
        </div>
      )}

      {isNotToday && (
        <div className="rounded-xl border border-border-hairline bg-surface-subtle px-4 py-3.5 text-sm font-medium text-ink-secondary mb-6" role="status">
          Noted. Nothing is lost.
        </div>
      )}

      {!isCompleted && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={handleDone}
            aria-label="Done"
            className="min-h-12 rounded-xl px-6 py-3 text-sm font-semibold bg-accent-sage text-white hover:bg-accent-sage-hover transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Done
          </button>
          {!isNotToday && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleNotToday}
              aria-label="Not today"
              className="min-h-12 rounded-xl border border-border-tactile bg-surface-subtle px-6 py-3 text-sm font-medium text-ink-secondary hover:bg-surface-muted hover:text-ink-primary transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Not today
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function PreferencesForm({
  allTasks,
  initialPreferred,
}: {
  allTasks: SmallTask[];
  initialPreferred: TaskKey[];
}) {
  const [preferred, setPreferred] = useState<TaskKey[]>(initialPreferred);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleToggle = (key: TaskKey) => {
    setErrorMessage(null);
    const previous = preferred;
    const updated = preferred.includes(key)
      ? preferred.filter((k) => k !== key)
      : [...preferred, key];
    setPreferred(updated);
    startTransition(async () => {
      try {
        const res = await fetch("/api/rewards/preferences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preferredTaskKeys: updated })
        });
        if (!res.ok) {
          setPreferred(previous);
          setErrorMessage("It could not be saved and nothing was lost.");
        } else {
            router.refresh();
        }
      } catch {
        setPreferred(previous);
        setErrorMessage("It could not be saved and nothing was lost.");
      }
    });
  };

  return (
    <section aria-label="What I'd like to be offered">
      <h3 className="font-display text-xl font-semibold tracking-tight text-ink-primary mb-4">
        What I&apos;d like to be offered
      </h3>
      {errorMessage && (
        <div className="rounded-xl border border-border-hairline bg-surface-subtle px-4 py-3.5 text-sm font-medium text-ink-secondary mb-4" role="status">
          {errorMessage}
        </div>
      )}
      {preferred.length === 0 && (
        <p className="text-sm text-ink-secondary mb-4">
          No tasks selected. The short walk is offered by default.
        </p>
      )}
      <div className="space-y-3">
        {allTasks.map((task) => (
          <label
            key={task.key}
            htmlFor={`pref-${task.key}`}
            className={`min-h-[44px] flex items-center gap-3 p-3 rounded-lg border ${
              preferred.includes(task.key)
                ? "border-accent-sage bg-accent-sage-soft/30"
                : "border-border-hairline bg-surface-card"
            } cursor-pointer hover:bg-surface-subtle transition-colors`}
          >
            <input
              id={`pref-${task.key}`}
              type="checkbox"
              aria-label={task.title}
              className="w-5 h-5 rounded border-border-tactile text-accent-sage focus:ring-accent-sage cursor-pointer disabled:opacity-50"
              checked={preferred.includes(task.key)}
              onChange={() => handleToggle(task.key)}
              disabled={isPending}
            />
            <span className="flex-1 text-sm font-medium text-ink-primary">
              {task.title}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

export function PayoutSection({
  balanceCents,
  payoutThresholdCents,
  payoutAvailable,
}: {
  balanceCents: number;
  payoutThresholdCents: number;
  payoutAvailable: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [payoutRequested, setPayoutRequested] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const router = useRouter();

  const handlePayout = () => {
    if (isPending || payoutRequested) return;
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/rewards/payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: clientRequestId }),
        });
        if (!res.ok) {
          setErrorMessage("It could not be saved and nothing was lost.");
          return;
        }
        setPayoutRequested(true);
        router.refresh();
      } catch {
        setErrorMessage("It could not be saved and nothing was lost.");
      }
    });
  };

  return (
    <div className="mt-6">
      {errorMessage && (
        <div className="rounded-xl border border-border-hairline bg-surface-subtle px-4 py-3.5 text-sm font-medium text-ink-secondary mb-4" role="status">
          {errorMessage}
        </div>
      )}
      {!payoutAvailable && balanceCents < payoutThresholdCents && (
        <div className="space-y-1">
          <p className="text-sm text-ink-secondary">
            A payout can be requested from 10 euros.
          </p>
          <p className="text-sm text-ink-secondary">
            Amounts and payouts are simulated in this demonstration and no real money is paid.
          </p>
        </div>
      )}
      {payoutAvailable && !payoutRequested && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            disabled={isPending || payoutRequested}
            onClick={handlePayout}
            aria-label="Request payout"
            className="min-h-12 rounded-xl px-6 py-3 text-sm font-semibold bg-accent-sage text-white hover:bg-accent-sage-hover transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Request Payout
          </button>
          <p className="text-sm text-ink-secondary">
            Amounts and payouts are simulated in this demonstration and no real money is paid.
          </p>
        </div>
      )}
      {payoutRequested && (
        <p className="text-sm font-medium text-accent-sage-hover" role="status">
          Simulated payout requested. No real money is paid in this demonstration.
        </p>
      )}
    </div>
  );
}