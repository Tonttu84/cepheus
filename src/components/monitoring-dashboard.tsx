"use client";

import { useCallback, useEffect, useState } from "react";
import type { MonitoringSummaryPayload } from "@/server/monitoring/store";
import { ArduinoBedsideControls } from "./arduino-bedside-controls";

interface FitbitStatus {
  configured: boolean;
  connected: boolean;
  scope: string | null;
  expiresAtMs: number | null;
}

export function MonitoringDashboard() {
  const [fitbitStatus, setFitbitStatus] = useState<FitbitStatus | null>(null);
  const [hcConfigured, setHcConfigured] = useState<boolean>(false);
  const [summary, setSummary] = useState<MonitoringSummaryPayload | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [lightCueReason, setLightCueReason] = useState<string | null>(null);
  const [lightCueActive, setLightCueActive] = useState<boolean>(false);

  const loadAll = useCallback(async () => {
    try {
      const [statusRes, summaryRes] = await Promise.all([
        fetch("/api/fitbit/status", { cache: "no-store" }),
        fetch("/api/monitoring/summary", { cache: "no-store" }),
      ]);
      if (statusRes.ok) {
        const st = (await statusRes.json()) as FitbitStatus;
        setFitbitStatus(st);
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

  async function handleToggleConsent(method: string, nextEnabled: boolean) {
    setBusyAction(`consent-${method}`);
    setFeedback(null);
    try {
      const res = await fetch("/api/monitoring/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, enabled: nextEnabled }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setFeedback({
          kind: "error",
          text: json.error ?? "Failed to update consent setting.",
        });
      } else {
        await loadAll();
        setFeedback({
          kind: "ok",
          text: `Updated consent for ${method}: ${nextEnabled ? "enabled" : "paused"}.`,
        });
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleFitbitSync(mode: "live" | "simulated") {
    setBusyAction(`fitbit-${mode}`);
    setFeedback(null);
    try {
      const res = await fetch("/api/fitbit/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        savedDays?: number;
        rhythmComputed?: boolean;
        mode?: string;
      };
      if (!res.ok || !json.ok) {
        setFeedback({
          kind: "error",
          text: json.error ?? "Fitbit sync failed.",
        });
      } else {
        await loadAll();
        setFeedback({
          kind: "ok",
          text:
            mode === "simulated"
              ? `Synced ${json.savedDays ?? 7} simulated Fitbit days and updated circadian rhythm metrics.`
              : `Synced ${json.savedDays ?? 7} live Fitbit days and updated circadian rhythm metrics.`,
        });
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleFitbitDisconnect() {
    setBusyAction("fitbit-disconnect");
    setFeedback(null);
    try {
      const res = await fetch("/api/fitbit/disconnect", { method: "POST" });
      if (res.ok) {
        await loadAll();
        setFeedback({
          kind: "ok",
          text: "Fitbit session disconnected and encrypted token cookie cleared.",
        });
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSimulateHealthConnect() {
    setBusyAction("hc-sim");
    setFeedback(null);
    try {
      const previewRes = await fetch("/api/monitoring/summary", {
        method: "POST",
      });
      const previewJson = (await previewRes.json()) as {
        ok: boolean;
        payload?: unknown;
      };
      if (!previewRes.ok || !previewJson.ok || !previewJson.payload) {
        setFeedback({
          kind: "error",
          text: "Could not build simulated Health Connect payload.",
        });
        return;
      }

      const res = await fetch("/api/webhooks/health-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previewJson.payload),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        savedDays?: number;
        rhythmComputed?: boolean;
      };
      if (!res.ok || !json.ok) {
        setFeedback({
          kind: "error",
          text: json.error ?? "Health Connect webhook ingest failed.",
        });
      } else {
        await loadAll();
        setFeedback({
          kind: "ok",
          text: `Ingested ${json.savedDays ?? 7} simulated Health Connect days via /api/webhooks/health-connect and updated rhythm metrics.`,
        });
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSimulateArduinoPush() {
    setBusyAction("arduino-sim");
    setFeedback(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/arduino/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "unoq-home-demo",
          date: today,
          hourOfDay: 14,
          isSimulated: true,
          camera: {
            taskId: "uno_q_desk_sample",
            durationSec: 20,
            effectiveFps: 15,
            faceDetectedRatio: 0.91,
            expressivityScore: 0.068,
            smileFraction: 0.12,
            yawSdDeg: 2.8,
            pitchSdDeg: 2.1,
            angularPathDegPerMin: 132.4,
          },
          routine: {
            sensorActive: true,
            stationaryMinutes: 215,
            longestBoutMinutes: 110,
            prolongedBoutCount: 2,
            ambientLuxMean: 42,
            lowLightDaytimeHours: 4,
          },
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        savedCamera?: boolean;
        savedRoutineCount?: number;
        skippedForConsent?: string[];
        lightCue?: { activateRingLightCue: boolean; reason: string };
      };
      if (!res.ok || !json.ok) {
        setFeedback({
          kind: "error",
          text: json.error ?? "Arduino UNO Q ingest failed.",
        });
      } else {
        if (json.lightCue) {
          setLightCueActive(json.lightCue.activateRingLightCue);
          setLightCueReason(json.lightCue.reason);
        }
        await loadAll();
        const skipped =
          json.skippedForConsent && json.skippedForConsent.length > 0
            ? ` (paused by consent: ${json.skippedForConsent.join(", ")})`
            : "";
        setFeedback({
          kind: "ok",
          text: `Stored simulated Arduino UNO Q summary (0 bytes video): camera=${json.savedCamera ? "saved" : "skipped"}, routine=${json.savedRoutineCount ?? 0}${skipped}.`,
        });
      }
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
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-amber-300 bg-amber-50 text-amber-950"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {/* 1. Per-method Consent Controls */}
      <section
        aria-label="Per-method consent controls"
        className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs"
      >
        <h2 className="text-base font-semibold text-stone-900">
          1. Separate consent switches (your control)
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-stone-600">
          Each passive channel can be switched on or paused independently. If a
          switch is off, the server refuses incoming readings for that channel
          and stores nothing.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {(summary?.consents ?? []).map((c) => (
            <div
              key={c.method}
              data-testid={`consent-card-${c.method}`}
              className="flex flex-col justify-between rounded-lg border border-stone-200 bg-stone-50 p-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-stone-900">
                    {c.label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      c.enabled
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-stone-200 text-stone-700"
                    }`}
                  >
                    {c.enabled ? "Active" : "Paused"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                  {c.recordedDescription}
                </p>
              </div>

              <button
                type="button"
                data-testid={`toggle-consent-${c.method}`}
                disabled={busyAction !== null}
                onClick={() => handleToggleConsent(c.method, !c.enabled)}
                className="mt-4 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50 cursor-pointer"
              >
                {c.enabled ? "Pause this method" : "Enable this method"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Fitbit Cloud OAuth2 + Rhythm Window */}
      <section
        aria-label="Fitbit sleep and activity sync"
        className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs space-y-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              2. Fitbit passive sleep &amp; rest-activity rhythm (OAuth2 PKCE)
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-stone-600">
              One-time Fitbit sign-in removes the need for native Apple Health
              or Google Health Connect apps. Tokens stay sealed in HttpOnly
              AES-256-GCM cookies and never appear in browser JavaScript.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {fitbitStatus?.configured ? (
              fitbitStatus.connected ? (
                <>
                  <button
                    type="button"
                    data-testid="fitbit-sync-live"
                    disabled={busyAction !== null}
                    onClick={() => handleFitbitSync("live")}
                    className="rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
                  >
                    Sync last 7 days (Fitbit)
                  </button>
                  <button
                    type="button"
                    data-testid="fitbit-disconnect"
                    disabled={busyAction !== null}
                    onClick={handleFitbitDisconnect}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50 cursor-pointer"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <a
                  href="/api/fitbit/auth"
                  data-testid="fitbit-connect-link"
                  className="rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-stone-800"
                >
                  Connect Fitbit (PKCE)
                </a>
              )
            ) : (
              <span className="rounded-md border border-stone-200 bg-stone-100 px-2.5 py-1.5 text-xs text-stone-700">
                Fitbit OAuth env vars not set (use simulated sync below)
              </span>
            )}

            <button
              type="button"
              data-testid="fitbit-sync-simulated"
              disabled={busyAction !== null}
              onClick={() => handleFitbitSync("simulated")}
              className="rounded-lg border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50 cursor-pointer"
            >
              Simulate 7-day Fitbit sync
            </button>
          </div>
        </div>

        {/* Trail #23 Health Connect / Apple Health Webhook bridge */}
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                Android Health Connect &amp; Apple Health Webhook (Trail #23)
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-stone-600">
                Supports <strong>Health Connect to Webhook</strong> (Google Play)
                and <strong>Life Dashboard Companion</strong> (Android &amp; iOS,
                HMAC-SHA256 <code>X-Signature</code>) so Fitbit, Oura, Garmin, or
                Samsung watches push sleep stages, steps, HR, and HRV directly to{" "}
                <code>POST /api/webhooks/health-connect</code>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700">
                {hcConfigured
                  ? "Webhook secret configured"
                  : "Set HEALTH_CONNECT_WEBHOOK_SECRET for live phone sync"}
              </span>
              <button
                type="button"
                data-testid="health-connect-simulate"
                disabled={busyAction !== null}
                onClick={handleSimulateHealthConnect}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50 cursor-pointer"
              >
                Simulate Health Connect webhook push
              </button>
            </div>
          </div>
        </div>

        {summary?.latestRhythmWindow ? (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                7-Day Circadian Window ending{" "}
                {summary.latestRhythmWindow.windowEndDate} (
                {summary.latestRhythmWindow.validDays} valid days)
              </span>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-950">
                {summary.latestRhythmWindow.isSimulated
                  ? "Simulated wearable data"
                  : "Live wearable data"}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-md border border-stone-200 bg-white p-2.5">
                <dt className="text-[11px] text-stone-500">Relative Amplitude</dt>
                <dd className="mt-0.5 text-sm font-semibold text-stone-900">
                  {summary.latestRhythmWindow.relativeAmplitude.toFixed(3)}
                </dd>
              </div>
              <div className="rounded-md border border-stone-200 bg-white p-2.5">
                <dt className="text-[11px] text-stone-500">Interdaily Stability</dt>
                <dd className="mt-0.5 text-sm font-semibold text-stone-900">
                  {summary.latestRhythmWindow.interdailyStability.toFixed(3)}
                </dd>
              </div>
              <div className="rounded-md border border-stone-200 bg-white p-2.5">
                <dt className="text-[11px] text-stone-500">Intradaily Var.</dt>
                <dd className="mt-0.5 text-sm font-semibold text-stone-900">
                  {summary.latestRhythmWindow.intradailyVariability.toFixed(3)}
                </dd>
              </div>
              <div className="rounded-md border border-stone-200 bg-white p-2.5">
                <dt className="text-[11px] text-stone-500">Sleep Reg. (SRI)</dt>
                <dd className="mt-0.5 text-sm font-semibold text-stone-900">
                  {summary.latestRhythmWindow.sri !== null
                    ? summary.latestRhythmWindow.sri.toFixed(1)
                    : "n/a"}
                </dd>
              </div>
              <div className="rounded-md border border-stone-200 bg-white p-2.5">
                <dt className="text-[11px] text-stone-500">Midpoint SD</dt>
                <dd className="mt-0.5 text-sm font-semibold text-stone-900">
                  {summary.latestRhythmWindow.sleepMidpointSdMin !== null
                    ? `${summary.latestRhythmWindow.sleepMidpointSdMin.toFixed(0)} min`
                    : "n/a"}
                </dd>
              </div>
              <div className="rounded-md border border-stone-200 bg-white p-2.5">
                <dt className="text-[11px] text-stone-500">Mean steps / day</dt>
                <dd className="mt-0.5 text-sm font-semibold text-stone-900">
                  {summary.latestRhythmWindow.stepsMean !== null
                    ? Math.round(summary.latestRhythmWindow.stepsMean)
                    : "n/a"}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-xs text-stone-600">
            No wearable rhythm window synced yet. Connect Fitbit or click{" "}
            <strong>Simulate 7-day Fitbit sync</strong> to calculate RA, IS, IV,
            and Sleep Regularity Index.
          </p>
        )}
      </section>

      {/* 3. Arduino UNO Q Edge Hub */}
      <section
        aria-label="Arduino UNO Q edge hub"
        className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs space-y-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              3. Arduino UNO Q + External USB Camera (24/7 Home Edge Node)
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-stone-600">
              Processes camera frames strictly on the Arduino board in memory
              and pushes only derived numbers to{" "}
              <code>POST /api/arduino/ingest</code>: prolonged daytime
              stationary bouts, ambient room daylight (lux), and brief
              facial/head movement metrics. Never stores raw video or audio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ArduinoBedsideControls onFeedback={setFeedback} />
            <button
              type="button"
              data-testid="arduino-simulate-push"
              disabled={busyAction !== null}
              onClick={handleSimulateArduinoPush}
              className="rounded-lg border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50 cursor-pointer"
            >
              Simulate Arduino UNO Q push
            </button>
          </div>
        </div>

        {lightCueReason ? (
          <div
            data-testid="arduino-light-cue"
            className={`rounded-lg border p-3.5 text-xs ${
              lightCueActive
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-stone-200 bg-stone-50 text-stone-700"
            }`}
          >
            <strong>
              Desk ring-light cue:{" "}
              {lightCueActive ? "Suggested (dim room + long stationary bout)" : "Off"}
            </strong>{" "}
            — {lightCueReason}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              Latest derived camera movement (0 bytes video)
            </h3>
            {summary?.recentCameraReadings &&
            summary.recentCameraReadings.length > 0 ? (
              <ul className="mt-2.5 space-y-2 text-xs">
                {summary.recentCameraReadings.slice(0, 3).map((r, idx) => (
                  <li
                    key={`${r.date}-${idx}`}
                    className="flex items-center justify-between rounded border border-stone-200 bg-white px-3 py-2"
                  >
                    <span>
                      <strong>{r.date}</strong> · exp{" "}
                      {r.expressivityScore.toFixed(3)} · head{" "}
                      {r.angularPathDegPerMin.toFixed(1)}°/min
                    </span>
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700">
                      {r.isSimulated ? "Simulated" : r.source}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-stone-500">
                No Arduino camera summaries ingested yet.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              Latest immobility &amp; daylight routine (broad area: daily_routine)
            </h3>
            {summary?.recentRoutineReadings &&
            summary.recentRoutineReadings.length > 0 ? (
              <ul className="mt-2.5 space-y-2 text-xs">
                {summary.recentRoutineReadings.slice(0, 4).map((r, idx) => (
                  <li
                    key={`${r.channel}-${idx}`}
                    className="flex items-center justify-between rounded border border-stone-200 bg-white px-3 py-2"
                  >
                    <span>
                      <strong>{r.channel}</strong>: {r.derivedValue} {r.unit}
                    </span>
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700">
                      {r.isSimulated ? "Simulated" : r.source}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-stone-500">
                No home immobility or daylight summaries ingested yet.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
