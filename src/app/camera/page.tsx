import { CameraCheckSession } from "@/components/camera-check-session";
import {
  ForestCanopyArtwork,
  ForestDivider,
} from "@/components/forest-divider";
import { SimulatedBadge } from "@/components/simulated-badge";
import { generateSimulatedPersonWeeks } from "@/lib/simulation";

export default function CameraPage() {
  const dataset = generateSimulatedPersonWeeks({ throughDay: 29 });
  const latestCamera =
    dataset.cameraReadings[dataset.cameraReadings.length - 1] ?? null;

  return (
    <div className="space-y-12 sm:space-y-16">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="On-device MediaPipe summary numbers only" />
          <span className="rounded-full border border-accent-sage-border bg-accent-sage-soft px-3 py-1 text-xs font-medium text-accent-sage-hover">
            Runs in your browser · No video saved
          </span>
        </div>

        <div className="max-w-3xl space-y-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">
            On-device camera wellbeing check
          </h1>
          <p className="text-base leading-relaxed text-ink-secondary">
            During an optional 20-second check-in, MediaPipe Face Landmarker
            runs inside your browser on this device. Only two summary numbers
            measuring movement of the face and head are saved. Video, images,
            and audio are never recorded or stored.
          </p>
        </div>

        <ForestCanopyArtwork className="w-full pt-2 text-accent-sage" />
      </header>

      <CameraCheckSession />

      <ForestDivider variant="grove" />

      {latestCamera ? (
        <details className="group border-t border-border-hairline pt-6">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg text-sm font-medium text-ink-secondary transition hover:text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage">
            <span>
              How on-device privacy works &amp; example saved record (Day{" "}
              <span className="tabular-nums font-semibold">
                {latestCamera.dayIndex}
              </span>
              )
            </span>
            <span className="text-xs text-ink-muted group-open:hidden">
              Show details
            </span>
            <span className="hidden text-xs text-ink-muted group-open:inline">
              Hide details
            </span>
          </summary>

          <div className="mt-5 space-y-6 rounded-2xl border border-border-hairline bg-surface-subtle/70 p-6 text-xs text-ink-secondary">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border-hairline bg-surface-card p-4">
                <h2 className="font-display text-base font-semibold text-ink-primary">
                  Processed on your device
                </h2>
                <p className="mt-1.5 leading-relaxed text-ink-secondary">
                  Camera frames are analysed frame-by-frame in browser memory
                  using MediaPipe Face Landmarker and discarded immediately
                  after each frame.
                </p>
              </div>

              <div className="rounded-xl border border-border-hairline bg-surface-card p-4">
                <h2 className="font-display text-base font-semibold text-ink-primary">
                  Movement of the face and head
                </h2>
                <p className="mt-1.5 leading-relaxed text-ink-secondary">
                  Only summary numbers measuring movement of the face and head
                  are kept.
                </p>
              </div>

              <div className="rounded-xl border border-border-hairline bg-surface-card p-4">
                <h2 className="font-display text-base font-semibold text-ink-primary">
                  Supporting context only
                </h2>
                <p className="mt-1.5 leading-relaxed text-ink-secondary">
                  No model judges mood or health. The camera measures movement
                  of the face and head only.
                </p>
              </div>
            </div>

            <div className="border-t border-border-hairline pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink-primary">
                    Example saved record (summary numbers only)
                  </h2>
                  <p className="mt-0.5 text-ink-secondary">
                    Simulated reading from{" "}
                    <span className="tabular-nums font-medium text-ink-primary">
                      {latestCamera.date}
                    </span>{" "}
                    (Day{" "}
                    <span className="tabular-nums">
                      {latestCamera.dayIndex}
                    </span>
                    ). No image or video bytes are stored in the database.
                  </p>
                </div>
                <SimulatedBadge
                  subtitle={`Day ${latestCamera.dayIndex} derived record`}
                />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-border-hairline bg-surface-card p-3.5">
                  <dt className="text-ink-muted">Clip duration</dt>
                  <dd className="tabular-nums mt-1 text-sm font-semibold text-ink-primary">
                    {latestCamera.durationSec}s @ {latestCamera.effectiveFps} fps
                  </dd>
                </div>
                <div className="rounded-xl border border-border-hairline bg-surface-card p-3.5">
                  <dt className="text-ink-muted">Expressivity index</dt>
                  <dd className="tabular-nums mt-1 text-sm font-semibold text-ink-primary">
                    {latestCamera.expressivityScore.toFixed(3)}
                  </dd>
                </div>
                <div className="rounded-xl border border-border-hairline bg-surface-card p-3.5">
                  <dt className="text-ink-muted">Head angular path</dt>
                  <dd className="tabular-nums mt-1 text-sm font-semibold text-ink-primary">
                    {latestCamera.angularPathDegPerMin.toFixed(1)} deg/min
                  </dd>
                </div>
                <div className="rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 p-3.5">
                  <dt className="text-accent-sage-hover">
                    Video / audio stored
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-accent-sage-hover">
                    None (0 bytes)
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
