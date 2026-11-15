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
import { CheckInGad7RequestSchema } from "@/server/route-schemas";
import { submitGad7Answer } from "@/usecases";

export const dynamic = "force-dynamic";

const ROUTE = "check-in:gad7";

/** One GAD-7 item for the signed-in patient, when the GAD-7 is switched on for them (D35). */
export async function POST(request: Request) {
  const sessionGuard = requireApiSession(request, "patient");
  if (!sessionGuard.ok) return sessionGuard.response;
  const guard = guardPatient(request, ROUTE);
  if (!guard.ok) return guard.response;
  const input = parseInput(CheckInGad7RequestSchema, await readJsonBody(request));
  if (!input.ok) return input.response;
  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind, itemId: input.data.itemId };

  return orStorageFailure(context, async () => {
    const { ports } = getRouteDeps();
    const result = await submitGad7Answer(actor, { patientId: actor.patientId, ...input.data }, ports);
    if (!result.ok) return failureOf(context, result.error);
    await runRuleIfNeeded(actor.patientId, result.value.ruleRunNeeded, ports);
    return respond({ ok: true, saved: true, isComplete: result.value.isComplete });
  });
}
