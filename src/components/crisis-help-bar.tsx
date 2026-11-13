import { CRISIS_RESOURCES } from "@/lib/constants";

export function CrisisHelpBar() {
  return (
    <div
      role="region"
      aria-label="Immediate support and emergency help"
      data-testid="crisis-help-bar"
      className="border-b border-stone-200 bg-stone-100/95 text-stone-900"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-stone-900">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full bg-amber-600"
            />
            Need someone right now?
          </span>
          <span className="text-stone-700">
            Direct connection to a person — nothing automated in between.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <a
            href="tel:112"
            data-testid="crisis-link-112"
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 font-semibold text-rose-900 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <span>Emergency 112</span>
          </a>

          <a
            href="tel:+358925250111"
            data-testid="crisis-link-mieli"
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1 font-medium text-stone-900 transition hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-500"
          >
            <span>MIELI Crisis Helpline 09 2525 0111 — 24/7 person</span>
          </a>

          {CRISIS_RESOURCES.filter((r) => r.kind === "clinic").map((clinic) => (
            <a
              key={clinic.id}
              href={clinic.href}
              data-testid="crisis-link-clinic"
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1 font-medium text-stone-800 transition hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-500"
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
