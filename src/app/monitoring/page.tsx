import { MonitoringDashboard } from "@/components/monitoring-dashboard";
import { ForestCanopyArtwork } from "@/components/forest-divider";
import { SimulatedBadge } from "@/components/simulated-badge";
import { requirePatientPageSession } from "@/server/auth";

export default async function MonitoringPage() {
  await requirePatientPageSession();
  return (
    <div className="space-y-12 sm:space-y-16">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Supports live Fitbit/Arduino UNO Q and simulated demo sync" />
          <span className="rounded-full border border-border-hairline bg-surface-subtle px-3 py-1 text-xs font-medium text-ink-secondary">
            Derived Numbers Only · Zero Raw Video or Audio
          </span>
        </div>

        <div className="max-w-3xl space-y-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">
            Passive home sensors &amp; wearable rhythm monitoring
          </h1>
          <p className="text-base leading-relaxed text-ink-secondary">
            Sync sleep regularity and daytime activity from{" "}
            <strong>Android Health Connect or Apple Health webhooks</strong> and{" "}
            <strong>Fitbit OAuth2 PKCE</strong>, or pair an{" "}
            <strong>Arduino UNO Q with an external USB camera</strong> for
            on-device facial movement, daytime immobility bouts, and ambient
            light cues. Home routine signals never raise a clinic alert on their
            own and always respect your per-method consent switches.
          </p>
        </div>

        <ForestCanopyArtwork className="w-full pt-2 text-accent-sage" />
      </header>

      <MonitoringDashboard />
    </div>
  );
}
