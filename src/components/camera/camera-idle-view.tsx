"use client";

interface CameraIdleViewProps {
  onStart: () => void;
}

export function CameraIdleView({ onStart }: CameraIdleViewProps) {
  return (
    <section
      aria-labelledby="camera-check-title"
      className="rounded-2xl border border-border-hairline bg-surface-card p-8 shadow-xs sm:p-10"
    >
      <div className="max-w-2xl">
        <h2
          id="camera-check-title"
          className="font-display text-xl font-semibold tracking-tight text-ink-primary sm:text-2xl"
        >
          Start camera check-in
        </h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-secondary">
          <p>
            The camera looks at movement of the face and head for about 20
            seconds.
          </p>
          <p>
            The video stays on this device, is analysed entirely in memory, and
            is never recorded or saved.
          </p>
          <p>
            Only two summary numbers measuring movement are kept. No model
            judges mood or health.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            data-testid="start-camera-button"
            onClick={onStart}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-accent-sage px-6 py-3.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-accent-sage-hover focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-sage focus-visible:ring-offset-2"
          >
            Start camera check
          </button>
          <span className="text-xs text-ink-muted">
            Camera is accessed only after clicking Start
          </span>
        </div>
      </div>
    </section>
  );
}
