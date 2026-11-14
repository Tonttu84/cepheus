import type { Actor } from "../access/types";
import type { RewardsAccessDecision } from "./types";

/**
 * Rule 9: Only the patient reads or changes their own balance, tasks and preferences.
 * Clinic staff and other patients are refused.
 */
export function decideRewardsAccess(actor: Actor, targetPatientId: string): RewardsAccessDecision {
  if (!actor || typeof actor !== "object") {
    return { allowed: false, reason: "refused_invalid_actor" };
  }

  if (actor.kind === "staff") {
    return { allowed: false, reason: "refused_staff_forbidden" };
  }

  if (actor.kind === "system") {
    return { allowed: false, reason: "refused_patient_only" };
  }

  if (actor.kind === "patient") {
    if (actor.patientId !== targetPatientId) {
      return { allowed: false, reason: "refused_not_own_data" };
    }
    return { allowed: true, reason: "allowed" };
  }

  return { allowed: false, reason: "refused_invalid_actor" };
}
