export type CameraAccessFailure =
  | { kind: "permission_denied" }
  | { kind: "no_camera" }
  | { kind: "error"; message: string };

export type ObtainCameraStreamResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; failure: CameraAccessFailure };

/**
 * Safely stops all tracks on a MediaStream.
 */
export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // ignore track stop error
    }
  }
}

/**
 * Safely stops animation frame, terminates tracks on active stream, and clears video srcObject.
 */
export function releaseCameraHardware({
  animationFrameId,
  stream,
  video,
}: {
  animationFrameId: number | null;
  stream: MediaStream | null;
  video: HTMLVideoElement | null;
}): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
  if (stream) {
    stopMediaStream(stream);
  }
  if (video) {
    video.srcObject = null;
  }
}

/**
 * Requests camera hardware access via getUserMedia with error classification and immediate cancellation check.
 */
export async function obtainCameraMediaStream(
  isCancelled: () => boolean
): Promise<ObtainCameraStreamResult> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    });
  } catch (err) {
    if (isCancelled()) {
      return { ok: false, cancelled: true };
    }
    const e = err as { name?: string; message?: string };
    if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
      return {
        ok: false,
        cancelled: false,
        failure: { kind: "permission_denied" },
      };
    }
    if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
      return {
        ok: false,
        cancelled: false,
        failure: { kind: "no_camera" },
      };
    }
    return {
      ok: false,
      cancelled: false,
      failure: {
        kind: "error",
        message: e.message ?? "Failed to access camera",
      },
    };
  }

  // Check immediately after getUserMedia: if cancelled, stop all tracks right away
  if (isCancelled()) {
    stopMediaStream(stream);
    return { ok: false, cancelled: true };
  }

  return { ok: true, stream };
}

/**
 * Attaches the media stream to the video element, starts playback, and cancels immediately if cancelled.
 */
export async function attachStreamToVideo(
  video: HTMLVideoElement | null,
  stream: MediaStream,
  isCancelled: () => boolean
): Promise<boolean> {
  if (video) {
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // Handled if play is interrupted
    }
  }

  // Check immediately after video play: if cancelled, release tracks and clear video feed
  if (isCancelled()) {
    stopMediaStream(stream);
    if (video && video.srcObject === stream) {
      video.srcObject = null;
    }
    return false;
  }

  return true;
}
