import { SimulatedBadge } from "@/components/simulated-badge";
import {
  ForestCanopyArtwork,
  ForestDivider,
} from "@/components/forest-divider";
import {
  LandingCheckInSandbox,
  LandingDemoLaunchActions,
} from "@/components/landing/landing-checkin-sandbox";
import { LandingDeskBuddyPanel } from "@/components/landing/landing-desk-buddy-panel";

const OUTER_LOOP_MOMENTS = [
  {
    day: "Day 18",
    title: "Steady baseline",
    summary:
      "Twice-weekly check-ins and sleep timing stay close to the person’s own first weeks after TMS. Cepheus stays quiet at home and raises no clinic flag.",
  },
  {
    day: "Day 29",
    title: "Single mild dip → One optional step for the patient",
    summary:
      "One heavier round offers a single low-effort suggestion at home (such as a short walk outside), with no scores, no streaks, and no clinic alarm.",
  },
  {
    day: "Day 56",
    title: "Sustained shift or unanswered rounds while ring stays worn",
    summary:
      "Raises a broad-area follow-up flag for the clinic nurse to call and review—or consider a 5-session TMS booster cluster—never an automated diagnosis.",
  },
] as const;

const GUARDRAIL_ROWS = [
  {
    does: "Flags sustained shifts in broad life areas (check-in, sleep, daily routine) for a clinician.",
    never:
      "Never diagnoses depression, claims treatment, or tells a patient they are relapsing.",
  },
  {
    does: "Processes camera and voice locally on the device and keeps only summary numbers.",
    never:
      "Never records video, audio, or browser-stored questionnaire answers.",
  },
  {
    does: "Summarises structured clinic numbers with optional EU-hosted Gemma (Verda, off by default).",
    never:
      "Never uses AI to read mood from a face or voice, or to decide who triggers an alert.",
  },
  {
    does: "Keeps 112, MIELI Crisis Helpline (09 2525 0111), and the clinic nurse visible on every screen.",
    never:
      "Never places an automated bot between a person in distress and human help.",
  },
] as const;

export function PublicLandingShowcase() {
  return (
    <div className="space-y-14 sm:space-y-20">
      <section aria-label="Cepheus overview" className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          <div className="space-y-6 lg:col-span-7">
            <SimulatedBadge subtitle="Beyond the Clinic · Junction 2026" />

            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-primary sm:text-5xl">
                Staying well at home after TMS, with a nurse in the loop
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-ink-secondary sm:text-lg">
                Built for Aalto University&rsquo;s Beyond the Clinic challenge,
                Cepheus bridges the quiet gap after Transcranial Magnetic
                Stimulation (TMS) with a 20-second twice-weekly wellbeing
                check-in—comparing against your own post-TMS baseline without
                scores, streaks, or diagnostic claims.
              </p>
            </div>

            <LandingDemoLaunchActions />
          </div>

          <div className="lg:col-span-5">
            <LandingCheckInSandbox />
          </div>
        </div>

        <ForestCanopyArtwork className="w-full pt-2 text-accent-sage" />
      </section>

      <section
        aria-label="How the outer loop works"
        className="rounded-2xl border border-border-hairline bg-surface-card p-6 sm:p-10 space-y-6"
      >
        <div className="max-w-3xl space-y-2">
          <h2 className="font-display text-2xl font-semibold text-ink-primary sm:text-3xl">
            Ask, warn, call: how the 8-week outer loop responds
          </h2>
          <p className="text-sm leading-relaxed text-ink-secondary sm:text-base">
            Cepheus separates everyday variation from sustained shifts so
            patients are not nudged unnecessarily and clinic nurses see clear
            context when a phone call helps.
          </p>
        </div>

        <div className="grid divide-y divide-border-hairline lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {OUTER_LOOP_MOMENTS.map((moment) => (
            <div
              key={moment.day}
              className="py-5 first:pt-2 last:pb-2 lg:px-6 lg:py-2 lg:first:pl-0 lg:last:pr-0 space-y-2"
            >
              <span className="tabular-nums inline-block rounded-full border border-border-hairline bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
                {moment.day}
              </span>
              <h3 className="font-display text-lg font-semibold text-ink-primary">
                {moment.title}
              </h3>
              <p className="text-sm leading-relaxed text-ink-secondary">
                {moment.summary}
              </p>
            </div>
          ))}
        </div>
      </section>

      <ForestDivider variant="grove" />

      <LandingDeskBuddyPanel />

      <section
        aria-label="Clinical and privacy guardrails"
        className="rounded-2xl border border-border-hairline bg-surface-card p-6 sm:p-10 space-y-6"
      >
        <div className="max-w-3xl space-y-2">
          <h2 className="font-display text-2xl font-semibold text-ink-primary sm:text-3xl">
            Built around clinical boundaries
          </h2>
          <p className="text-sm leading-relaxed text-ink-secondary sm:text-base">
            Every sensing channel and summary rule is constrained so clinical
            judgement stays with the care team and raw media never leaves the
            device.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-xs font-semibold text-ink-muted">
                <th scope="col" className="pb-3 pr-6">
                  What Cepheus does
                </th>
                <th scope="col" className="pb-3">
                  What Cepheus never does
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline">
              {GUARDRAIL_ROWS.map((row) => (
                <tr key={row.does}>
                  <td className="py-4 pr-6 align-top leading-relaxed text-ink-primary">
                    {row.does}
                  </td>
                  <td className="py-4 align-top leading-relaxed text-ink-secondary">
                    {row.never}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        data-testid="logged-out-overview-card"
        aria-label="Sign in to Cepheus workspace"
        className="rounded-2xl border border-border-hairline bg-surface-card p-6 sm:p-8 space-y-5"
      >
        <div className="max-w-2xl space-y-2">
          <h2 className="font-display text-2xl font-semibold text-ink-primary">
            Sign in to view your workspace
          </h2>
          <p className="text-sm leading-relaxed text-ink-secondary">
            Participant check-ins, sensor consent switches, and clinic follow-up
            queues stay behind role-scoped sign-in. Direct crisis support
            numbers remain available at the top of every screen.
          </p>
        </div>

        <LandingDemoLaunchActions isPrimaryCard />
      </section>
    </div>
  );
}
