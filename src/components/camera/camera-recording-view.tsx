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
      className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">
            Check-in in progress
          </h2>
          <p className="text-xs text-stone-600">
            Please look towards your screen naturally. No video is recorded.
          </p>
        </div>
        <button
          type="button"
          data-testid="stop-camera-button"
          onClick={onStop}
          className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-stone-600 focus-visible:ring-offset-2 transition-colors cursor-pointer"
        >
          Stop check
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-stone-600 font-medium">
          <span>Analysing movement</span>
          <span>{remainingSec}s remaining</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full bg-stone-100"
        >
          <div
            className="h-full bg-stone-700 transition-all duration-200 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-black flex justify-center items-center">
        <video
          ref={videoRef}
          data-testid="camera-video-feed"
          playsInline
          autoPlay
          muted
          className="w-full max-w-xl aspect-video object-cover"
        />
      </div>
    </section>
  );
}
