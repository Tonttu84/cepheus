"use client";

import { useState } from "react";
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

export function DemoTimelinePreview({
  moments,
  initialMoment = "small_dip",
}: DemoTimelinePreviewProps) {
  const [selectedKey, setSelectedKey] = useState<DemoMomentKey>(initialMoment);

  const active = moments.find((m) => m.key === selectedKey) ?? moments[0];

  if (!active) {
    return null;
  }

  return (
    <section
      aria-label="Interactive post-TMS demo timeline"
      data-testid="demo-timeline-preview"
      className="rounded-2xl border border-[#e4ddd2] bg-white p-6 shadow-xs sm:p-7"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#255748]">
            Interactive Trajectory
          </span>
          <h2 className="font-display mt-1 text-xl font-semibold tracking-tight text-[#1a2421] sm:text-2xl">
            8-Week Post-TMS Demo Trajectory
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#515d58]">
            Switch between three moments to see how the same dataset supports
            low-effort patient steps and broad-area clinic follow-up.
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
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {moments.map((moment, idx) => {
          const isSelected = moment.key === active.key;
          const dotColor =
            moment.recipient === "none"
              ? "bg-emerald-500"
              : moment.recipient === "patient"
                ? "bg-amber-500"
                : "bg-rose-500";

          return (
            <button
              key={moment.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              data-testid={`moment-${moment.key}`}
              onClick={() => setSelectedKey(moment.key)}
              className={`group relative flex flex-col items-start rounded-xl border px-4 py-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#255748] cursor-pointer ${
                isSelected
                  ? "border-[#255748] bg-[#255748] text-white shadow-sm"
                  : "border-[#e4ddd2] bg-[#faf8f5] text-[#1a2421] hover:border-[#c9c0b2] hover:bg-white"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className={`tabular-nums text-[11px] font-semibold uppercase tracking-wider ${
                    isSelected ? "text-white/80" : "text-[#697570]"
                  }`}
                >
                  0{idx + 1} · {moment.buttonLabel}
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

      {/* Active Moment Details */}
      <div
        data-testid={`moment-panel-${active.key}`}
        className="mt-5 rounded-xl border border-[#e4ddd2] bg-[#faf8f5]/80 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e4ddd2] pb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#1a2421]">
              {active.title}{" "}
              <span className="tabular-nums font-sans text-sm font-medium text-[#697570]">
                (Day {active.dayIndex})
              </span>
            </h3>
            <p className="mt-1 text-sm text-[#515d58]">{active.subtitle}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6cfc4] bg-white px-3 py-1 text-xs font-medium text-[#2d3b36]">
            Active loop:{" "}
            <strong className="font-semibold text-[#1a2421]">
              {active.recipient === "none"
                ? "Quiet baseline (no alert)"
                : active.recipient === "patient"
                  ? "Patient one-button step"
                  : "Clinic nurse outreach"}
            </strong>
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Column 1: Twice-weekly Check-in & Ring Rhythm */}
          <div className="flex flex-col justify-between rounded-xl border border-[#e4ddd2] bg-white p-4.5 shadow-2xs">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#697570]">
                  1 · Check-In &amp; Rhythm
                </span>
                <Link
                  href="/check-in"
                  className="text-xs font-semibold text-[#255748] hover:underline"
                >
                  Open check-in &rarr;
                </Link>
              </div>
              <p className="mt-3 text-sm font-semibold text-[#1a2421]">
                Latest status: {active.checkInSummary.latestRoundStatus}
              </p>
              <p className="mt-1.5 text-xs font-medium text-[#515d58]">
                {active.checkInSummary.ringWornStatus}
              </p>
            </div>
            <p className="mt-3 border-t border-[#f1ece4] pt-3 text-xs leading-relaxed text-[#515d58]">
              {active.checkInSummary.note}
            </p>
          </div>

          {/* Column 2: Patient View (Low-effort step, zero scores/streaks) */}
          <div className="flex flex-col justify-between rounded-xl border border-[#e4ddd2] bg-white p-4.5 shadow-2xs">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#697570]">
                  2 · Patient View
                </span>
                <Link
                  href="/patient"
                  className="text-xs font-semibold text-[#255748] hover:underline"
                >
                  Open patient view &rarr;
                </Link>
              </div>
              <p className="mt-3 text-sm font-semibold text-[#1a2421]">
                {active.patientViewSummary.headline}
              </p>
              {active.patientViewSummary.actionTitle ? (
                <div className="mt-3 rounded-lg border border-[#d6e4de] bg-[#eaf2ef]/70 p-3">
                  <p className="text-sm font-semibold text-[#1c4438]">
                    {active.patientViewSummary.actionTitle}
                  </p>
                  {active.patientViewSummary.actionDetail ? (
                    <p className="mt-1 text-xs leading-relaxed text-[#2d4a40]">
                      {active.patientViewSummary.actionDetail}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="mt-3 border-t border-[#f1ece4] pt-3 text-xs leading-relaxed text-[#515d58]">
              {active.patientViewSummary.note}
            </p>
          </div>

          {/* Column 3: Clinic View (Broad life areas only) */}
          <div className="flex flex-col justify-between rounded-xl border border-[#e4ddd2] bg-white p-4.5 shadow-2xs">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#697570]">
                  3 · Clinic View
                </span>
                <Link
                  href="/clinic"
                  className="text-xs font-semibold text-[#255748] hover:underline"
                >
                  Open clinic view &rarr;
                </Link>
              </div>
              {active.clinicViewSummary.hasOpenFlag ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-[#1a2421]">
                    Broad-area check-in flag since{" "}
                    <span className="tabular-nums">
                      {active.clinicViewSummary.sinceDate}
                    </span>
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {active.clinicViewSummary.broadAreaLabels.map((area) => (
                      <span
                        key={area}
                        className="rounded-md border border-[#e4ddd2] bg-[#faf8f5] px-2.5 py-0.5 text-xs font-medium text-[#1a2421]"
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
                <p className="mt-3 text-sm font-semibold text-[#1a2421]">
                  No clinic outreach needed
                </p>
              )}
            </div>
            <p className="mt-3 border-t border-[#f1ece4] pt-3 text-xs leading-relaxed text-[#515d58]">
              {active.clinicViewSummary.note}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
