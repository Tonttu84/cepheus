import {
  getRouteDeps,
  guardPatient,
  orStorageFailure,
  parseInput,
  readJsonBody,
  respond,
  failureOf,
} from "@/server/api";
import { CheckInExtraAnswerRequestSchema } from "@/server/route-schemas";
import { submitExtraAnswer } from "@/usecases";

export const dynamic = "force-dynamic";

const ROUTE = "check-in:extra-answer";

/** The experimental rotating extra question of the open round (D25); never read by the warning rule. */
export async function POST(request: Request) {
  const guard = guardPatient(request, ROUTE);
  if (!guard.ok) return guard.response;
  const input = parseInput(CheckInExtraAnswerRequestSchema, await readJsonBody(request));
  if (!input.ok) return input.response;
  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind, itemId: input.data.itemId };

  return orStorageFailure(context, async () => {
    const result = await submitExtraAnswer(actor, { patientId: actor.patientId, ...input.data }, getRouteDeps().ports);
    if (!result.ok) return failureOf(context, result.error);
    return respond({ ok: true, saved: result.value.recorded });
  });
}
