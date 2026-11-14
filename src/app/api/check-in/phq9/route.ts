import {
  getRouteDeps,
  guardPatient,
  isCrisisAnswer,
  orStorageFailure,
  parseInput,
  readJsonBody,
  respond,
  runRuleIfNeeded,
  failureOf,
} from "@/server/api";
import { CheckInPhq9RequestSchema } from "@/server/route-schemas";
import { submitPhq9Answer } from "@/usecases";

export const dynamic = "force-dynamic";

const ROUTE = "check-in:phq9";

/**
 * One PHQ-9 item for the signed-in patient. A self-harm answer above 0
 * gets the crisis path in every answer this route gives: saved, refused,
 * invalid or not saved.
 */
export async function POST(request: Request) {
  const raw = await readJsonBody(request);
  const crisis = isCrisisAnswer(raw);
  const guard = guardPatient(request, ROUTE, crisis);
  if (!guard.ok) return guard.response;
  const input = parseInput(CheckInPhq9RequestSchema, raw, crisis);
  if (!input.ok) return input.response;
  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind, itemId: input.data.itemId };

  return orStorageFailure(
    context,
    async () => {
      const { ports } = getRouteDeps();
      const result = await submitPhq9Answer(actor, { patientId: actor.patientId, ...input.data }, ports);
      if (!result.ok) return failureOf(context, result.error, crisis || result.showCrisisPath === true);
      await runRuleIfNeeded(actor.patientId, result.value.ruleRunNeeded, ports);
      const showCrisis = crisis || result.value.showCrisisPath;
      return respond({ ok: true, saved: true, progress: result.value.progress, showCrisisPath: showCrisis }, 200, showCrisis);
    },
    crisis
  );
}
