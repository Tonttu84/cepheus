"use client";

interface CameraIdleViewProps {
  onStart: () => void;
}

export function CameraIdleView({ onStart }: CameraIdleViewProps) {
  return (
    <section
      aria-labelledby="camera-check-title"
      className="rounded-2xl border border-[#e4ddd2] bg-white p-6 shadow-xs sm:p-8"
    >
      <div className="max-w-2xl">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#255748]">
          On-Device Session
        </span>
        <h2
          id="camera-check-title"
          className="font-display mt-1 text-xl font-semibold tracking-tight text-[#1a2421] sm:text-2xl"
        >
          Start camera check-in
        </h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#515d58]">
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
            className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#255748] px-6 py-3.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#1c4438] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#255748] focus-visible:ring-offset-2"
          >
            Start camera check
          </button>
          <span className="text-xs text-[#697570]">
            Camera is accessed only after clicking Start
          </span>
        </div>
      </div>
    </section>
  );
}
