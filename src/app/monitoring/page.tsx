import { MonitoringDashboard } from "@/components/monitoring-dashboard";
import { SimulatedBadge } from "@/components/simulated-badge";

export default function MonitoringPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Supports live Fitbit/Arduino UNO Q and simulated demo sync" />
          <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
            Derived Numbers Only · Zero Raw Video or Audio
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          Passive home sensors &amp; wearable rhythm monitoring
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-700">
          Sync sleep regularity and daytime activity from{" "}
          <strong>Android Health Connect / Apple Health webhooks</strong> (Trail
          #23) or <strong>Fitbit OAuth2 PKCE</strong>, and pair the{" "}
          <strong>Arduino UNO Q + external USB camera</strong> for on-device
          facial movement, daytime immobility bouts, and ambient light cues. Home
          routine signals never raise a clinic alert on their own and always
          respect your per-method consent switches.
        </p>
      </section>

      <MonitoringDashboard />
    </div>
  );
}
