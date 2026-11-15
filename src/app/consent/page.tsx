import { redirect } from "next/navigation";
import { ConsentScreen } from "@/components/consent/consent-screen";
import { getRouteDeps } from "@/server/api";
import { requirePatientPageSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function ConsentPage() {
  const session = await requirePatientPageSession({ allowUnconsented: true });
  const { ports } = getRouteDeps();
  const switches = await ports.patients.getPatientAccessSwitches(session.actor.patientId);

  // If already consented to taking part, go straight to check-in
  if (switches?.consent.taking_part) {
    redirect("/check-in");
  }

  return <ConsentScreen />;
}
