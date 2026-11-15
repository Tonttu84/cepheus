import { z } from "zod";
import { requireApiSession } from "@/server/auth";
import {
  getRouteDeps,
  guardPatient,
  orStorageFailure,
  respond,
  refuse,
  failureOf,
  readJsonBody,
  parseInput,
} from "@/server/api";
import { requestPayout } from "@/usecases/rewards";
import { getRewardsSettings } from "@/server/api/rewards-settings";

export const dynamic = "force-dynamic";
const ROUTE = "rewards:payout";

const PayoutInputSchema = z
  .object({
    requestId: z.string().max(128).optional(),
  })
  .optional();

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

  const rawBody = await readJsonBody(request);
  let requestId = crypto.randomUUID();
  if (rawBody !== undefined) {
    const parsed = parseInput(PayoutInputSchema, rawBody);
    if (!parsed.ok) return parsed.response;
    if (parsed.data?.requestId) {
      requestId = parsed.data.requestId;
    }
  }

  return orStorageFailure(context, async () => {
    const { rewardsPorts } = getRouteDeps();
    const result = await requestPayout(
      actor,
      { patientId: actor.patientId, requestId },
      rewardsPorts
    );

    if (!result.ok) {
      if (result.error === "not enabled") {
        return respond({ enabled: false }, 404);
      }
      if (result.error === "insufficient_balance") {
        return refuse(400, "Insufficient balance for payout.");
      }
      return failureOf(context, result.error);
    }

    return respond({ enabled: true, ...result.value });
  });
}
