import {
  failureOf,
  getRouteDeps,
  guardPatient,
  orStorageFailure,
  parseInput,
  readJsonBody,
  refuse,
  respond,
} from "@/server/api";
import { requireApiSession } from "@/server/auth";
import { CheckInCrisisRequestSchema } from "@/server/route-schemas";
import { submitCrisisButton } from "@/usecases";

export const dynamic = "force-dynamic";

const ROUTE = "check-in:crisis";

/**
 * A typed or spoken request for help on the check-in screen.
 * Records a crisis event for the signed-in patient through submitCrisisButton.
 * The request carries no text, only the fact and which screen it came from.
 * A crisis answer always returns the crisis path and crisis resources.
 */
export async function POST(request: Request) {
  const sessionGuard = requireApiSession(request, "patient");
  if (!sessionGuard.ok) {
    return refuse(
      sessionGuard.response.status,
      sessionGuard.response.status === 401
        ? "Sign in required."
        : "Only patient sessions may call this.",
      true
    );
  }
  const guard = guardPatient(request, ROUTE, true);
  if (!guard.ok) return guard.response;

  const raw = await readJsonBody(request);
  const input = parseInput(CheckInCrisisRequestSchema, raw, true);
  if (!input.ok) return input.response;

  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind };

  return orStorageFailure(
    context,
    async () => {
      const { ports } = getRouteDeps();
      const result = await submitCrisisButton(
        actor,
        { patientId: actor.patientId, time: ports.clock.now() },
        ports
      );
      if (!result.ok) {
        return failureOf(context, result.error, true);
      }
      return respond(
        {
          ok: true,
          saved: result.value.saved,
          duplicate: result.value.duplicate ?? false,
          roundNumber: result.value.roundNumber,
        },
        200,
        true
      );
    },
    true
  );
}
