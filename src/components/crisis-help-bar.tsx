import { CRISIS_RESOURCES } from "@/lib/constants";

export function CrisisHelpBar() {
  return (
    <div
      role="region"
      aria-label="Immediate support and emergency help"
      data-testid="crisis-help-bar"
      className="border-b border-border-hairline bg-surface-muted/95 text-ink-primary"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-xs">
          <span className="inline-flex items-center gap-2 font-semibold text-ink-primary">
            <span
              aria-hidden="true"
              className="relative flex h-2 w-2 items-center justify-center"
            >
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500/40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-700" />
            </span>
            Need someone right now?
          </span>
          <span className="text-ink-secondary">
            Direct connection to a person — nothing automated in between.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <a
            href="tel:112"
            data-testid="crisis-link-112"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-rose-300/90 bg-rose-50 px-3.5 py-2 font-semibold text-rose-950 shadow-2xs transition hover:border-rose-400 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
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
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-tactile bg-surface-card px-3.5 py-2 font-medium text-ink-primary shadow-2xs transition hover:border-ink-muted hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
          >
            <span>MIELI Crisis Helpline 09 2525 0111 — 24/7 person</span>
          </a>

          {CRISIS_RESOURCES.filter((r) => r.kind === "clinic").map((clinic) => (
            <a
              key={clinic.id}
              href={clinic.href}
              data-testid="crisis-link-clinic"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-tactile bg-surface-card px-3.5 py-2 font-medium text-ink-primary shadow-2xs transition hover:border-ink-muted hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
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
