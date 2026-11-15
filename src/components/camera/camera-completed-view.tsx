"use client";

import React from "react";
import type { CameraSessionOutput } from "@/domain/camera";

interface CameraCompletedViewProps {
  sessionResult: CameraSessionOutput & { hasNumbers: true };
  onReset: () => void;
  canSave?: boolean;
}

export function CameraCompletedView({
  sessionResult,
  onReset,
  canSave = true,
}: CameraCompletedViewProps) {
  return (
    <section
      data-testid="camera-completed-card"
      aria-label="Camera check-in complete"
      className="space-y-8 rounded-2xl border border-border-hairline bg-surface-card p-7 sm:p-10"
    >
      <div className="border-b border-border-hairline pb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-sage-border bg-accent-sage-soft px-3 py-1 text-xs font-medium text-accent-sage-hover">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-sage" />
          Check-in finished
        </span>
        <h2 className="font-display mt-3.5 text-2xl font-semibold text-ink-primary sm:text-3xl">
          Your camera check-in is complete
        </h2>
        <p className="mt-2 text-base leading-relaxed text-ink-secondary">
          Camera access has been closed and all tracks were stopped. The video
          frames were analysed in memory and discarded.
        </p>
        {!canSave ? (
          <p
            role="status"
            className="mt-2 text-xs font-medium text-ink-muted"
          >
            Saving is off. Camera wellbeing check is paused or not consented;
            measurements are not saved.
          </p>
        ) : null}
      </div>

      <details
        data-testid="camera-movement-details"
        className="group rounded-xl border border-border-hairline bg-surface-subtle p-4 open:bg-surface-card"
      >
        <summary className="flex min-h-11 cursor-pointer items-center justify-between rounded-lg text-sm font-semibold text-ink-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-sage focus-visible:ring-offset-2">
          <span>View movement measurements (2 numbers)</span>
          <span className="text-xs font-normal text-ink-muted">
            Click to expand / collapse
          </span>
        </summary>

        <div className="mt-4 space-y-4 border-t border-border-hairline pt-4 text-xs text-ink-secondary">
          <p>
            These numbers measure movement of the face and head. No model
            judges mood or health.
          </p>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border-hairline bg-surface-subtle p-3.5">
              <dt className="text-ink-muted">Facial movement dispersion</dt>
              <dd
                data-testid="expressivity-number"
                className="tabular-nums mt-1 text-base font-semibold text-ink-primary"
              >
                {sessionResult.expressivity.toFixed(3)}
              </dd>
              <p className="mt-0.5 text-xs text-ink-muted">
                Mean variation in facial movement across frames
              </p>
            </div>

            <div className="rounded-xl border border-border-hairline bg-surface-subtle p-3.5">
              <dt className="text-ink-muted">Head movement speed</dt>
              <dd
                data-testid="head-movement-number"
                className="tabular-nums mt-1 text-base font-semibold text-ink-primary"
              >
                {sessionResult.headMovement.toFixed(1)} deg/s
              </dd>
              <p className="mt-0.5 text-xs text-ink-muted">
                Average frame-to-frame change of head rotation angles
              </p>
            </div>
          </dl>

          <div className="tabular-nums pt-1 text-xs text-ink-muted">
            Quality: {sessionResult.quality.analysedFrames} frames evaluated (
            {Math.round(sessionResult.quality.faceShare * 100)}% face
            presence) over{" "}
            {(sessionResult.quality.sessionDurationMs / 1000).toFixed(1)}s.
          </div>
        </div>
      </details>

      <div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-border-tactile bg-surface-subtle px-5 py-2.5 text-sm font-semibold text-ink-primary transition-colors hover:bg-surface-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-sage focus-visible:ring-offset-2"
        >
          Start another check-in
        </button>
      </div>
    </section>
  );
}
