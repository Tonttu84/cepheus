import {
  CHECK_IN_ITEMS,
  CRISIS_RESOURCES,
  MEASUREMENT_METHODS,
  PHQ9_ITEMS,
} from "@/lib/constants";
import { SimulatedBadge } from "@/components/simulated-badge";

export default function CheckInPage() {
  const coreMethods = MEASUREMENT_METHODS.filter((m) => m.core);

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Twice-weekly check-in & fortnightly PHQ-9" />
          <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
            Takes ~20 seconds · Zero effort when unwell
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          Twice-weekly wellbeing check-in &amp; fortnightly PHQ-9
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-700">
          Designed for low effort after TMS treatment. You can answer four brief
          1–5 tap questions twice a week, or tap{" "}
          <strong className="font-semibold text-stone-900">
            &ldquo;Not today&rdquo;
          </strong>{" "}
          at any time. A skipped or missed check-in is recorded simply as a
          missed round — never scored as zero and never punished.
        </p>
      </section>

      {/* Active Consent Transparency Note */}
      <section
        aria-label="Active consent transparency"
        className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs"
      >
        <h2 className="text-base font-semibold text-stone-900">
          What is recorded &amp; your consent controls
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Every wellbeing check-in channel states in plain language what is
          recorded and which broad life area it belongs to.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {coreMethods.map((method) => (
            <div
              key={method.method}
              className="rounded-lg border border-stone-200 bg-stone-50/70 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-stone-900">
                  {method.label}
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                  Consented
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                {method.recordedDescription}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 Low-Effort Check-In Prompts Preview */}
      <section
        aria-label="Twice-weekly check-in prompts"
        className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Twice-weekly check-in prompts (4 quick taps)
            </h2>
            <p className="mt-0.5 text-sm text-stone-600">
              If 4 taps feel like too much today, you can answer a single
              overall check-in question or choose &ldquo;Not today&rdquo;.
            </p>
          </div>
          <button
            type="button"
            data-testid="not-today-button"
            className="rounded-lg border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 transition hover:bg-stone-100"
          >
            Not today (skip without penalty)
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {CHECK_IN_ITEMS.map((item, idx) => (
            <div
              key={item.key}
              className="rounded-lg border border-stone-200 bg-stone-50/60 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Prompt {idx + 1} · {item.label}
                </span>
                <span className="text-xs text-stone-500">
                  {item.lowAnchor} &rarr; {item.highAnchor}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-stone-900">
                {item.prompt}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((choice) => (
                  <span
                    key={choice}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 bg-white text-xs font-semibold text-stone-700"
                  >
                    {choice}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fortnightly PHQ-9 & Prominent Crisis Support Reminder */}
      <section
        aria-label="Fortnightly PHQ-9 and immediate human support"
        className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs"
      >
        <h2 className="text-base font-semibold text-stone-900">
          Fortnightly PHQ-9 &amp; Immediate Human Crisis Path
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Every two weeks, the standard {PHQ9_ITEMS.length}-item PHQ-9
          questionnaire checks in on sleep, energy, appetite, concentration, and
          safety. Any response indicating thoughts of self-harm (Item 9) brings
          up direct connection to a human and emergency services immediately —
          with nothing automated in between.
        </p>

        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/70 p-4">
          <p className="text-sm font-semibold text-stone-900">
            Direct human support is always available right now
          </p>
          <p className="mt-1 text-xs text-stone-700">
            Whether or not you complete a check-in, you can reach a person
            directly at any hour:
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CRISIS_RESOURCES.map((resource) => (
              <a
                key={resource.id}
                href={resource.href}
                className="flex flex-col justify-between rounded-md border border-stone-300 bg-white p-3 transition hover:bg-stone-50"
              >
                <div>
                  <p className="text-xs font-semibold text-stone-900">
                    {resource.label}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-stone-900">
                    {resource.phone}
                  </p>
                </div>
                <p className="mt-1 text-xs text-stone-600">
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
