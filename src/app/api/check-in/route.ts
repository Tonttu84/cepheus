import { getRouteDeps, guardPatient, orStorageFailure, respond, failureOf } from "@/server/api";
import { getCheckInState } from "@/usecases";

export const dynamic = "force-dynamic";

const ROUTE = "check-in:state";

/** The signed-in patient's own check-in state for the round that is open now. */
export async function GET(request: Request) {
  const guard = guardPatient(request, ROUTE);
  if (!guard.ok) return guard.response;
  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind };

  return orStorageFailure(context, async () => {
    const result = await getCheckInState(actor, { patientId: actor.patientId }, getRouteDeps().ports);
    if (!result.ok) return failureOf(context, result.error);
    return respond({ ok: true, ...result.value });
  });
}
