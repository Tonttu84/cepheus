import { requireStaffPageSession } from "@/server/auth";
import { SimulatedBadge } from "@/components/simulated-badge";
import { SessionContextPill } from "@/components/session-context-banner";
import { ForestDivider } from "@/components/forest-divider";
import { ClinicCrisisAlerts } from "@/components/clinic-crisis-alerts";
import { ClinicFlagsView } from "@/components/clinic-flags-view";

export default async function ClinicPage() {
  await requireStaffPageSession();

  return (
    <div className="space-y-12 sm:space-y-16">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Clinic follow-up view" />
          <div className="flex flex-wrap items-center gap-2">
            <SessionContextPill expectedRole="staff" />
            <span className="rounded-full border border-border-hairline bg-surface-subtle px-3 py-1 text-xs font-medium text-ink-secondary">
              TMS Care Team Overview
            </span>
          </div>
        </div>

        <div className="max-w-3xl space-y-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">
            Post-TMS clinic follow-up
          </h1>
          <p className="text-base leading-relaxed text-ink-secondary">
            Helps the care team see when a post-TMS patient may benefit from a
            phone call. A flag names only the broad areas of daily life that
            shifted and when the change started, without raw sensor numbers or
            automated diagnoses.
          </p>
        </div>
      </header>

      <ClinicCrisisAlerts />

      <ClinicFlagsView />

      <ForestDivider variant="clearing" />

      <p className="border-t border-border-hairline pt-6 text-xs leading-relaxed text-ink-secondary">
        <strong className="font-semibold text-ink-primary">
          Privacy and clinical boundary:
        </strong>{" "}
        This page shows only broad areas of daily life (<code>check_in</code>,{" "}
        <code>sleep</code>, <code>daily_routine</code>) and the date the shift
        began. Individual check-in answers and daily measurements stay private
        unless the patient chooses to share them with the clinic.
      </p>
    </div>
  );
}
