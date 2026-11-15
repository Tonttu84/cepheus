import {
  HealthConnectPanel,
  type HealthConnectPanelProps,
} from "@/components/monitoring/health-connect-panel";
import type { MonitoringSummaryPayload } from "@/server/monitoring/store";

export interface FitbitStatus {
  configured: boolean;
  connected: boolean;
  scope: string | null;
  expiresAtMs: number | null;
}

interface WearableSectionProps {
  fitbitStatus: FitbitStatus | null;
  healthConnect: HealthConnectPanelProps;
  latestRhythmWindow: MonitoringSummaryPayload["latestRhythmWindow"];
  busyAction: string | null;
  onFitbitSync: (mode: "live" | "simulated") => void;
  onFitbitDisconnect: () => void;
}

const PRIMARY_BTN =
  "min-h-11 cursor-pointer rounded-xl bg-accent-sage px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50";
const SECONDARY_BTN =
  "min-h-11 cursor-pointer rounded-xl border border-border-tactile bg-surface-card px-4 py-2 text-xs font-semibold text-ink-primary transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50";

export function WearableSection({
  fitbitStatus,
  healthConnect,
  latestRhythmWindow,
  busyAction,
  onFitbitSync,
  onFitbitDisconnect,
}: WearableSectionProps) {
  return (
    <section
      aria-label="Fitbit sleep and activity sync"
      className="space-y-6 rounded-2xl border border-border-hairline bg-surface-card p-6 sm:p-10"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-primary sm:text-2xl">
            Fitbit passive sleep &amp; rest-activity rhythm (OAuth2 PKCE)
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            One-time Fitbit sign-in removes the need for native Apple Health or
            Google Health Connect apps. Tokens stay sealed in HttpOnly
            AES-256-GCM cookies and never appear in browser JavaScript.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FitbitControls
            fitbitStatus={fitbitStatus}
            busyAction={busyAction}
            onFitbitSync={onFitbitSync}
            onFitbitDisconnect={onFitbitDisconnect}
          />
          <button
            type="button"
            data-testid="fitbit-sync-simulated"
            disabled={busyAction !== null}
            onClick={() => onFitbitSync("simulated")}
            className={SECONDARY_BTN}
          >
            Simulate 7-day Fitbit sync
          </button>
        </div>
      </div>

      <HealthConnectPanel {...healthConnect} />

      <RhythmWindowPanel latestRhythmWindow={latestRhythmWindow} />
    </section>
  );
}

function FitbitControls({
  fitbitStatus,
  busyAction,
  onFitbitSync,
  onFitbitDisconnect,
}: Pick<
  WearableSectionProps,
  "fitbitStatus" | "busyAction" | "onFitbitSync" | "onFitbitDisconnect"
>) {
  if (!fitbitStatus?.configured) {
    return (
      <span className="rounded-full border border-border-hairline bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
        Fitbit OAuth env vars not set (use simulated sync below)
      </span>
    );
  }
  if (fitbitStatus.connected) {
    return (
      <>
        <button
          type="button"
          data-testid="fitbit-sync-live"
          disabled={busyAction !== null}
          onClick={() => onFitbitSync("live")}
          className={PRIMARY_BTN}
        >
          Sync last 7 days (Fitbit)
        </button>
        <button
          type="button"
          data-testid="fitbit-disconnect"
          disabled={busyAction !== null}
          onClick={onFitbitDisconnect}
          className={SECONDARY_BTN}
        >
          Disconnect
        </button>
      </>
    );
  }
  return (
    <a
      href="/api/fitbit/auth"
      data-testid="fitbit-connect-link"
      className={`inline-flex items-center ${PRIMARY_BTN}`}
    >
      Connect Fitbit (PKCE)
    </a>
  );
}

function RhythmWindowPanel({
  latestRhythmWindow,
}: {
  latestRhythmWindow: MonitoringSummaryPayload["latestRhythmWindow"];
}) {
  if (!latestRhythmWindow) {
    return (
      <p className="rounded-xl border border-dashed border-border-tactile bg-surface-subtle p-4 text-sm text-ink-secondary">
        No wearable rhythm window synced yet. Connect Fitbit or click{" "}
        <strong>Simulate 7-day Fitbit sync</strong> to calculate RA, IS, IV, and
        Sleep Regularity Index.
      </p>
    );
  }

  const metrics = [
    { label: "Relative Amplitude", value: latestRhythmWindow.relativeAmplitude.toFixed(3) },
    { label: "Interdaily Stability", value: latestRhythmWindow.interdailyStability.toFixed(3) },
    { label: "Intradaily Var.", value: latestRhythmWindow.intradailyVariability.toFixed(3) },
    {
      label: "Sleep Reg. (SRI)",
      value: latestRhythmWindow.sri !== null ? latestRhythmWindow.sri.toFixed(1) : "n/a",
    },
    {
      label: "Midpoint SD",
      value:
        latestRhythmWindow.sleepMidpointSdMin !== null
          ? `${latestRhythmWindow.sleepMidpointSdMin.toFixed(0)} min`
          : "n/a",
    },
    {
      label: "Mean steps / day",
      value:
        latestRhythmWindow.stepsMean !== null
          ? String(Math.round(latestRhythmWindow.stepsMean))
          : "n/a",
    },
  ];

  return (
    <div className="rounded-xl border border-border-hairline bg-surface-subtle/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
          7-Day Circadian Window ending {latestRhythmWindow.windowEndDate} (
          {latestRhythmWindow.validDays} valid days)
        </span>
        <span className="rounded-full border border-border-hairline bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
          {latestRhythmWindow.isSimulated
            ? "Simulated wearable data"
            : "Live wearable data"}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-border-hairline bg-surface-card p-3"
          >
            <dt className="text-xs text-ink-muted">{m.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink-primary tabular-nums">
              {m.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
