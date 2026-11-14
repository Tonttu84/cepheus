import {
  CHECK_IN_ITEMS,
  CRISIS_RESOURCES,
  MEASUREMENT_METHODS,
  PHQ9_ITEMS,
} from "@/lib/constants";
import { SimulatedBadge } from "@/components/simulated-badge";
import { CheckInInteractive } from "@/components/check-in-interactive";

export default function CheckInPage() {
  const coreMethods = MEASUREMENT_METHODS.filter((m) => m.core);

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-xs sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Twice-weekly check-in & fortnightly PHQ-9" />
          <span className="rounded-full border border-border-hairline bg-surface-subtle px-3 py-1 text-xs font-medium text-ink-secondary">
            Takes ~20 seconds · Zero effort when unwell
          </span>
        </div>

        <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight text-ink-primary sm:text-3xl">
          Twice-weekly wellbeing check-in &amp; fortnightly PHQ-9
        </h1>
        <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-ink-secondary">
          Designed for low effort after TMS treatment. You can answer four brief
          1–5 tap questions twice a week, or tap{" "}
          <strong className="font-semibold text-ink-primary">
            &ldquo;Not today&rdquo;
          </strong>{" "}
          at any time. A skipped or missed check-in is recorded simply as a
          missed round — never scored as zero and never punished.
        </p>
      </section>

      {/* 4 Low-Effort Check-In Prompts (Interactive) */}
      <CheckInInteractive items={CHECK_IN_ITEMS} />

      {/* Active Consent Transparency Note */}
      <section
        aria-label="Active consent transparency"
        className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-xs sm:p-7"
      >
        <h2 className="font-display text-lg font-semibold text-ink-primary">
          What is recorded &amp; your consent controls
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Every wellbeing check-in channel states in plain language what is
          recorded and which broad life area it belongs to.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {coreMethods.map((method) => (
            <div
              key={method.method}
              className="rounded-xl border border-border-hairline bg-surface-subtle/80 p-4"
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
      </section>

      {/* Fortnightly PHQ-9 & Prominent Crisis Support Reminder */}
      <section
        aria-label="Fortnightly PHQ-9 and immediate human support"
        className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-xs sm:p-7"
      >
        <h2 className="font-display text-lg font-semibold text-ink-primary">
          Fortnightly PHQ-9 &amp; Immediate Human Crisis Path
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
          Every two weeks, the standard {PHQ9_ITEMS.length}-item PHQ-9
          questionnaire checks in on sleep, energy, appetite, concentration, and
          safety. Any response indicating thoughts of self-harm (Item 9) brings
          up direct connection to a human and emergency services immediately —
          with nothing automated in between.
        </p>

        <div className="mt-5 rounded-xl border border-amber-300/80 bg-amber-50/70 p-5">
          <p className="text-sm font-semibold text-ink-primary">
            Direct human support is always available right now
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            Whether or not you complete a check-in, you can reach a person
            directly at any hour:
          </p>
          <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {CRISIS_RESOURCES.map((resource) => (
              <a
                key={resource.id}
                href={resource.href}
                className="flex min-h-11 flex-col justify-between rounded-xl border border-border-tactile bg-surface-card p-3.5 shadow-2xs transition hover:border-accent-sage/50 hover:bg-surface-subtle"
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
      </section>
    </div>
  );
}
