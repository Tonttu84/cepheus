import { CameraCheckSession } from "@/components/camera-check-session";
import { SimulatedBadge } from "@/components/simulated-badge";
import { generateSimulatedPersonWeeks } from "@/lib/simulation";

export default function CameraPage() {
  const dataset = generateSimulatedPersonWeeks({ throughDay: 29 });
  const latestCamera =
    dataset.cameraReadings[dataset.cameraReadings.length - 1] ?? null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-xs sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="On-device MediaPipe summary numbers only" />
          <span className="rounded-full border border-accent-sage-border bg-accent-sage-soft px-3 py-1 text-xs font-medium text-accent-sage-hover">
            100% In-Browser Processing · Zero Video Stored
          </span>
        </div>

        <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight text-ink-primary sm:text-3xl">
          On-device camera wellbeing check
        </h1>
        <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-ink-secondary">
          During an optional brief check-in, MediaPipe Face Landmarker runs
          locally inside your browser on your device. Only two summary numbers
          measuring movement of the face and head are saved — never video
          recordings, never image frames, and never audio.
        </p>
      </section>

      {/* Live Interactive Camera Check-in Component */}
      <CameraCheckSession />

      {/* Privacy & On-Device Processing Guarantee */}
      <section
        aria-label="On-device privacy guarantee"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <div className="rounded-2xl border border-border-hairline bg-surface-card p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-sage">
            Step 1 · Local WebAssembly
          </span>
          <h2 className="font-display mt-1.5 text-base font-semibold text-ink-primary">
            Processed on your device
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
            Camera frames are analysed frame-by-frame in browser memory using
            MediaPipe Face Landmarker and discarded immediately after each
            frame.
          </p>
        </div>

        <div className="rounded-2xl border border-border-hairline bg-surface-card p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-sage">
            Step 2 · Derived Numbers Only
          </span>
          <h2 className="font-display mt-1.5 text-base font-semibold text-ink-primary">
            Movement of the face and head
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
            Only summary numbers measuring movement of the face and head are
            kept.
          </p>
        </div>

        <div className="rounded-2xl border border-border-hairline bg-surface-card p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-sage">
            Step 3 · No Model Judges Mood or Health
          </span>
          <h2 className="font-display mt-1.5 text-base font-semibold text-ink-primary">
            Supporting context only
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
            No model judges mood or health. The camera measures movement of the
            face and head only.
          </p>
        </div>
      </section>

      {/* Simulated Derived Reading Preview */}
      {latestCamera ? (
        <section
          aria-label="Derived numerical summary preview"
          className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-xs sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-primary">
                Example stored payload (derived numbers only)
              </h2>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Simulated reading from{" "}
                <span className="tabular-nums">{latestCamera.date}</span> (Day{" "}
                <span className="tabular-nums">{latestCamera.dayIndex}</span>) —
                no image or video bytes exist in the database.
              </p>
            </div>
            <SimulatedBadge subtitle={`Day ${latestCamera.dayIndex} derived record`} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border-hairline bg-surface-subtle p-3.5">
              <dt className="text-xs text-ink-muted">Clip duration</dt>
              <dd className="tabular-nums mt-1 text-sm font-semibold text-ink-primary">
                {latestCamera.durationSec}s @ {latestCamera.effectiveFps} fps
              </dd>
            </div>
            <div className="rounded-xl border border-border-hairline bg-surface-subtle p-3.5">
              <dt className="text-xs text-ink-muted">Expressivity index</dt>
              <dd className="tabular-nums mt-1 text-sm font-semibold text-ink-primary">
                {latestCamera.expressivityScore.toFixed(3)}
              </dd>
            </div>
            <div className="rounded-xl border border-border-hairline bg-surface-subtle p-3.5">
              <dt className="text-xs text-ink-muted">Head angular path</dt>
              <dd className="tabular-nums mt-1 text-sm font-semibold text-ink-primary">
                {latestCamera.angularPathDegPerMin.toFixed(1)} deg/min (
                {(latestCamera.angularPathDegPerMin / 60).toFixed(2)} deg/s)
              </dd>
            </div>
            <div className="rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 p-3.5">
              <dt className="text-xs text-accent-sage-hover">
                Video / audio stored
              </dt>
              <dd className="mt-1 text-sm font-semibold text-accent-sage-hover">
                None (0 bytes)
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
