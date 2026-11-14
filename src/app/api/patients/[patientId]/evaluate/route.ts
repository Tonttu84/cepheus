import { getRouteDeps, guardSystem, orStorageFailure, parseInput, respond, failureOf } from "@/server/api";
import { PatientEvaluateParamsSchema } from "@/server/route-schemas";
import { evaluatePatient } from "@/usecases";

export const dynamic = "force-dynamic";

const ROUTE = "patients:evaluate";

/** System only: runs the warning rule for one patient and stores what is new. Answers with counts only. */
export async function POST(request: Request, context: { params: Promise<{ patientId: string }> }) {
  const guard = guardSystem(request);
  if (!guard.ok) return guard.response;
  const input = parseInput(PatientEvaluateParamsSchema, await context.params);
  if (!input.ok) return input.response;
  const failure = { route: ROUTE, actorKind: "system" };

  return orStorageFailure(failure, async () => {
    const result = await evaluatePatient({ kind: "system" }, input.data, getRouteDeps().ports);
    if (!result.ok) return failureOf(failure, result.error);
    return respond({ ok: true, saved: true, storedEffectsCount: result.value.storedEffectsCount });
  });
}
