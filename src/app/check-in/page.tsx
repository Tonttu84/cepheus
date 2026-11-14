import {
  CHECK_IN_ITEMS,
  CRISIS_RESOURCES,
  MEASUREMENT_METHODS,
  PHQ9_ITEMS,
} from "@/lib/constants";
import { SimulatedBadge } from "@/components/simulated-badge";
import { CheckInInteractive } from "@/components/check-in-interactive";
import {
  ForestCanopyArtwork,
  ForestDivider,
} from "@/components/forest-divider";

export default function CheckInPage() {
  const coreMethods = MEASUREMENT_METHODS.filter((m) => m.core);

  return (
    <div className="space-y-12 sm:space-y-16">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Twice-weekly check-in & fortnightly PHQ-9" />
          <span className="rounded-full border border-border-hairline bg-surface-subtle px-3 py-1 text-xs font-medium text-ink-secondary">
            About 20 seconds · Skip whenever you need to
          </span>
        </div>

        <div className="max-w-3xl space-y-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">
            Twice-weekly wellbeing check-in
          </h1>
          <p className="text-base leading-relaxed text-ink-secondary">
            You can answer two quick 0 to 4 tap questions twice a week, or tap{" "}
            <strong className="font-semibold text-ink-primary">
              &ldquo;Not today&rdquo;
            </strong>{" "}
            whenever you want to rest. This is a preview of a simulated round
            and nothing is sent yet. It is never scored as zero and never held
            against you.
          </p>
        </div>

        <ForestCanopyArtwork className="w-full pt-2 text-accent-sage" />
      </header>

      <CheckInInteractive items={CHECK_IN_ITEMS} />

      <ForestDivider variant="grove" />

      <details className="group border-t border-border-hairline pt-6">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg text-sm font-medium text-ink-secondary transition hover:text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage">
          <span>
            Data handling, your consent choices &amp; fortnightly PHQ-9
          </span>
          <span className="text-xs text-ink-muted group-open:hidden">
            Show details
          </span>
          <span className="hidden text-xs text-ink-muted group-open:inline">
            Hide details
          </span>
        </summary>

        <div className="mt-5 space-y-6 rounded-2xl border border-border-hairline bg-surface-subtle/70 p-6 text-xs leading-relaxed text-ink-secondary">
          <div>
            <h2 className="font-display text-base font-semibold text-ink-primary">
              Data handling and your consent choices
            </h2>
            <p className="mt-1 text-ink-secondary">
              Each channel below explains in plain words what it collects and
              which broad area of daily life it belongs to.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {coreMethods.map((method) => (
                <div
                  key={method.method}
                  className="rounded-xl border border-border-hairline bg-surface-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-primary">
                      {method.label}
                    </span>
                    <span className="rounded-full border border-accent-sage-border bg-accent-sage-soft px-2.5 py-0.5 text-xs font-medium text-accent-sage-hover">
                      Consented
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    {method.recordedDescription}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border-hairline pt-5">
            <h2 className="font-display text-base font-semibold text-ink-primary">
              Fortnightly PHQ-9 and direct human support
            </h2>
            <p className="mt-1.5">
              Every two weeks, the standard {PHQ9_ITEMS.length}-question PHQ-9
              asks about sleep, energy, appetite, concentration, and safety. Any
              answer above zero on question 9 (thoughts of hurting yourself)
              brings up direct phone links to a real person and emergency help
              right away, with nothing automated in between.
            </p>

            <div className="mt-4 rounded-xl border border-amber-300/80 bg-amber-50/70 p-4">
              <p className="text-sm font-semibold text-ink-primary">
                Talk with a person right now
              </p>
              <p className="mt-1 text-xs text-ink-secondary">
                You do not need to finish or start a check-in to call any of
                these numbers:
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {CRISIS_RESOURCES.map((resource) => (
                  <a
                    key={resource.id}
                    href={resource.href}
                    className="flex min-h-11 flex-col justify-between rounded-xl border border-border-tactile bg-surface-card p-3 transition hover:border-accent-sage/50 hover:bg-surface-subtle"
                  >
                    <div>
                      <p className="text-xs font-semibold text-ink-secondary">
                        {resource.label}
                      </p>
                      <p className="tabular-nums mt-1 text-sm font-bold text-ink-primary">
                        {resource.phone}
                      </p>
                    </div>
                    <p className="mt-1.5 text-xs text-ink-muted">
                      {resource.availability}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
