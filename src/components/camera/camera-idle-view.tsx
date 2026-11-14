"use client";

interface CameraIdleViewProps {
  onStart: () => void;
}

export function CameraIdleView({ onStart }: CameraIdleViewProps) {
  return (
    <section
      aria-labelledby="camera-check-title"
      className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-xs"
    >
      <div className="max-w-2xl">
        <h2
          id="camera-check-title"
          className="text-xl font-semibold tracking-tight text-stone-900"
        >
          Start camera check-in
        </h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-stone-700">
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

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            data-testid="start-camera-button"
            onClick={onStart}
            className="inline-flex items-center justify-center rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-white shadow-xs hover:bg-stone-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-stone-600 focus-visible:ring-offset-2 transition-colors cursor-pointer"
          >
            Start camera check
          </button>
          <span className="text-xs text-stone-600">
            Camera is accessed only after clicking Start
          </span>
        </div>
      </div>
    </section>
  );
}
