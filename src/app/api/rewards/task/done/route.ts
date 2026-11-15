import { requireApiSession } from "@/server/auth";
import { getRouteDeps, guardPatient, orStorageFailure, respond, failureOf } from "@/server/api";
import { markTaskDone } from "@/usecases/rewards";
import { getRewardsSettings } from "@/server/api/rewards-settings";

export const dynamic = "force-dynamic";
const ROUTE = "rewards:task:done";

export async function POST(request: Request) {
  const auth = requireApiSession(request, "patient");
  if (!auth.ok) return auth.response;

  const guard = guardPatient(request, ROUTE);
  if (!guard.ok) return guard.response;

  const settings = getRewardsSettings();
  if (!settings.rewardsEnabled) {
    return respond({ enabled: false }, 404);
  }

  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind };

  return orStorageFailure(context, async () => {
    const { rewardsPorts } = getRouteDeps();
    const result = await markTaskDone(actor, { patientId: actor.patientId }, rewardsPorts);

    if (!result.ok) {
      if (result.error === "not enabled") {
        return respond({ enabled: false }, 404);
      }
      return failureOf(context, result.error);
    }

    return respond({ enabled: true, ...result.value });
  });
}
