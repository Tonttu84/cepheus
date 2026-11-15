import { getRouteDeps, guardPatient, orStorageFailure, respond, failureOf } from "@/server/api";
import { readTodayTask } from "@/usecases/rewards";

export const dynamic = "force-dynamic";
const ROUTE = "rewards:today-task";

export async function GET(request: Request) {
  const guard = guardPatient(request, ROUTE);
  if (!guard.ok) return guard.response;
  
  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind };

  return orStorageFailure(context, async () => {
    const { rewardsPorts } = getRouteDeps();
    const result = await readTodayTask(actor, { patientId: actor.patientId }, rewardsPorts);
    
    if (!result.ok) {
        if (result.error === "not enabled") {
            return respond({ enabled: false }, 404);
        }
        return failureOf(context, result.error);
    }
    
    return respond({ enabled: true, ...result.value });
  });
}