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
      className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-xs space-y-6"
    >
      <div className="border-b border-stone-100 pb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Check-in finished
        </span>
        <h2 className="mt-2 text-xl font-semibold text-stone-900">
          Your camera check-in is complete
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Camera access has been closed and all tracks were stopped. The video
          frames were analysed in memory and discarded.
        </p>
      </div>

      <details
        data-testid="camera-movement-details"
        className="group rounded-xl border border-stone-200 bg-stone-50 p-4 open:bg-white"
      >
        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-stone-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-stone-600">
          <span>View movement measurements (2 numbers)</span>
          <span className="text-xs text-stone-500 font-normal">
            Click to expand / collapse
          </span>
        </summary>

        <div className="mt-4 pt-4 border-t border-stone-200 space-y-4 text-xs text-stone-600">
          <p>
            These numbers measure movement of the face and head. No model
            judges mood or health.
          </p>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <dt className="text-stone-500">Facial movement dispersion</dt>
              <dd
                data-testid="expressivity-number"
                className="mt-1 text-base font-semibold text-stone-900"
              >
                {sessionResult.expressivity.toFixed(3)}
              </dd>
              <p className="mt-0.5 text-[11px] text-stone-500">
                Mean variation in facial movement across frames
              </p>
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <dt className="text-stone-500">Head movement speed</dt>
              <dd
                data-testid="head-movement-number"
                className="mt-1 text-base font-semibold text-stone-900"
              >
                {sessionResult.headMovement.toFixed(1)} deg/s
              </dd>
              <p className="mt-0.5 text-[11px] text-stone-500">
                Average frame-to-frame change of head rotation angles
              </p>
            </div>
          </dl>

          <div className="text-[11px] text-stone-500 pt-1">
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
          className="rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-stone-600 focus-visible:ring-offset-2 transition-colors cursor-pointer"
        >
          Start another check-in
        </button>
      </div>
    </section>
  );
}
