"use client";

interface CameraStoppedViewProps {
  onReset: () => void;
}

export function CameraStoppedView({ onReset }: CameraStoppedViewProps) {
  return (
    <section
      aria-label="Check-in stopped"
      className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-xs"
    >
      <h2 className="text-lg font-semibold text-stone-900">
        Check-in stopped
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        The camera check was stopped before completion. The camera was released
        immediately and no measurements were kept.
      </p>
      <div className="mt-6">
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-stone-600 focus-visible:ring-offset-2 transition-colors cursor-pointer"
        >
          Start over
        </button>
      </div>
    </section>
  );
}
