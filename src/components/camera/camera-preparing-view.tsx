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
      className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xs"
    >
      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
      <h2 className="mt-3 text-base font-semibold text-stone-900">
        {state === "loading_model"
          ? "Preparing on-device analysis tools..."
          : "Opening camera on this device..."}
      </h2>
      <p className="mt-1 text-xs text-stone-600">
        Everything runs in your browser without transmitting video bytes.
      </p>
      <div className="mt-5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-stone-600 focus-visible:ring-offset-2 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
