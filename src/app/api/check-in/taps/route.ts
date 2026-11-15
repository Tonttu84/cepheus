import { requireApiSession } from "@/server/auth";
import {
  getRouteDeps,
  guardPatient,
  orStorageFailure,
  parseInput,
  readJsonBody,
  respond,
  runRuleIfNeeded,
  failureOf,
} from "@/server/api";
import { CheckInTapsRequestSchema } from "@/server/route-schemas";
import { submitTaps } from "@/usecases";
import { creditCheckInRound } from "@/usecases/rewards";

export const dynamic = "force-dynamic";

const ROUTE = "check-in:taps";

/** The two taps of the open round, for the signed-in patient only. */
export async function POST(request: Request) {
  const sessionGuard = requireApiSession(request, "patient");
  if (!sessionGuard.ok) return sessionGuard.response;
  const guard = guardPatient(request, ROUTE);
  if (!guard.ok) return guard.response;
  const input = parseInput(CheckInTapsRequestSchema, await readJsonBody(request));
  if (!input.ok) return input.response;
  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind };

  return orStorageFailure(context, async () => {
    const { ports, rewardsPorts } = getRouteDeps();
    const result = await submitTaps(actor, { patientId: actor.patientId, ...input.data }, ports);
    if (!result.ok) return failureOf(context, result.error);
    
    // Wire rewards through shared function
    await creditCheckInRound(actor, { patientId: actor.patientId, roundNumber: result.value.roundNumber }, rewardsPorts);

    await runRuleIfNeeded(actor.patientId, result.value.ruleRunNeeded, ports);
    return respond({ ok: true, saved: true });
  });
}
