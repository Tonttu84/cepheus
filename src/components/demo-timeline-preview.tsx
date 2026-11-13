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

  const active =
    moments.find((m) => m.key === selectedKey) ?? moments[0];

  if (!active) {
    return null;
  }

  return (
    <section
      aria-label="Interactive post-TMS demo timeline"
      data-testid="demo-timeline-preview"
      className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            8-Week Post-TMS Demo Trajectory
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            Switch between three moments to see how the same dataset supports
            low-effort patient steps and broad-area clinic follow-up.
          </p>
        </div>
        <SimulatedBadge subtitle={`Day ${active.dayIndex} · Week ${active.weekNumber}`} />
      </div>

      {/* 3 Moment Switcher Buttons */}
      <div
        role="tablist"
        aria-label="Select demo moment"
        className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {moments.map((moment) => {
          const isSelected = moment.key === active.key;
          return (
            <button
              key={moment.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              data-testid={`moment-${moment.key}`}
              onClick={() => setSelectedKey(moment.key)}
              className={`flex flex-col items-start rounded-lg border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-stone-500 ${
                isSelected
                  ? "border-stone-800 bg-stone-900 text-white"
                  : "border-stone-200 bg-stone-50 text-stone-800 hover:bg-stone-100"
              }`}
            >
              <span className="text-xs font-medium uppercase tracking-wider opacity-80">
                {moment.buttonLabel}
              </span>
              <span className="mt-1 text-sm font-semibold">
                {moment.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Moment Details */}
      <div
        data-testid={`moment-panel-${active.key}`}
        className="mt-5 rounded-lg border border-stone-200 bg-stone-50/70 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-stone-900">
              {active.title} (Day {active.dayIndex})
            </h3>
            <p className="mt-0.5 text-sm text-stone-700">{active.subtitle}</p>
          </div>
          <span className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700">
            Active loop:{" "}
            {active.recipient === "none"
              ? "Quiet baseline (no alert)"
              : active.recipient === "patient"
                ? "Patient one-button step"
                : "Clinic nurse outreach"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Column 1: Twice-weekly Check-in & Ring Rhythm */}
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                1 · Check-In &amp; Rhythm
              </span>
              <Link
                href="/check-in"
                className="text-xs font-medium text-stone-700 underline hover:text-stone-900"
              >
                Open check-in
              </Link>
            </div>
            <p className="mt-2 text-sm font-medium text-stone-900">
              Latest status: {active.checkInSummary.latestRoundStatus}
            </p>
            <p className="mt-1 text-xs text-stone-600">
              {active.checkInSummary.ringWornStatus}
            </p>
            <p className="mt-2 text-xs text-stone-600">
              {active.checkInSummary.note}
            </p>
          </div>

          {/* Column 2: Patient View (Low-effort step, zero scores/streaks) */}
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                2 · Patient View
              </span>
              <Link
                href="/patient"
                className="text-xs font-medium text-stone-700 underline hover:text-stone-900"
              >
                Open patient view
              </Link>
            </div>
            <p className="mt-2 text-sm font-medium text-stone-900">
              {active.patientViewSummary.headline}
            </p>
            {active.patientViewSummary.actionTitle ? (
              <div className="mt-2 rounded-md border border-stone-200 bg-stone-50 p-2.5">
                <p className="text-sm font-semibold text-stone-900">
                  {active.patientViewSummary.actionTitle}
                </p>
                {active.patientViewSummary.actionDetail ? (
                  <p className="mt-0.5 text-xs text-stone-600">
                    {active.patientViewSummary.actionDetail}
                  </p>
                ) : null}
              </div>
            ) : null}
            <p className="mt-2 text-xs text-stone-600">
              {active.patientViewSummary.note}
            </p>
          </div>

          {/* Column 3: Clinic View (Broad life areas only) */}
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                3 · Clinic View
              </span>
              <Link
                href="/clinic"
                className="text-xs font-medium text-stone-700 underline hover:text-stone-900"
              >
                Open clinic view
              </Link>
            </div>
            {active.clinicViewSummary.hasOpenFlag ? (
              <>
                <p className="mt-2 text-sm font-medium text-stone-900">
                  Broad-area check-in flag since{" "}
                  {active.clinicViewSummary.sinceDate}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {active.clinicViewSummary.broadAreaLabels.map((area) => (
                    <span
                      key={area}
                      className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-800"
                    >
                      {area}
                    </span>
                  ))}
                </div>
                {active.clinicViewSummary.ringActiveDuringSilence ? (
                  <p className="mt-2 text-xs font-medium text-amber-900">
                    Smart ring remains worn during missed check-in rounds.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm font-medium text-stone-900">
                No clinic outreach needed
              </p>
            )}
            <p className="mt-2 text-xs text-stone-600">
              {active.clinicViewSummary.note}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
