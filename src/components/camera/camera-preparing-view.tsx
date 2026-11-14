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
      className="rounded-2xl border border-[#e4ddd2] bg-white p-8 text-center shadow-xs"
    >
      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#d6cfc4] border-t-[#255748]" />
      <h2 className="font-display mt-3 text-lg font-semibold text-[#1a2421]">
        {state === "loading_model"
          ? "Preparing on-device analysis tools..."
          : "Opening camera on this device..."}
      </h2>
      <p className="mt-1 text-xs text-[#515d58]">
        Everything runs in your browser without transmitting video bytes.
      </p>
      <div className="mt-5">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-xl border border-[#d6cfc4] bg-white px-4 py-2 text-xs font-medium text-[#515d58] hover:bg-[#faf8f5] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#255748] focus-visible:ring-offset-2"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
