export const TIMEOUT_MS = 10_000;
export const FETCH_TIMEOUT_MS = TIMEOUT_MS;

export type Feedback = { kind: "ok" | "error"; text: string } | null;

function isTimeoutError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.name === "TimeoutError" ||
      err.name === "AbortError" ||
      err.message.toLowerCase().includes("timed out") ||
      err.message.toLowerCase().includes("timeout")
    );
  }
  return false;
}

export async function toggleConsentAction(
  method: string,
  nextEnabled: boolean,
): Promise<Feedback> {
  try {
    const res = await fetch("/api/monitoring/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, enabled: nextEnabled }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
  } catch (err) {
    if (isTimeoutError(err)) {
      return {
        kind: "error",
        text: "Request timed out.",
      };
    }
    return {
      kind: "error",
      text: "Failed to update consent setting.",
    };
  }
}

export async function fitbitSyncAction(
  mode: "live" | "simulated",
): Promise<Feedback> {
  try {
    const res = await fetch("/api/fitbit/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
  } catch (err) {
    if (isTimeoutError(err)) {
      return { kind: "error", text: "Request timed out." };
    }
    return { kind: "error", text: "Fitbit sync failed." };
  }
}

export async function simulateHealthConnectAction(): Promise<Feedback> {
  try {
    const previewRes = await fetch("/api/monitoring/summary", {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
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
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
  } catch (err) {
    if (isTimeoutError(err)) {
      return {
        kind: "error",
        text: "Request timed out.",
      };
    }
    return {
      kind: "error",
      text: "Health Connect webhook ingest failed.",
    };
  }
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
  try {
    const res = await fetch("/api/arduino/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildArduinoPayload()),
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
  } catch (err) {
    if (isTimeoutError(err)) {
      return {
        feedback: {
          kind: "error",
          text: "Request timed out.",
        },
      };
    }
    return {
      feedback: {
        kind: "error",
        text: "Arduino UNO Q ingest failed.",
      },
    };
  }
}
