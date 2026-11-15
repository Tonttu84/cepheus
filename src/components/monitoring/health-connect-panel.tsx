"use client";

import { useState } from "react";
import type {
  HealthConnectPairingStatus,
  HealthConnectProvisionedPairing,
} from "@/components/monitoring/actions";

export interface HealthConnectPanelProps {
  hcConfigured: boolean;
  pairingStatus: HealthConnectPairingStatus | null;
  activePairing: HealthConnectProvisionedPairing | null;
  busyAction: string | null;
  onPairOrRotate: () => void;
  onRevoke: () => void;
  onRefreshStatus: () => void;
  onSimulateHealthConnect: () => void;
}

const PRIMARY_BTN =
  "min-h-11 cursor-pointer rounded-xl bg-accent-sage px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50";
const SECONDARY_BTN =
  "min-h-11 cursor-pointer rounded-xl border border-border-tactile bg-surface-card px-4 py-2 text-xs font-semibold text-ink-primary transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusBadgeText(
  hcConfigured: boolean,
  pairingStatus: HealthConnectPairingStatus | null,
): string {
  const verifiedAt = pairingStatus?.lastSyncAt ?? pairingStatus?.lastTestPingAt;
  if (verifiedAt) {
    return `Phone verified (${formatTimestamp(verifiedAt)})`;
  }
  if (pairingStatus?.paired) {
    return "Paired · waiting for phone ping";
  }
  if (hcConfigured || pairingStatus?.configuredViaEnv) {
    return "Webhook secret configured";
  }
  return "Not paired yet";
}

export function HealthConnectPanel({
  hcConfigured,
  pairingStatus,
  activePairing,
  busyAction,
  onPairOrRotate,
  onRevoke,
  onRefreshStatus,
  onSimulateHealthConnect,
}: HealthConnectPanelProps) {
  const isPaired = Boolean(pairingStatus?.paired);
  const consentPaused = pairingStatus?.ringConsentEnabled === false;
  const badgeText = getStatusBadgeText(hcConfigured, pairingStatus);

  return (
    <div className="space-y-4 rounded-xl border border-border-hairline bg-surface-subtle/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-ink-primary">
            Android Health Connect &amp; Apple Health Webhook
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            Supports <strong>Health Connect to Webhook</strong> (Google Play)
            and <strong>Life Dashboard Companion</strong> (Android &amp; iOS,
            HMAC-SHA256 <code>X-Signature</code>) so Fitbit, Oura, Garmin, or
            Samsung watches push sleep stages, steps, HR, and HRV directly to{" "}
            <code>POST /api/webhooks/health-connect</code>.
          </p>
        </div>

        <span
          data-testid="hc-status-badge"
          className="rounded-full border border-border-hairline bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-secondary"
        >
          {badgeText}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="hc-pair-button"
          disabled={busyAction !== null || consentPaused}
          onClick={onPairOrRotate}
          className={PRIMARY_BTN}
        >
          {isPaired
            ? "Rotate pairing key"
            : "Pair phone (QR / Companion app)"}
        </button>

        {isPaired ? (
          <>
            <button
              type="button"
              data-testid="hc-refresh-status"
              disabled={busyAction !== null}
              onClick={onRefreshStatus}
              className={SECONDARY_BTN}
            >
              Check connection
            </button>
            <button
              type="button"
              data-testid="hc-disconnect-button"
              disabled={busyAction !== null}
              onClick={onRevoke}
              className={SECONDARY_BTN}
            >
              Disconnect phone
            </button>
          </>
        ) : null}

        <button
          type="button"
          data-testid="health-connect-simulate"
          disabled={busyAction !== null}
          onClick={onSimulateHealthConnect}
          className={SECONDARY_BTN}
        >
          Simulate Health Connect webhook push
        </button>
      </div>

      {consentPaused ? (
        <p className="text-sm text-amber-900">
          Wearable rhythm consent is currently paused. Enable{" "}
          <strong>ring_rhythm</strong> above to pair a phone.
        </p>
      ) : null}

      {activePairing ? (
        <ActivePairingDetails activePairing={activePairing} />
      ) : null}
    </div>
  );
}

