import { evaluatePatient } from "@/usecases";
import type { Ports } from "@/usecases/ports";

/**
 * After an answer that completes something the warning rule reads, the
 * route runs the rule as the system, so flags appear without a scheduler.
 * The answer is already saved: a refusal (no rule-check consent) is
 * expected and silent, and a failure is logged without answer values and
 * never changes what the patient is told.
 */
export async function runRuleIfNeeded(patientId: string, needed: boolean, ports: Ports): Promise<void> {
  if (!needed) return;
  try {
    const result = await evaluatePatient({ kind: "system" }, { patientId }, ports);
    if (!result.ok && result.error !== "consent_required") {
      console.error("[api] The warning rule did not run after an answer:", { reason: result.error.slice(0, 120) });
    }
  } catch (error) {
    console.error("[api] The warning rule failed after an answer:", {
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}
