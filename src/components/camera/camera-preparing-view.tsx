"use client";

interface CameraPreparingViewProps {
  state: "loading_model" | "requesting_camera";
  onCancel: () => void;
}

export function CameraPreparingView({
  state,
  onCancel,
}: CameraPreparingViewProps) {
  return (
    <section
      aria-label="Preparing camera check"
      className="rounded-2xl border border-border-hairline bg-surface-card p-8 text-center"
    >
      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-border-tactile border-t-accent-sage" />
      <h2 className="font-display mt-3 text-xl font-semibold text-ink-primary">
        {state === "loading_model"
          ? "Preparing on-device analysis tools..."
          : "Opening camera on this device..."}
      </h2>
      <p className="mt-1.5 text-sm text-ink-secondary">
        Everything runs in your browser without transmitting video bytes.
      </p>
      <div className="mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-border-tactile bg-surface-subtle px-5 py-2 text-xs font-medium text-ink-secondary hover:bg-surface-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-sage focus-visible:ring-offset-2"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
