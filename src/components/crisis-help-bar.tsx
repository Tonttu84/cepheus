import { CRISIS_RESOURCES } from "@/lib/constants";

export function CrisisHelpBar() {
  return (
    <div
      role="region"
      aria-label="Immediate support and emergency help"
      data-testid="crisis-help-bar"
      className="border-b border-border-hairline bg-surface-subtle text-ink-primary"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-1.5 px-4 py-2 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-1.5 sm:px-6 sm:py-1.5 lg:flex-nowrap">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1.5 font-semibold text-ink-primary">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-700"
            />
            Need someone right now?
          </span>
          <span className="text-ink-secondary">
            Direct connection to a person — nothing automated in between.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
          <a
            href="tel:112"
            data-testid="crisis-link-112"
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 font-semibold text-rose-950 transition hover:border-rose-400 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-rose-700"
            />
            <span className="tabular-nums">Emergency 112</span>
          </a>

          <a
            href="tel:+358925250111"
            data-testid="crisis-link-mieli"
            className="tabular-nums inline-flex items-center gap-1 rounded-full border border-border-tactile bg-surface-card px-2.5 py-1 font-medium text-ink-primary transition hover:border-ink-muted hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
          >
            <span>MIELI 09 2525 0111</span>
          </a>

          {CRISIS_RESOURCES.filter((r) => r.kind === "clinic").map((clinic) => (
            <a
              key={clinic.id}
              href={clinic.href}
              data-testid="crisis-link-clinic"
              className="tabular-nums inline-flex items-center gap-1 rounded-full border border-border-tactile bg-surface-card px-2.5 py-1 font-medium text-ink-primary transition hover:border-ink-muted hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
            >
              <span>Nurse {clinic.phone}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
