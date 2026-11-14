"use client";

interface CameraStoppedViewProps {
  onReset: () => void;
}

export function CameraStoppedView({ onReset }: CameraStoppedViewProps) {
  return (
    <section
      aria-label="Check-in stopped"
      className="rounded-2xl border border-[#e4ddd2] bg-white p-6 shadow-xs sm:p-8"
    >
      <h2 className="font-display text-lg font-semibold text-[#1a2421]">
        Check-in stopped
      </h2>
      <p className="mt-2 text-sm text-[#515d58]">
        The camera check was stopped before completion. The camera was released
        immediately and no measurements were kept.
      </p>
      <div className="mt-6">
        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer rounded-xl bg-[#255748] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1c4438] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#255748] focus-visible:ring-offset-2"
        >
          Start over
        </button>
      </div>
    </section>
  );
}
