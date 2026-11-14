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
      <section className="rounded-2xl border border-[#e4ddd2] bg-white p-6 shadow-xs sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="On-device MediaPipe summary numbers only" />
          <span className="rounded-full border border-[#d6e4de] bg-[#eaf2ef] px-3 py-1 text-xs font-medium text-[#1c4438]">
            100% In-Browser Processing · Zero Video Stored
          </span>
        </div>

        <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight text-[#1a2421] sm:text-3xl">
          On-device camera wellbeing check
        </h1>
        <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-[#515d58]">
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
        <div className="rounded-2xl border border-[#e4ddd2] bg-white p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#255748]">
            Step 1 · Local WebAssembly
          </span>
          <h2 className="font-display mt-1.5 text-base font-semibold text-[#1a2421]">
            Processed on your device
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-[#515d58]">
            Camera frames are analysed frame-by-frame in browser memory using
            MediaPipe Face Landmarker and discarded immediately after each
            frame.
          </p>
        </div>

        <div className="rounded-2xl border border-[#e4ddd2] bg-white p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#255748]">
            Step 2 · Derived Numbers Only
          </span>
          <h2 className="font-display mt-1.5 text-base font-semibold text-[#1a2421]">
            Movement of the face and head
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-[#515d58]">
            Only summary numbers measuring movement of the face and head are
            kept.
          </p>
        </div>

        <div className="rounded-2xl border border-[#e4ddd2] bg-white p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#255748]">
            Step 3 · No Model Judges Mood or Health
          </span>
          <h2 className="font-display mt-1.5 text-base font-semibold text-[#1a2421]">
            Supporting context only
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-[#515d58]">
            No model judges mood or health. The camera measures movement of the
            face and head only.
          </p>
        </div>
      </section>

      {/* Simulated Derived Reading Preview */}
      {latestCamera ? (
        <section
          aria-label="Derived numerical summary preview"
          className="rounded-2xl border border-[#e4ddd2] bg-white p-6 shadow-xs sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#1a2421]">
                Example stored payload (derived numbers only)
              </h2>
              <p className="mt-0.5 text-xs text-[#515d58]">
                Simulated reading from{" "}
                <span className="tabular-nums">{latestCamera.date}</span> (Day{" "}
                <span className="tabular-nums">{latestCamera.dayIndex}</span>) —
                no image or video bytes exist in the database.
              </p>
            </div>
            <SimulatedBadge subtitle={`Day ${latestCamera.dayIndex} derived record`} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#e4ddd2] bg-[#faf8f5] p-3.5">
              <dt className="text-xs text-[#697570]">Clip duration</dt>
              <dd className="tabular-nums mt-1 text-sm font-semibold text-[#1a2421]">
                {latestCamera.durationSec}s @ {latestCamera.effectiveFps} fps
              </dd>
            </div>
            <div className="rounded-xl border border-[#e4ddd2] bg-[#faf8f5] p-3.5">
              <dt className="text-xs text-[#697570]">Expressivity index</dt>
              <dd className="tabular-nums mt-1 text-sm font-semibold text-[#1a2421]">
                {latestCamera.expressivityScore.toFixed(3)}
              </dd>
            </div>
            <div className="rounded-xl border border-[#e4ddd2] bg-[#faf8f5] p-3.5">
              <dt className="text-xs text-[#697570]">Head angular path</dt>
              <dd className="tabular-nums mt-1 text-sm font-semibold text-[#1a2421]">
                {latestCamera.angularPathDegPerMin.toFixed(1)} deg/min
              </dd>
            </div>
            <div className="rounded-xl border border-[#d6e4de] bg-[#eaf2ef]/70 p-3.5">
              <dt className="text-xs text-[#2d4a40]">Video / audio stored</dt>
              <dd className="mt-1 text-sm font-semibold text-[#1c4438]">
                None (0 bytes)
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
