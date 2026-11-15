import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DemoControls } from "@/components/demo/demo-controls";
import { PhoneDemoQrCard } from "@/components/phone-demo-qr-card";
import { SimulatedBadge } from "@/components/simulated-badge";
import { ForestDivider } from "@/components/forest-divider";
import { readServerSession } from "@/server/auth";
import { buildPhoneDemoOriginOptions } from "@/server/demo/lan-origin";
import { getEnv } from "@/server/env";

export const metadata = {
  title: "Demo Controls · Cepheus",
  description: "Fast-forward time, reset sample patients, and toggle runtime switches for demonstration.",
};

function extractPortFromHost(host: string | null): number | undefined {
  if (!host) return undefined;
  const match = /:(\d+)$/.exec(host.trim());
  return match ? Number(match[1]) : undefined;
}

export default async function DemoPage() {
  const session = await readServerSession();
  if (!session) {
    redirect("/sign-in");
  }

  const headerList = await headers();
  const trustProxy = getEnv().TRUST_PROXY_HEADERS;
  const requestHost =
    (trustProxy ? headerList.get("x-forwarded-host") : null) ??
    headerList.get("host");
  const forwardedProto = trustProxy
    ? headerList
        .get("x-forwarded-proto")
        ?.split(",")[0]
        ?.trim()
        .toLowerCase()
    : undefined;
  const protocol = forwardedProto === "https" ? "https" : "http";
  const port = extractPortFromHost(requestHost);

  const originOptions = buildPhoneDemoOriginOptions({
    requestHost,
    protocol,
    port,
  });

  return (
    <div className="space-y-12 sm:space-y-16">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Product Demonstration Environment" />
          <span className="rounded-full border border-border-hairline bg-surface-subtle px-3 py-1 text-xs font-medium text-ink-secondary">
            Time &amp; Switch Controls
          </span>
        </div>

        <div className="max-w-3xl space-y-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">
            Demonstration controls
          </h1>
          <p className="text-base leading-relaxed text-ink-secondary">
            Simulate the passage of time across post-TMS recovery weeks, inspect
            clinic warnings and silence alerts, toggle feature switches in real time,
            and reset simulated patients back to their initial state.
          </p>
        </div>
      </header>

      <PhoneDemoQrCard originOptions={originOptions} />

      <DemoControls />

      <ForestDivider variant="clearing" />

      <p className="border-t border-border-hairline pt-6 text-xs leading-relaxed text-ink-secondary">
        <strong className="font-semibold text-ink-primary">
          Demonstration boundary:
        </strong>{" "}
        All participants on this page are synthetic. Advancing time moves forward
        only. Reset deletes what simulated patients gathered and restores the initial
        calm round.
      </p>
    </div>
  );
}
