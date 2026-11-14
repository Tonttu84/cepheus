import type { MonitoringSummaryPayload } from "@/server/monitoring/store";

interface ConsentSectionProps {
  consents: MonitoringSummaryPayload["consents"];
  busyAction: string | null;
  onToggleConsent: (method: string, nextEnabled: boolean) => void;
}

export function ConsentSection({
  consents,
  busyAction,
  onToggleConsent,
}: ConsentSectionProps) {
  return (
    <section
      aria-label="Per-method consent controls"
      className="rounded-2xl border border-border-hairline bg-surface-card p-7 shadow-xs sm:p-10"
    >
      <h2 className="font-display text-lg font-semibold text-ink-primary">
        1. Separate consent switches (your control)
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
        Each passive channel can be switched on or paused independently. When a
        switch is paused, the server refuses incoming readings for that channel
        and stores nothing.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {consents.map((c) => (
          <div
            key={c.method}
            data-testid={`consent-card-${c.method}`}
            className="flex flex-col justify-between rounded-xl border border-border-hairline bg-surface-subtle/80 p-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink-primary">
                  {c.label}
                </span>
                <span
                  className={
                    c.enabled
                      ? "rounded-full border border-accent-sage-border bg-accent-sage-soft px-2.5 py-0.5 text-xs font-medium text-accent-sage-hover"
                      : "rounded-full border border-border-hairline bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-secondary"
                  }
                >
                  {c.enabled ? "Active" : "Paused"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                {c.recordedDescription}
              </p>
            </div>

            <button
              type="button"
              data-testid={`toggle-consent-${c.method}`}
              disabled={busyAction !== null}
              onClick={() => onToggleConsent(c.method, !c.enabled)}
              className="mt-4 min-h-11 cursor-pointer rounded-xl border border-border-tactile bg-surface-card px-4 py-2 text-xs font-semibold text-ink-primary transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50"
            >
              {c.enabled ? "Pause this method" : "Enable this method"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
