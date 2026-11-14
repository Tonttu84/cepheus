"use client";

interface ProblemViewProps {
  onRetry: () => void;
  errorMessage?: string | null;
}

export function CameraPermissionDeniedView({ onRetry }: ProblemViewProps) {
  return (
    <section
      data-testid="permission-denied-state"
      aria-label="Camera permission refused"
      className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-xs sm:p-8"
    >
      <h2 className="font-display text-lg font-semibold text-amber-950">
        Camera access permission was not granted
      </h2>
      <p className="mt-2 text-sm text-amber-900">
        To measure movement on this device, your browser needs camera
        permission. You can enable camera access in your browser site
        settings or address bar.
      </p>
      <div className="mt-6">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-amber-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </section>
  );
}

export function CameraNotFoundView({ onRetry }: ProblemViewProps) {
  return (
    <section
      data-testid="no-camera-state"
      aria-label="No camera detected"
      className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-xs sm:p-8"
    >
      <h2 className="font-display text-lg font-semibold text-amber-950">
        No camera was found on this device
      </h2>
      <p className="mt-2 text-sm text-amber-900">
        Please plug in or connect a standard webcam, or open this check-in on a
        mobile phone or laptop with a built-in camera.
      </p>
      <div className="mt-6">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-amber-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </section>
  );
}

export function CameraModelErrorView({
  onRetry,
  errorMessage,
}: ProblemViewProps) {
  return (
    <section
      data-testid="model-error-state"
      aria-label="Model loading failure"
      className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 shadow-xs sm:p-8"
    >
      <h2 className="font-display text-lg font-semibold text-rose-950">
        Analysis tools could not be loaded
      </h2>
      <p className="mt-2 text-sm text-rose-900">
        The on-device face analysis files could not be initialized. Please
        refresh the page or check that the local files are served correctly.
      </p>
      {errorMessage && (
        <p className="mt-2 font-mono text-xs text-rose-800">{errorMessage}</p>
      )}
      <div className="mt-6">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </section>
  );
}

export function CameraNoFaceFoundView({ onRetry }: ProblemViewProps) {
  return (
    <section
      data-testid="no-face-found-state"
      aria-label="No face detected"
      className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-xs sm:p-8"
    >
      <h2 className="font-display text-lg font-semibold text-ink-primary">
        No face detected for most of the check-in
      </h2>
      <p className="mt-2 text-sm text-ink-secondary">
        A face was not visible for enough of the 20-second session to produce
        reliable movement measurements. Please make sure your camera is pointed
        at your face with frontal lighting and try again.
      </p>
      <div className="mt-6">
        <button
          type="button"
          data-testid="try-again-button"
          onClick={onRetry}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-accent-sage px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-sage-hover focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-sage focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </section>
  );
}

export function CameraGenericErrorView({
  onRetry,
  errorMessage,
}: ProblemViewProps) {
  return (
    <section
      data-testid="generic-error-state"
      aria-label="Error state"
      className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 shadow-xs sm:p-8"
    >
      <h2 className="font-display text-lg font-semibold text-rose-950">
        Check-in could not finish
      </h2>
      <p className="mt-2 text-sm text-rose-900">
        {errorMessage ??
          "An unexpected issue occurred during the check-in session."}
      </p>
      <div className="mt-6">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </section>
  );
}
