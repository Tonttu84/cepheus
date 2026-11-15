import { requireApiSession } from "@/server/auth";
import { getRouteDeps, guardStaff, orStorageFailure, refuse, respond } from "@/server/api";
import { listUnacknowledgedCrisisEvents } from "@/usecases";

export const dynamic = "force-dynamic";

const ROUTE = "clinic:crisis-events";

/** Unacknowledged crisis events for patients of the signed-in staff member's own clinic. */
export async function GET(request: Request) {
  const sessionGuard = requireApiSession(request, "staff");
  if (!sessionGuard.ok) return sessionGuard.response;
  const guard = guardStaff(request, ROUTE);
  if (!guard.ok) return guard.response;
  if (new URL(request.url).search.length > 0) return refuse(400, "This route takes no parameters.");
  const { actor } = guard;

  return orStorageFailure({ route: ROUTE, actorKind: actor.kind }, async () => {
    const result = await listUnacknowledgedCrisisEvents(actor, getRouteDeps().ports);
    if (!result.ok) return refuse(403, result.error);
    return respond({ ok: true, crisisEvents: result.value });
  });
}
