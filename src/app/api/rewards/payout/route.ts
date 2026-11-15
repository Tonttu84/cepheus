import { getRouteDeps, guardPatient, orStorageFailure, respond, failureOf } from "@/server/api";
import { requestPayout } from "@/usecases/rewards";

export const dynamic = "force-dynamic";
const ROUTE = "rewards:payout";

export async function POST(request: Request) {
  const guard = guardPatient(request, ROUTE);
  if (!guard.ok) return guard.response;
  
  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind };

  return orStorageFailure(context, async () => {
    const { rewardsPorts } = getRouteDeps();
    const result = await requestPayout(actor, { patientId: actor.patientId, requestId: crypto.randomUUID() }, rewardsPorts);
    
    if (!result.ok) {
        if (result.error === "not enabled") {
            return respond({ enabled: false }, 404);
        }
        return failureOf(context, result.error);
    }
    
    return respond({ enabled: true, ...result.value });
  });
}