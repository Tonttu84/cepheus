import { requireApiSession } from "@/server/auth";
import { getRouteDeps, guardPatient, orStorageFailure, respond, failureOf } from "@/server/api";
import { readAccount, readPreferences, readTodayTask } from "@/usecases/rewards";
import { getRewardsSettings } from "@/server/api/rewards-settings";

export const dynamic = "force-dynamic";
const ROUTE = "rewards:account";

export async function GET(request: Request) {
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
    const result = await readAccount(actor, { patientId: actor.patientId }, rewardsPorts);

    if (!result.ok) {
      if (result.error === "not enabled") {
          return respond({ enabled: false }, 404);
      }
      return failureOf(context, result.error);
    }

    const prefsResult = await readPreferences(actor, { patientId: actor.patientId }, rewardsPorts);
    const preferredTaskKeys = prefsResult.ok ? prefsResult.value.preferredTaskKeys : [];

    const todayTaskResult = await readTodayTask(actor, { patientId: actor.patientId }, rewardsPorts);
    const todayTask = todayTaskResult.ok ? todayTaskResult.value : undefined;

    return respond({
      enabled: true,
      countersEnabled: settings.countersEnabled,
      preferredTaskKeys,
      todayTask,
      ...result.value,
    });
  });
}
