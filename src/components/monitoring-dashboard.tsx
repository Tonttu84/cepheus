"use client";

import { useCallback, useEffect, useState } from "react";
import { ForestDivider } from "@/components/forest-divider";
import {
  fitbitSyncAction,
  simulateArduinoPushAction,
  simulateHealthConnectAction,
  toggleConsentAction,
  type Feedback,
} from "@/components/monitoring/actions";
import { ArduinoSection } from "@/components/monitoring/arduino-section";
import { ConsentSection } from "@/components/monitoring/consent-section";
import {
  WearableSection,
  type FitbitStatus,
} from "@/components/monitoring/wearable-section";
import type { MonitoringSummaryPayload } from "@/server/monitoring/store";
import { ArduinoBedsideControls } from "./arduino-bedside-controls";

export function MonitoringDashboard() {
  const [fitbitStatus, setFitbitStatus] = useState<FitbitStatus | null>(null);
  const [hcConfigured, setHcConfigured] = useState(false);
  const [summary, setSummary] = useState<MonitoringSummaryPayload | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [lightCueReason, setLightCueReason] = useState<string | null>(null);
  const [lightCueActive, setLightCueActive] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [statusRes, summaryRes] = await Promise.all([
        fetch("/api/fitbit/status", { cache: "no-store" }),
        fetch("/api/monitoring/summary", { cache: "no-store" }),
      ]);
      if (statusRes.ok) {
        setFitbitStatus((await statusRes.json()) as FitbitStatus);
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
  }, []);

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
        busyAction={busyAction}
        onToggleConsent={(method, nextEnabled) =>
          void runAction(`consent-${method}`, async () => {
            const fb = await toggleConsentAction(method, nextEnabled);
            if (fb?.kind === "ok") await loadAll();
            setFeedback(fb);
          })
        }
      />

      <ForestDivider variant="grove" />
      <WearableSection
        fitbitStatus={fitbitStatus}
        hcConfigured={hcConfigured}
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
        onSimulateHealthConnect={() =>
          void runAction("hc-sim", async () => {
            const fb = await simulateHealthConnectAction();
            if (fb?.kind === "ok") await loadAll();
            setFeedback(fb);
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
