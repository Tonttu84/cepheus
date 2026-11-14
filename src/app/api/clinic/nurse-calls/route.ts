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
import { runRuleIfNeeded } from "@/server/api/rule";
import { RecordNurseCallRequestSchema } from "@/server/route-schemas";
import { recordNurseCallOutcome } from "@/usecases";

export const dynamic = "force-dynamic";

const ROUTE = "clinic:nurse-calls";

/** Record the outcome of a nurse call regarding a clinic flag. */
export async function POST(request: Request) {
  const guard = guardStaff(request, ROUTE);
  if (!guard.ok) return guard.response;
  if (new URL(request.url).search.length > 0) return refuse(400, "This route takes no parameters.");
  const { actor } = guard;

  const input = parseInput(RecordNurseCallRequestSchema, await readJsonBody(request));
  if (!input.ok) return input.response;

  const context = { route: ROUTE, actorKind: actor.kind };

  return orStorageFailure(context, async () => {
    const deps = getRouteDeps();
    const result = await recordNurseCallOutcome(actor, input.data, deps.ports);
    if (!result.ok) return failureOf(context, result.error);

    if (result.value.status === "completed") {
      await runRuleIfNeeded(input.data.patientId, true, deps.ports);
    }

    return respond({ ok: true, saved: true, ...result.value });
  });
}
