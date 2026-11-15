import {
  getRouteDeps,
  guardSystem,
  orStorageFailure,
  parseInput,
  readJsonBody,
  respond,
  failureOf,
} from "@/server/api";
import { RoundsCloseRequestSchema } from "@/server/route-schemas";
import { closeElapsedRounds } from "@/usecases";

export const dynamic = "force-dynamic";

const ROUTE = "rounds:close";

/** System only: closes one patient's rounds whose time has passed (missed, reminders). */
export async function POST(request: Request) {
  const guard = guardSystem(request);
  if (!guard.ok) return guard.response;
  const input = parseInput(RoundsCloseRequestSchema, await readJsonBody(request));
  if (!input.ok) return input.response;
  const context = { route: ROUTE, actorKind: "system" };

  return orStorageFailure(context, async () => {
    const result = await closeElapsedRounds({ kind: "system" }, input.data, getRouteDeps().ports);
    if (!result.ok) return failureOf(context, result.error);
    const { closedRoundsCount, remindersSentCount, ruleRunNeeded } = result.value;
    return respond({ ok: true, saved: true, closedRoundsCount, remindersSentCount, ruleRunNeeded });
  });
}
