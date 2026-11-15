import { requireApiSession } from "@/server/auth";
import {
  failureOf,
  getRouteDeps,
  guardStaff,
  orStorageFailure,
  parseInput,
  readJsonBody,
  refuse,
  respond,
} from "@/server/api";
import { AcknowledgeCrisisEventRequestSchema } from "@/server/route-schemas";
import { acknowledgeCrisisEvent } from "@/usecases";

export const dynamic = "force-dynamic";

const ROUTE = "clinic:crisis-events:acknowledge";

/** Acknowledge an unacknowledged crisis event for a patient of the signed-in nurse's clinic. */
export async function POST(request: Request) {
  const sessionGuard = requireApiSession(request, "staff");
  if (!sessionGuard.ok) return sessionGuard.response;
  const guard = guardStaff(request, ROUTE);
  if (!guard.ok) return guard.response;
  if (new URL(request.url).search.length > 0) return refuse(400, "This route takes no parameters.");
  const { actor } = guard;

  const input = parseInput(AcknowledgeCrisisEventRequestSchema, await readJsonBody(request));
  if (!input.ok) return input.response;

  const context = { route: ROUTE, actorKind: actor.kind };

  return orStorageFailure(context, async () => {
    const result = await acknowledgeCrisisEvent(actor, input.data, getRouteDeps().ports);
    if (!result.ok) return failureOf(context, result.error);
    return respond({ ok: true, acknowledged: true, ...result.value });
  });
}