function ActivePairingDetails({
  activePairing,
}: {
  activePairing: HealthConnectProvisionedPairing;
}) {
  return (
    <div
      data-testid="hc-pairing-card"
      className="space-y-5 rounded-xl border border-border-hairline bg-surface-card p-5"
    >
      <p className="rounded-lg border border-accent-sage-border bg-accent-sage-soft/60 px-3 py-2 text-sm text-accent-sage-hover">
        One-time pairing credentials generated. For privacy, the signing secret
        is shown only right now.
      </p>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <QrCodeSvg matrix={activePairing.qrMatrix} />
          <a
            href={activePairing.lifeDashboardUri}
            data-testid="hc-lifedashboard-link"
            className={`inline-flex items-center justify-center text-center ${PRIMARY_BTN}`}
          >
            Open in Life Dashboard on this phone
          </a>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-primary">
              Option A — Life Dashboard Companion (1-scan QR or 1-tap on Android &amp; iOS)
            </h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-ink-secondary">
              <li>Grant Health Connect read permissions on your phone.</li>
              <li>
                Scan the QR code or tap{" "}
                <strong>Open in Life Dashboard on this phone</strong> and tap{" "}
                <strong>Pair</strong>.
              </li>
              <li>
                Click <strong>Check connection</strong> above to confirm the{" "}
                <code>204</code> test ping.
              </li>
            </ol>
          </div>

          <div className="space-y-2.5 border-t border-border-hairline pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-primary">
              Option B — Health Connect to Webhook (com.hcwebhook.app, free on Google Play)
            </h4>
            <CopyField
              label="Endpoint URL"
              value={activePairing.webhookUrl}
              testId="hc-webhook-url"
            />
            <CopyField
              label="Custom Header (Bearer)"
              value={activePairing.bearerHeader}
              testId="hc-webhook-header"
            />
            <CopyField
              label="Custom Header (API Key)"
              value={activePairing.apiKeyHeader}
              testId="hc-webhook-apikey-header"
            />
            <p className="text-sm text-ink-secondary">
              Tip: Enable <strong>Count overlapping apps once</strong> in app
              settings. See <code>docs/health-connect-setup.md</code> for full
              steps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function QrCodeSvg({ matrix }: { matrix: boolean[][] }) {
  const size = matrix.length;
  const quiet = 4;
  const viewSize = size + quiet * 2;
  const pathParts: string[] = [];

  for (let row = 0; row < size; row += 1) {
    const line = matrix[row];
    if (!line) continue;
    for (let col = 0; col < line.length; col += 1) {
      if (line[col]) {
        pathParts.push(`M${col + quiet},${row + quiet}h1v1h-1z`);
      }
    }
  }

  return (
    <svg
      data-testid="hc-pairing-qr"
      role="img"
      aria-label="Health Connect QR pairing code"
      width={220}
      height={220}
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      shapeRendering="crispEdges"
      className="rounded-lg border border-border-hairline bg-white"
    >
      <rect x={0} y={0} width={viewSize} height={viewSize} fill="#ffffff" />
      <path d={pathParts.join("")} fill="#1c2420" />
    </svg>
  );
}

function CopyField({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-ink-secondary">{label}</div>
      <div className="flex items-center gap-2">
        <code
          data-testid={testId}
          className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border-hairline bg-surface-subtle px-2.5 py-1.5 text-xs text-ink-primary"
        >
          {value}
        </code>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="min-h-11 shrink-0 cursor-pointer rounded-lg border border-border-tactile bg-surface-card px-3 py-1 text-xs font-semibold text-ink-primary transition hover:bg-surface-subtle"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
