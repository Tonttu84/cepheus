"use client";

import { useCallback, useEffect, useState } from "react";
import { ForestDivider } from "@/components/forest-divider";
import {
  fetchHealthConnectPairingStatus,
  fitbitSyncAction,
  provisionHealthConnectPairingAction,
  revokeHealthConnectPairingAction,
  simulateArduinoPushAction,
  simulateHealthConnectAction,
  toggleConsentAction,
  type Feedback,
  type HealthConnectPairingStatus,
  type HealthConnectProvisionedPairing,
} from "@/components/monitoring/actions";
import { ArduinoSection } from "@/components/monitoring/arduino-section";
import { ConsentSection } from "@/components/monitoring/consent-section";
import {
  WearableSection,
  type FitbitStatus,
} from "@/components/monitoring/wearable-section";
import type {
  DeviceConnectionsMap,
  MonitoringSummaryPayload,
} from "@/server/monitoring/store";
import { ArduinoBedsideControls } from "./arduino-bedside-controls";

function resolveDeviceConnections(
  summary: MonitoringSummaryPayload | null,
  fitbitStatus: FitbitStatus | null,
  hcPairingStatus: HealthConnectPairingStatus | null
): DeviceConnectionsMap {
  const base: DeviceConnectionsMap = summary?.deviceConnections ?? {
    ring_rhythm: { connected: false, label: "No device connected" },
    camera_expressivity: { connected: false, label: "No device connected" },
    home_routine: { connected: false, label: "No device connected" },
  };

  if (fitbitStatus?.connected) {
    return {
      ...base,
      ring_rhythm: {
        connected: true,
        label: hcPairingStatus?.paired ? "Fitbit & phone connected" : "Fitbit connected",
      },
    };
  }
  if (hcPairingStatus?.paired && !base.ring_rhythm.connected) {
    return {
      ...base,
      ring_rhythm: { connected: true, label: "Phone paired" },
    };
  }
  return base;
}

export function MonitoringDashboard() {
  const [fitbitStatus, setFitbitStatus] = useState<FitbitStatus | null>(null);
  const [hcConfigured, setHcConfigured] = useState(false);
  const [hcPairingStatus, setHcPairingStatus] =
    useState<HealthConnectPairingStatus | null>(null);
  const [activeHcPairing, setActiveHcPairing] =
    useState<HealthConnectProvisionedPairing | null>(null);
  const [summary, setSummary] = useState<MonitoringSummaryPayload | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [lightCueReason, setLightCueReason] = useState<string | null>(null);
  const [lightCueActive, setLightCueActive] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [statusRes, summaryRes, pairingStatus] = await Promise.all([
        fetch("/api/fitbit/status", { cache: "no-store" }),
        fetch("/api/monitoring/summary", { cache: "no-store" }),
        fetchHealthConnectPairingStatus(),
      ]);
      if (statusRes.ok) {
        setFitbitStatus((await statusRes.json()) as FitbitStatus);
      }
      if (pairingStatus) {
        setHcPairingStatus(pairingStatus);
      }
      if (summaryRes.ok) {
        const sm = (await summaryRes.json()) as {
          ok: boolean;
          healthConnectConfigured?: boolean;
          summary: MonitoringSummaryPayload;
        };
        if (sm.ok) {
          setHcConfigured(Boolean(sm.healthConnectConfigured));
          setSummary(sm.summary);
        }
      }
    } catch {
      setFeedback({
        kind: "error",
        text: "Could not refresh monitoring status from the local server.",
      });
    }
  }, [setHcPairingStatus]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function runAction(key: string, fn: () => Promise<void>) {
    setBusyAction(key);
    setFeedback(null);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  }

  const healthConnectProps = buildHealthConnectProps({
    hcConfigured,
    hcPairingStatus,
    activeHcPairing,
    busyAction,
    runAction,
    loadAll,
    setHcPairingStatus,
    setActiveHcPairing,
    setFeedback,
  });

  return (
    <div className="space-y-8">
      {feedback ? (
        <div
          role="status"
          data-testid="monitoring-feedback"
          className={
            feedback.kind === "ok"
              ? "rounded-xl border border-accent-sage-border bg-accent-sage-soft/80 px-4 py-3 text-sm text-accent-sage-hover"
              : "rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          }
        >
          {feedback.text}
        </div>
      ) : null}

      <ForestDivider variant="clearing" />
      <ConsentSection
        consents={summary?.consents ?? []}
        detailedAnswersEnabled={summary?.detailedAnswersEnabled ?? false}
        deviceConnections={resolveDeviceConnections(
          summary,
          fitbitStatus,
          hcPairingStatus
        )}
        busyAction={busyAction}
        onToggleConsent={(method, nextEnabled) =>
          void runAction(`consent-${method}`, async () => {
            const fb = await toggleConsentAction(method, nextEnabled);
            if (fb?.kind === "ok") {
              if (method === "ring_rhythm" && !nextEnabled) {
                setActiveHcPairing(null);
              }
              await loadAll();
            }
            setFeedback(fb);
          })
        }
      />

      <ForestDivider variant="grove" />
      <WearableSection
        fitbitStatus={fitbitStatus}
        healthConnect={healthConnectProps}
        latestRhythmWindow={summary?.latestRhythmWindow ?? null}
        busyAction={busyAction}
        onFitbitSync={(mode) =>
          void runAction(`fitbit-${mode}`, async () => {
            const fb = await fitbitSyncAction(mode);
            if (fb?.kind === "ok") await loadAll();
            setFeedback(fb);
          })
        }
        onFitbitDisconnect={() =>
          void runAction("fitbit-disconnect", async () => {
            const res = await fetch("/api/fitbit/disconnect", { method: "POST" });
            if (res.ok) {
              await loadAll();
              setFeedback({
                kind: "ok",
                text: "Fitbit session disconnected and encrypted token cookie cleared.",
              });
            }
          })
        }
      />

      <ForestDivider variant="treeline" />
      <ArduinoSection
        recentCameraReadings={summary?.recentCameraReadings ?? []}
        recentRoutineReadings={summary?.recentRoutineReadings ?? []}
        lightCueActive={lightCueActive}
        lightCueReason={lightCueReason}
        busyAction={busyAction}
        bedsideControls={<ArduinoBedsideControls onFeedback={setFeedback} />}
        onSimulateArduinoPush={() =>
          void runAction("arduino-sim", async () => {
            const result = await simulateArduinoPushAction();
            if (result.lightCue) {
              setLightCueActive(result.lightCue.activateRingLightCue);
              setLightCueReason(result.lightCue.reason);
            }
            if (result.feedback?.kind === "ok") await loadAll();
            setFeedback(result.feedback);
          })
        }
      />
    </div>
  );
}

