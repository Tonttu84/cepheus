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
      className="space-y-4 rounded-2xl border border-[#e4ddd2] bg-white p-6 shadow-xs sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#1a2421]">
            Check-in in progress
          </h2>
          <p className="text-xs text-[#515d58]">
            Please look towards your screen naturally. No video is recorded.
          </p>
        </div>
        <button
          type="button"
          data-testid="stop-camera-button"
          onClick={onStop}
          className="cursor-pointer rounded-xl border border-[#d6cfc4] bg-white px-4 py-2 text-xs font-semibold text-[#1a2421] transition-colors hover:bg-[#faf8f5] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#255748] focus-visible:ring-offset-2"
        >
          Stop check
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-medium text-[#515d58]">
          <span>Analysing movement</span>
          <span className="tabular-nums">{remainingSec}s remaining</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full bg-[#f1ece4]"
        >
          <div
            className="h-full bg-[#255748] transition-all duration-200 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-center overflow-hidden rounded-xl border border-[#e4ddd2] bg-[#141a18]">
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
