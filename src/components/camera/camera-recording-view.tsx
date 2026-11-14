"use client";

import type { RefObject } from "react";

interface CameraRecordingViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  progressPercent: number;
  remainingSec: number;
  onStop: () => void;
}

export function CameraRecordingView({
  videoRef,
  progressPercent,
  remainingSec,
  onStop,
}: CameraRecordingViewProps) {
  return (
    <section
      aria-label="Active camera check-in"
      className="space-y-4 rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-xs sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-primary">
            Check-in in progress
          </h2>
          <p className="text-xs text-ink-secondary">
            Please look towards your screen naturally. No video is recorded.
          </p>
        </div>
        <button
          type="button"
          data-testid="stop-camera-button"
          onClick={onStop}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-border-tactile bg-surface-card px-4 py-2 text-xs font-semibold text-ink-primary transition-colors hover:bg-surface-subtle focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-sage focus-visible:ring-offset-2"
        >
          Stop check
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-medium text-ink-secondary">
          <span>Analysing movement</span>
          <span className="tabular-nums">{remainingSec}s remaining</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        >
          <div
            className="h-full bg-accent-sage transition-all duration-200 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-center overflow-hidden rounded-xl border border-border-hairline bg-[#141a18]">
        <video
          ref={videoRef}
          data-testid="camera-video-feed"
          playsInline
          autoPlay
          muted
          className="aspect-video w-full max-w-xl object-cover"
        />
      </div>
    </section>
  );
}
