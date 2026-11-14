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
import { CheckInNotTodayRequestSchema } from "@/server/route-schemas";
import { submitNotToday } from "@/usecases";

export const dynamic = "force-dynamic";

const ROUTE = "check-in:not-today";

/** "Not today" for the open round: recorded as such, never as a missed or low answer. */
export async function POST(request: Request) {
  const guard = guardPatient(request, ROUTE);
  if (!guard.ok) return guard.response;
  const input = parseInput(CheckInNotTodayRequestSchema, (await readJsonBody(request)) ?? {});
  if (!input.ok) return input.response;
  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind };

  return orStorageFailure(context, async () => {
    const { ports } = getRouteDeps();
    const result = await submitNotToday(actor, { patientId: actor.patientId }, ports);
    if (!result.ok) return failureOf(context, result.error);
    await runRuleIfNeeded(actor.patientId, result.value.ruleRunNeeded, ports);
    return respond({ ok: true, saved: true });
  });
}
