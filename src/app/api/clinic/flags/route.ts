import { getRouteDeps, guardStaff, listClinicFlags, orStorageFailure, refuse, respond } from "@/server/api";

export const dynamic = "force-dynamic";

const ROUTE = "clinic:flags";

/** The flags of the signed-in staff member's own clinic: patient, broad area and dates, no answers. */
export async function GET(request: Request) {
  const guard = guardStaff(request, ROUTE);
  if (!guard.ok) return guard.response;
  if (new URL(request.url).search.length > 0) return refuse(400, "This route takes no parameters.");
  const { actor } = guard;

  return orStorageFailure({ route: ROUTE, actorKind: actor.kind }, async () => {
    const flags = await listClinicFlags(actor, getRouteDeps());
    return respond({ ok: true, flags });
  });
}
