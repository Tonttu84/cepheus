export type Feedback = { kind: "ok" | "error"; text: string } | null;

export async function toggleConsentAction(
  method: string,
  nextEnabled: boolean,
): Promise<Feedback> {
  const res = await fetch("/api/monitoring/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, enabled: nextEnabled }),
  });
  const json = (await res.json()) as { ok: boolean; error?: string };
  if (!res.ok || !json.ok) {
    return {
      kind: "error",
      text: json.error ?? "Failed to update consent setting.",
    };
  }
  return {
    kind: "ok",
    text: `Updated consent for ${method}: ${nextEnabled ? "enabled" : "paused"}.`,
  };
}

export async function fitbitSyncAction(
  mode: "live" | "simulated",
): Promise<Feedback> {
  const res = await fetch("/api/fitbit/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  const json = (await res.json()) as {
    ok: boolean;
    error?: string;
    savedDays?: number;
  };
  if (!res.ok || !json.ok) {
    return { kind: "error", text: json.error ?? "Fitbit sync failed." };
  }
  const days = json.savedDays ?? 7;
  return {
    kind: "ok",
    text:
      mode === "simulated"
        ? `Synced ${days} simulated Fitbit days and updated circadian rhythm metrics.`
        : `Synced ${days} live Fitbit days and updated circadian rhythm metrics.`,
  };
}

export async function simulateHealthConnectAction(): Promise<Feedback> {
  const previewRes = await fetch("/api/monitoring/summary", { method: "POST" });
  const previewJson = (await previewRes.json()) as {
    ok: boolean;
    payload?: unknown;
  };
  if (!previewRes.ok || !previewJson.ok || !previewJson.payload) {
    return {
      kind: "error",
      text: "Could not build simulated Health Connect payload.",
    };
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
  };
  if (!res.ok || !json.ok) {
    return {
      kind: "error",
      text: json.error ?? "Health Connect webhook ingest failed.",
    };
  }
  return {
    kind: "ok",
    text: `Ingested ${json.savedDays ?? 7} simulated Health Connect days via /api/webhooks/health-connect and updated rhythm metrics.`,
  };
}

function buildArduinoPayload() {
  return {
    deviceId: "unoq-home-demo",
    date: new Date().toISOString().slice(0, 10),
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
  };
}

export async function simulateArduinoPushAction(): Promise<{
  feedback: Feedback;
  lightCue?: { activateRingLightCue: boolean; reason: string };
}> {
  const res = await fetch("/api/arduino/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildArduinoPayload()),
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
    return {
      feedback: {
        kind: "error",
        text: json.error ?? "Arduino UNO Q ingest failed.",
      },
    };
  }
  const skipped =
    json.skippedForConsent && json.skippedForConsent.length > 0
      ? ` (paused by consent: ${json.skippedForConsent.join(", ")})`
      : "";
  return {
    lightCue: json.lightCue,
    feedback: {
      kind: "ok",
      text: `Stored simulated Arduino UNO Q summary (0 bytes video): camera=${json.savedCamera ? "saved" : "skipped"}, routine=${json.savedRoutineCount ?? 0}${skipped}.`,
    },
  };
}
