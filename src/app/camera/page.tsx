import { SimulatedBadge } from "@/components/simulated-badge";
import { generateSimulatedPersonWeeks } from "@/lib/simulation";

export default function CameraPage() {
  const dataset = generateSimulatedPersonWeeks({ throughDay: 29 });
  const latestCamera =
    dataset.cameraReadings[dataset.cameraReadings.length - 1] ?? null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="On-device MediaPipe summary numbers only" />
          <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
            100% In-Browser Processing · Zero Video Stored
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          On-device camera wellbeing check
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-700">
          During an optional brief check-in clip, MediaPipe Face Landmarker runs
          locally inside your browser on your device. Only derived facial
          expressivity and head-movement summary numbers are saved — never video
          recordings, never image frames, and never audio.
        </p>
      </section>

      {/* Privacy & On-Device Processing Guarantee */}
      <section
        aria-label="On-device privacy guarantee"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Step 1 · Local WebAssembly
          </span>
          <h2 className="mt-1 text-base font-semibold text-stone-900">
            Processed on your device
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
            Camera frames are analysed frame-by-frame in browser memory using
            MediaPipe Face Landmarker and discarded immediately after each
            frame.
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Step 2 · Derived Numbers Only
          </span>
          <h2 className="mt-1 text-base font-semibold text-stone-900">
            Expressivity &amp; head kinematics
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
            Only aggregate numbers (facial expressivity dispersion, smile
            fraction, and head pitch/yaw movement variability) are stored
            against your personal baseline.
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Step 3 · No Mood Reading by AI
          </span>
          <h2 className="mt-1 text-base font-semibold text-stone-900">
            Supporting context only
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
            No general AI model reads mood from your face or voice. Derived
            numbers are compared strictly against your own initial post-TMS
            weeks.
          </p>
        </div>
      </section>

      {/* Simulated Derived Reading Preview */}
      {latestCamera ? (
        <section
          aria-label="Derived numerical summary preview"
          className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-stone-900">
                Example stored payload (derived numbers only)
              </h2>
              <p className="mt-0.5 text-xs text-stone-600">
                Simulated reading from {latestCamera.date} (Day{" "}
                {latestCamera.dayIndex}) — no image or video bytes exist in the
                database.
              </p>
            </div>
            <SimulatedBadge subtitle={`Day ${latestCamera.dayIndex} derived record`} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <dt className="text-xs text-stone-500">Clip duration</dt>
              <dd className="mt-1 text-sm font-semibold text-stone-900">
                {latestCamera.durationSec}s @ {latestCamera.effectiveFps} fps
              </dd>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <dt className="text-xs text-stone-500">Expressivity index</dt>
              <dd className="mt-1 text-sm font-semibold text-stone-900">
                {latestCamera.expressivityScore.toFixed(3)}
              </dd>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <dt className="text-xs text-stone-500">Head angular path</dt>
              <dd className="mt-1 text-sm font-semibold text-stone-900">
                {latestCamera.angularPathDegPerMin.toFixed(1)} deg/min
              </dd>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <dt className="text-xs text-stone-500">Video / audio stored</dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-800">
                None (0 bytes)
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
