import { MonitoringDashboard } from "@/components/monitoring-dashboard";
import { ForestCanopyArtwork } from "@/components/forest-divider";
import { SimulatedBadge } from "@/components/simulated-badge";

export default function MonitoringPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border-hairline bg-surface-card p-7 shadow-xs sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Supports live Fitbit/Arduino UNO Q and simulated demo sync" />
          <span className="rounded-full border border-border-hairline bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
            Derived Numbers Only · Zero Raw Video or Audio
          </span>
        </div>

        <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink-primary sm:text-3xl">
          Passive home sensors &amp; wearable rhythm monitoring
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
          Sync sleep regularity and daytime activity from{" "}
          <strong>Android Health Connect or Apple Health webhooks</strong> and{" "}
          <strong>Fitbit OAuth2 PKCE</strong>, or pair an{" "}
          <strong>Arduino UNO Q with an external USB camera</strong> for
          on-device facial movement, daytime immobility bouts, and ambient light
          cues. Home routine signals never raise a clinic alert on their own and
          always respect your per-method consent switches.
        </p>

        <ForestCanopyArtwork className="mt-6 w-full text-accent-sage" />
      </section>

      <MonitoringDashboard />
    </div>
  );
}
