import { closeElapsedRounds, evaluatePatient } from "@/usecases";
import type { Ports } from "@/usecases/ports";

const SYSTEM = { kind: "system" } as const;

/**
 * Records this patient's elapsed rounds that have no outcome as missed, so
 * the rule reads a history without gaps (a first answer in round 2 would
 * otherwise start at round 2, which the rule refuses). A failure is logged
 * and the rule is still tried.
 */
async function closeRoundsOf(patientId: string, ports: Ports): Promise<void> {
  try {
    const closed = await closeElapsedRounds(SYSTEM, { patientId }, ports);
    if (!closed.ok && closed.error !== "consent_required") {
      console.error("[api] Elapsed rounds were not closed before the rule:", { reason: closed.error.slice(0, 120) });
    }
  } catch (error) {
    console.error("[api] Closing elapsed rounds failed before the rule:", {
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}

/**
 * After an answer that completes something the warning rule reads, the
 * route closes the patient's elapsed rounds and runs the rule as the
 * system, so flags appear without a scheduler. The answer is already
 * saved: a refusal (no consent) is expected and silent, and a failure is
 * logged without answer values and never changes what the patient is told.
 */
export async function runRuleIfNeeded(patientId: string, needed: boolean, ports: Ports): Promise<void> {
  if (!needed) return;
  await closeRoundsOf(patientId, ports);
  try {
    const result = await evaluatePatient(SYSTEM, { patientId }, ports);
    if (!result.ok && result.error !== "consent_required") {
      console.error("[api] The warning rule did not run after an answer:", { reason: result.error.slice(0, 120) });
    }
  } catch (error) {
    console.error("[api] The warning rule failed after an answer:", {
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}