function buildHealthConnectProps(ctx: {
  hcConfigured: boolean;
  hcPairingStatus: HealthConnectPairingStatus | null;
  activeHcPairing: HealthConnectProvisionedPairing | null;
  busyAction: string | null;
  runAction: (key: string, fn: () => Promise<void>) => Promise<void>;
  loadAll: () => Promise<void>;
  setHcPairingStatus: (s: HealthConnectPairingStatus | null) => void;
  setActiveHcPairing: (p: HealthConnectProvisionedPairing | null) => void;
  setFeedback: (fb: Feedback) => void;
}) {
  return {
    hcConfigured: ctx.hcConfigured,
    pairingStatus: ctx.hcPairingStatus,
    activePairing: ctx.activeHcPairing,
    busyAction: ctx.busyAction,
    onPairOrRotate: () =>
      void ctx.runAction("hc-pair", async () => {
        const res = await provisionHealthConnectPairingAction();
        if (res.pairing) ctx.setActiveHcPairing(res.pairing);
        if (res.status) ctx.setHcPairingStatus(res.status);
        ctx.setFeedback(res.feedback);
      }),
    onRevoke: () =>
      void ctx.runAction("hc-revoke", async () => {
        const res = await revokeHealthConnectPairingAction();
        ctx.setActiveHcPairing(null);
        if (res.status) ctx.setHcPairingStatus(res.status);
        ctx.setFeedback(res.feedback);
      }),
    onRefreshStatus: () =>
      void ctx.runAction("hc-refresh", async () => {
        const status = await fetchHealthConnectPairingStatus();
        if (status) ctx.setHcPairingStatus(status);
        ctx.setFeedback(
          status?.lastSyncAt || status?.lastTestPingAt
            ? { kind: "ok", text: "Phone connection verified." }
            : { kind: "ok", text: "Refreshed Health Connect pairing status." },
        );
      }),
    onSimulateHealthConnect: () =>
      void ctx.runAction("hc-sim", async () => {
        const fb = await simulateHealthConnectAction();
        if (fb?.kind === "ok") await ctx.loadAll();
        ctx.setFeedback(fb);
      }),
  };
}
