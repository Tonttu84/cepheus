import type { ReactNode } from "react";
import type { MonitoringSummaryPayload } from "@/server/monitoring/store";

interface ArduinoSectionProps {
  recentCameraReadings: MonitoringSummaryPayload["recentCameraReadings"];
  recentRoutineReadings: MonitoringSummaryPayload["recentRoutineReadings"];
  lightCueActive: boolean;
  lightCueReason: string | null;
  busyAction: string | null;
  bedsideControls?: ReactNode;
  onSimulateArduinoPush: () => void;
}

export function ArduinoSection({
  recentCameraReadings,
  recentRoutineReadings,
  lightCueActive,
  lightCueReason,
  busyAction,
  bedsideControls,
  onSimulateArduinoPush,
}: ArduinoSectionProps) {
  return (
    <section
      aria-label="Arduino UNO Q edge hub"
      className="space-y-6 rounded-2xl border border-border-hairline bg-surface-card p-6 sm:p-10"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-primary sm:text-2xl">
            Arduino UNO Q + External USB Camera (24/7 Home Edge Node)
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            Processes camera frames strictly on the Arduino board in memory and
            pushes only derived numbers to <code>POST /api/arduino/ingest</code>
            : prolonged daytime stationary bouts, ambient room daylight (lux),
            and brief facial/head movement metrics. Never stores raw video or
            audio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {bedsideControls}
          <button
            type="button"
            data-testid="arduino-simulate-push"
            disabled={busyAction !== null}
            onClick={onSimulateArduinoPush}
            className="min-h-11 cursor-pointer rounded-xl border border-border-tactile bg-surface-card px-4 py-2 text-xs font-semibold text-ink-primary transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50"
          >
            Simulate Arduino UNO Q push
          </button>
        </div>
      </div>

      {lightCueReason ? (
        <div
          data-testid="arduino-light-cue"
          className={
            lightCueActive
              ? "rounded-xl border border-accent-sage-border bg-accent-sage-soft/80 px-4 py-3 text-xs text-accent-sage-hover"
              : "rounded-xl border border-border-hairline bg-surface-subtle/80 px-4 py-3 text-xs text-ink-secondary"
          }
        >
          <strong>
            Desk ring-light cue:{" "}
            {lightCueActive
              ? "Suggested (dim room + long stationary bout)"
              : "Off"}
          </strong>{" "}
          ({lightCueReason})
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border-hairline bg-surface-subtle/80 p-4">
          <h3 className="font-display text-base font-semibold text-ink-primary">
            Latest derived camera movement (0 bytes video)
          </h3>
          {recentCameraReadings.length > 0 ? (
            <ul className="mt-3 space-y-2 text-xs">
              {recentCameraReadings.slice(0, 3).map((r, idx) => (
                <li
                  key={`${r.date}-${idx}`}
                  className="flex items-center justify-between rounded-xl border border-border-hairline bg-surface-card px-3 py-2 text-ink-primary"
                >
                  <span className="tabular-nums">
                    <strong>{r.date}</strong> · exp{" "}
                    {r.expressivityScore.toFixed(3)} · head{" "}
                    {r.angularPathDegPerMin.toFixed(1)}°/min
                  </span>
                  <span className="rounded-full border border-border-hairline bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
                    {r.isSimulated ? "Simulated" : r.source}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2.5 text-xs text-ink-muted">
              No Arduino camera summaries ingested yet.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border-hairline bg-surface-subtle/80 p-4">
          <h3 className="font-display text-base font-semibold text-ink-primary">
            Latest immobility &amp; daylight routine (daily_routine)
          </h3>
          {recentRoutineReadings.length > 0 ? (
            <ul className="mt-3 space-y-2 text-xs">
              {recentRoutineReadings.slice(0, 4).map((r, idx) => (
                <li
                  key={`${r.channel}-${idx}`}
                  className="flex items-center justify-between rounded-xl border border-border-hairline bg-surface-card px-3 py-2 text-ink-primary"
                >
                  <span className="tabular-nums">
                    <strong>{r.channel}</strong>: {r.derivedValue} {r.unit}
                  </span>
                  <span className="rounded-full border border-border-hairline bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
                    {r.isSimulated ? "Simulated" : r.source}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2.5 text-xs text-ink-muted">
              No home immobility or daylight summaries ingested yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
