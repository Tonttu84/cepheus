import type { CameraSessionOutput } from "@/domain/camera";

export type CameraSaveOutcome =
  | { readonly status: "saved"; readonly readingId: string }
  | { readonly status: "consent_paused" }
  | { readonly status: "error" };

export async function saveCameraSessionNumbers(
  result: CameraSessionOutput & { hasNumbers: true }
): Promise<CameraSaveOutcome> {
  const durationSec = Math.max(0.001, result.quality.sessionDurationMs / 1000);
  const effectiveFps = result.quality.analysedFrames / durationSec;

  try {
    const res = await fetch("/api/camera/readings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId: "check_in_clip_60s",
        durationSec,
        effectiveFps,
        faceDetectedRatio: result.quality.faceShare,
        expressivityScore: result.expressivity,
        angularPathDegPerMin: result.headMovement * 60,
      }),
    });
    if (res.status === 403) {
      return { status: "consent_paused" };
    }
    if (!res.ok) {
      return { status: "error" };
    }
    const data =
      typeof res.json === "function"
        ? ((await res.json().catch(() => ({}))) as {
            saved?: boolean;
            readingId?: string;
          })
        : {};
    if (data.saved === false) {
      return { status: "error" };
    }
    return { status: "saved", readingId: data.readingId ?? "" };
  } catch {
    return { status: "error" };
  }
}
