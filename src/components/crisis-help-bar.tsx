import { CRISIS_RESOURCES } from "@/lib/constants";

export function CrisisHelpBar() {
  return (
    <div
      role="region"
      aria-label="Immediate support and emergency help"
      data-testid="crisis-help-bar"
      className="border-b border-[#e4ddd2] bg-[#f1ece4]/95 text-[#1a2421]"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-[13px]">
          <span className="inline-flex items-center gap-2 font-semibold text-[#1a2421]">
            <span
              aria-hidden="true"
              className="relative flex h-2 w-2 items-center justify-center"
            >
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500/40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-700" />
            </span>
            Need someone right now?
          </span>
          <span className="text-[#515d58]">
            Direct connection to a person — nothing automated in between.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <a
            href="tel:112"
            data-testid="crisis-link-112"
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/90 bg-rose-50 px-3 py-1 font-semibold text-rose-950 shadow-2xs transition hover:border-rose-400 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-rose-700"
            />
            <span>Emergency 112</span>
          </a>

          <a
            href="tel:+358925250111"
            data-testid="crisis-link-mieli"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#d6cfc4] bg-white px-3 py-1 font-medium text-[#1a2421] shadow-2xs transition hover:border-[#b9b0a2] hover:bg-[#faf8f5] focus:outline-none focus:ring-2 focus:ring-[#255748]"
          >
            <span>MIELI Crisis Helpline 09 2525 0111 — 24/7 person</span>
          </a>

          {CRISIS_RESOURCES.filter((r) => r.kind === "clinic").map((clinic) => (
            <a
              key={clinic.id}
              href={clinic.href}
              data-testid="crisis-link-clinic"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d6cfc4] bg-white px-3 py-1 font-medium text-[#2d3b36] shadow-2xs transition hover:border-[#b9b0a2] hover:bg-[#faf8f5] focus:outline-none focus:ring-2 focus:ring-[#255748]"
            >
              <span>
                {clinic.label}: {clinic.phone}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
