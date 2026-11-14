"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { DemoMomentKey } from "@/lib/constants";
import { SimulatedBadge } from "./simulated-badge";

export interface DemoMomentSummary {
  key: DemoMomentKey;
  buttonLabel: string;
  dayIndex: number;
  weekNumber: number;
  title: string;
  subtitle: string;
  recipient: "none" | "patient" | "clinic";
  checkInSummary: {
    latestRoundStatus: string;
    completedCount: number;
    missedOrSkippedCount: number;
    ringWornStatus: string;
    note: string;
  };
  patientViewSummary: {
    headline: string;
    actionTitle: string | null;
    actionDetail: string | null;
    note: string;
  };
  clinicViewSummary: {
    hasOpenFlag: boolean;
    sinceDate: string | null;
    broadAreaLabels: string[];
    ringActiveDuringSilence: boolean | null;
    recommendedActions: string[];
    note: string;
  };
}

export interface DemoTimelinePreviewProps {
  moments: DemoMomentSummary[];
  initialMoment?: DemoMomentKey;
}

function ActiveMomentPanel({ active }: { active: DemoMomentSummary }) {
  return (
    <div
      id={`moment-panel-${active.key}`}
      role="tabpanel"
      aria-labelledby={`moment-tab-${active.key}`}
      data-testid={`moment-panel-${active.key}`}
      className="mt-8 border-t border-border-hairline pt-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold text-ink-primary sm:text-2xl">
            {active.title}{" "}
            <span className="tabular-nums text-sm font-medium text-ink-muted">
              (Day {active.dayIndex})
            </span>
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
            {active.subtitle}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-hairline bg-surface-subtle px-3.5 py-1 text-xs font-medium text-ink-secondary">
          What happens:{" "}
          <strong className="font-semibold text-ink-primary">
            {active.recipient === "none"
              ? "Quiet week (nothing sent)"
              : active.recipient === "patient"
                ? "One small step for the patient"
                : "Flag for a nurse phone call"}
          </strong>
        </span>
      </div>

      <div className="mt-7 grid grid-cols-1 divide-y divide-border-hairline border-t border-border-hairline lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {/* Column 1: Twice-weekly Check-in & Ring Rhythm */}
        <div className="flex flex-col justify-between py-6 lg:pr-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display text-lg font-semibold text-ink-primary">
                Check-in &amp; rhythm
              </h4>
              <Link
                href="/check-in"
                className="inline-flex min-h-11 items-center text-xs font-semibold text-accent-sage hover:underline"
              >
                Open check-in &rarr;
              </Link>
            </div>
            <p className="mt-2 text-sm font-medium text-ink-primary">
              Latest status: {active.checkInSummary.latestRoundStatus}
            </p>
            <p className="mt-1.5 text-xs text-ink-secondary">
              {active.checkInSummary.ringWornStatus}
            </p>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">
            {active.checkInSummary.note}
          </p>
        </div>

        {/* Column 2: Patient View (Low-effort step, zero scores/streaks) */}
        <div className="flex flex-col justify-between py-6 lg:px-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display text-lg font-semibold text-ink-primary">
                Patient view
              </h4>
              <Link
                href="/patient"
                className="inline-flex min-h-11 items-center text-xs font-semibold text-accent-sage hover:underline"
              >
                Open patient view &rarr;
              </Link>
            </div>
            <p className="mt-2 text-sm font-medium text-ink-primary">
              {active.patientViewSummary.headline}
            </p>
            {active.patientViewSummary.actionTitle ? (
              <div className="mt-2.5 rounded-lg border border-accent-sage-border bg-accent-sage-soft/70 px-3.5 py-2.5">
                <p className="text-xs font-semibold text-accent-sage-hover">
                  {active.patientViewSummary.actionTitle}
                </p>
                {active.patientViewSummary.actionDetail ? (
                  <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                    {active.patientViewSummary.actionDetail}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">
            {active.patientViewSummary.note}
          </p>
        </div>

        {/* Column 3: Clinic View (Broad life areas only) */}
        <div className="flex flex-col justify-between py-6 lg:pl-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display text-lg font-semibold text-ink-primary">
                Clinic view
              </h4>
              <Link
                href="/clinic"
                className="inline-flex min-h-11 items-center text-xs font-semibold text-accent-sage hover:underline"
              >
                Open clinic view &rarr;
              </Link>
            </div>
            {active.clinicViewSummary.hasOpenFlag ? (
              <>
                <p className="mt-2 text-sm font-medium text-ink-primary">
                  Broad-area check-in flag since{" "}
                  <span className="tabular-nums">
                    {active.clinicViewSummary.sinceDate}
                  </span>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {active.clinicViewSummary.broadAreaLabels.map((area) => (
                    <span
                      key={area}
                      className="rounded-md border border-border-hairline bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-primary"
                    >
                      {area}
                    </span>
                  ))}
                </div>
                {active.clinicViewSummary.ringActiveDuringSilence ? (
                  <p className="mt-2.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-950">
                    Smart ring remains worn during missed check-in rounds.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm font-medium text-ink-primary">
                No clinic outreach needed
              </p>
            )}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">
            {active.clinicViewSummary.note}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DemoTimelinePreview({
  moments,
  initialMoment = "small_dip",
}: DemoTimelinePreviewProps) {
  const [selectedKey, setSelectedKey] = useState<DemoMomentKey>(initialMoment);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const active = moments.find((m) => m.key === selectedKey) ?? moments[0];

  if (!active) {
    return null;
  }

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIdx = (idx + delta + moments.length) % moments.length;
    const nextMoment = moments[nextIdx];
    if (nextMoment) {
      setSelectedKey(nextMoment.key);
      tabRefs.current[nextIdx]?.focus();
    }
  }

  return (
    <section
      aria-label="Interactive post-TMS demo timeline"
      data-testid="demo-timeline-preview"
      className="rounded-2xl border border-border-hairline bg-surface-card p-6 sm:p-10"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-primary sm:text-3xl">
            Eight weeks after TMS: three moments
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            Pick a week below to see what the patient sees on their phone and
            what the clinic nurse sees on theirs.
          </p>
        </div>
        <SimulatedBadge
          subtitle={`Day ${active.dayIndex} · Week ${active.weekNumber}`}
          className="shrink-0"
        />
      </div>

      {/* 3 Moment Switcher Tabs */}
      <div
        role="tablist"
        aria-label="Select demo moment"
        className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {moments.map((moment, idx) => {
          const isSelected = moment.key === active.key;
          const dotColor =
            moment.recipient === "none"
              ? "bg-emerald-600"
              : moment.recipient === "patient"
                ? "bg-amber-600"
                : "bg-rose-600";

          return (
            <button
              key={moment.key}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={`moment-tab-${moment.key}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`moment-panel-${moment.key}`}
              tabIndex={isSelected ? 0 : -1}
              data-testid={`moment-${moment.key}`}
              onClick={() => setSelectedKey(moment.key)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`group relative flex min-h-12 flex-col items-start rounded-xl border px-4 py-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer ${
                isSelected
                  ? "border-accent-sage bg-accent-sage text-white"
                  : "border-border-hairline bg-surface-subtle text-ink-primary hover:border-border-tactile hover:bg-surface-card"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className={`tabular-nums text-xs font-medium ${
                    isSelected ? "text-white/85" : "text-ink-muted"
                  }`}
                >
                  {moment.buttonLabel}
                </span>
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${
                    isSelected ? "bg-white" : dotColor
                  }`}
                />
              </div>
              <span className="mt-1.5 text-sm font-semibold leading-snug">
                {moment.title}
              </span>
            </button>
          );
        })}
      </div>

      <ActiveMomentPanel active={active} />
    </section>
  );
}
