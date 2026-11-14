"use client";

import type { CameraSessionOutput } from "@/domain/camera";

interface CameraCompletedViewProps {
  sessionResult: CameraSessionOutput & { hasNumbers: true };
  onReset: () => void;
}

export function CameraCompletedView({
  sessionResult,
  onReset,
}: CameraCompletedViewProps) {
  return (
    <section
      data-testid="camera-completed-card"
      aria-label="Camera check-in complete"
      className="space-y-6 rounded-2xl border border-[#e4ddd2] bg-white p-6 shadow-xs sm:p-8"
    >
      <div className="border-b border-[#f1ece4] pb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6e4de] bg-[#eaf2ef] px-3 py-1 text-xs font-medium text-[#1c4438]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#255748]" />
          Check-in finished
        </span>
        <h2 className="font-display mt-2.5 text-xl font-semibold text-[#1a2421] sm:text-2xl">
          Your camera check-in is complete
        </h2>
        <p className="mt-1 text-sm text-[#515d58]">
          Camera access has been closed and all tracks were stopped. The video
          frames were analysed in memory and discarded.
        </p>
      </div>

      <details
        data-testid="camera-movement-details"
        className="group rounded-xl border border-[#e4ddd2] bg-[#faf8f5] p-4 open:bg-white"
      >
        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-[#1a2421] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#255748]">
          <span>View movement measurements (2 numbers)</span>
          <span className="text-xs font-normal text-[#697570]">
            Click to expand / collapse
          </span>
        </summary>

        <div className="mt-4 space-y-4 border-t border-[#e4ddd2] pt-4 text-xs text-[#515d58]">
          <p>
            These numbers measure movement of the face and head. No model
            judges mood or health.
          </p>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#e4ddd2] bg-[#faf8f5] p-3.5">
              <dt className="text-[#697570]">Facial movement dispersion</dt>
              <dd
                data-testid="expressivity-number"
                className="tabular-nums mt-1 text-base font-semibold text-[#1a2421]"
              >
                {sessionResult.expressivity.toFixed(3)}
              </dd>
              <p className="mt-0.5 text-[11px] text-[#697570]">
                Mean variation in facial movement across frames
              </p>
            </div>

            <div className="rounded-xl border border-[#e4ddd2] bg-[#faf8f5] p-3.5">
              <dt className="text-[#697570]">Head movement speed</dt>
              <dd
                data-testid="head-movement-number"
                className="tabular-nums mt-1 text-base font-semibold text-[#1a2421]"
              >
                {sessionResult.headMovement.toFixed(1)} deg/s
              </dd>
              <p className="mt-0.5 text-[11px] text-[#697570]">
                Average frame-to-frame change of head rotation angles
              </p>
            </div>
          </dl>

          <div className="tabular-nums pt-1 text-[11px] text-[#697570]">
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
          className="cursor-pointer rounded-xl border border-[#d6cfc4] bg-white px-5 py-2.5 text-sm font-semibold text-[#1a2421] transition-colors hover:bg-[#faf8f5] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#255748] focus-visible:ring-offset-2"
        >
          Start another check-in
        </button>
      </div>
    </section>
  );
}
