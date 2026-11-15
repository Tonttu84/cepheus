import { z } from "zod";
import { requireApiSession } from "@/server/auth";
import {
  getRouteDeps,
  guardPatient,
  orStorageFailure,
  respond,
  failureOf,
  readJsonBody,
  parseInput,
} from "@/server/api";
import { readPreferences, setPreferences } from "@/usecases/rewards";
import { getRewardsSettings } from "@/server/api/rewards-settings";
import type { TaskKey } from "@/domain/small-tasks/types";

export const dynamic = "force-dynamic";
const ROUTE = "rewards:preferences";

const TaskKeySchema = z.enum([
  "short_walk",
  "breathing_space",
  "bright_light",
  "social_contact",
  "pleasant_activity",
]);

const PreferencesInputSchema = z.object({
  preferredTaskKeys: z.array(TaskKeySchema).optional(),
  taskKeys: z.array(TaskKeySchema).optional(),
  taskKey: TaskKeySchema.optional(),
});

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
    const result = await readPreferences(actor, { patientId: actor.patientId }, rewardsPorts);

    if (!result.ok) {
      if (result.error === "not enabled") {
        return respond({ enabled: false }, 404);
      }
      return failureOf(context, result.error);
    }

    return respond({ enabled: true, ...result.value });
  });
}

export async function POST(request: Request) {
  const auth = requireApiSession(request, "patient");
  if (!auth.ok) return auth.response;

  const guard = guardPatient(request, ROUTE);
  if (!guard.ok) return guard.response;

  const settings = getRewardsSettings();
  if (!settings.rewardsEnabled) {
    return respond({ enabled: false }, 404);
  }

  const raw = await readJsonBody(request);
  const parsed = parseInput(PreferencesInputSchema, raw);
  if (!parsed.ok) return parsed.response;

  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind };

  const preferredTaskKeys: TaskKey[] =
    parsed.data.preferredTaskKeys ??
    parsed.data.taskKeys ??
    (parsed.data.taskKey ? [parsed.data.taskKey] : []);

  return orStorageFailure(context, async () => {
    const { rewardsPorts } = getRouteDeps();
    const result = await setPreferences(
      actor,
      {
        patientId: actor.patientId,
        preferredTaskKeys,
      },
      rewardsPorts
    );

    if (!result.ok) {
      if (result.error === "not enabled") {
        return respond({ enabled: false }, 404);
      }
      return failureOf(context, result.error);
    }

    return respond({ enabled: true, ...result.value });
  });
}
