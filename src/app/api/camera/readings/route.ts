import { requireApiSession } from "@/server/auth";
import {
  failureOf,
  getRouteDeps,
  guardPatient,
  orStorageFailure,
  parseInput,
  readJsonBody,
  respond,
} from "@/server/api";
import { verifySameOrigin } from "@/server/security";
import { CameraReadingRequestSchema } from "@/server/route-schemas";
import { submitCameraReading } from "@/usecases";

export const dynamic = "force-dynamic";

const ROUTE = "camera:readings";

/** Saves derived on-device camera summary numbers for the signed-in patient when camera consent is enabled. */
export async function POST(request: Request) {
  if (!verifySameOrigin(request)) {
    return respond({ ok: false, error: "Cross-origin POST rejected." }, 403);
  }

  const sessionGuard = requireApiSession(request, "patient");
  if (!sessionGuard.ok) return sessionGuard.response;

  const guard = guardPatient(request, ROUTE);
  if (!guard.ok) return guard.response;

  const input = parseInput(CameraReadingRequestSchema, await readJsonBody(request));
  if (!input.ok) return input.response;

  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind };

  return orStorageFailure(context, async () => {
    const { ports } = getRouteDeps();
    const result = await submitCameraReading(actor, { patientId: actor.patientId, ...input.data }, ports);
    if (!result.ok) return failureOf(context, result.error);
    return respond({ ok: true, saved: true, readingId: result.value.readingId });
  });
}
