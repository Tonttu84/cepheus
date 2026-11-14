"use client";

interface CameraStoppedViewProps {
  onReset: () => void;
}

export function CameraStoppedView({ onReset }: CameraStoppedViewProps) {
  return (
    <section
      aria-label="Check-in stopped"
      className="rounded-2xl border border-border-hairline bg-surface-card p-6 sm:p-8"
    >
      <h2 className="font-display text-xl font-semibold text-ink-primary">
        Check-in stopped
      </h2>
      <p className="mt-2 text-base leading-relaxed text-ink-secondary">
        The camera check was stopped before completion. The camera was released
        immediately and no measurements were kept.
      </p>
      <div className="mt-6">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-accent-sage px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-sage-hover focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-sage focus-visible:ring-offset-2"
        >
          Start over
        </button>
      </div>
    </section>
  );
}
