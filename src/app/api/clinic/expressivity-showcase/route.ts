import { requireApiSession } from "@/server/auth";
import {
  failureOf,
  getRouteDeps,
  guardStaff,
  orStorageFailure,
  refuse,
  respond,
} from "@/server/api";
import { getExpressivityShowcase } from "@/usecases/get-expressivity-showcase";

export const dynamic = "force-dynamic";

const ROUTE = "clinic:expressivity-showcase";

/**
 * Reads the facial expressivity against usual range showcase for one patient.
 * Staff-only route protected by session and staff role checks.
 */
export async function GET(request: Request) {
  const sessionGuard = requireApiSession(request, "staff");
  if (!sessionGuard.ok) return sessionGuard.response;

  const guard = guardStaff(request, ROUTE);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const patientId = url.searchParams.get("patientId");
  if (!patientId) {
    return refuse(400, "Missing required query parameter: patientId");
  }

  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind };

  return orStorageFailure(context, async () => {
    const { ports } = getRouteDeps();
    const result = await getExpressivityShowcase(actor, { patientId }, ports);
    if (!result.ok) {
      return failureOf(context, result.error);
    }
    return respond({ ok: true, showcase: result.value });
  });
}
