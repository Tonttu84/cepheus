import {
  decideAccess,
  type Actor,
  type StaffActor,
  type TargetData,
} from "@/domain/access";
import { isPurposeAllowed, type ConsentState } from "@/domain/consent";
import {
  evaluateExpressivityRange,
  type ExpressivityRangeResult,
} from "@/domain/camera";
import { isExpressivityShowcaseEnabled } from "@/server/api/settings";
import type { Ports, UseCaseResult } from "./ports";

export interface GetExpressivityShowcaseInput {
  readonly patientId: string;
  readonly isModuleEnabled?: boolean;
}

const PURPOSE = "care";

async function checkShowcaseAccess(
  staff: StaffActor,
  switches: { readonly patientId: string; readonly clinicId: string; readonly consent: ConsentState },
  ports: Ports
): Promise<{ allowed: boolean; error?: string }> {
  const target: TargetData = {
    kind: "flags",
    patientId: switches.patientId,
    clinicId: switches.clinicId,
  };

  const access = decideAccess({
    actor: staff,
    action: "read",
    target,
    purpose: PURPOSE,
    consent: switches.consent,
  });

  if (!access.ok) return { allowed: false, error: access.error };
  const { allowed, reason, log } = access.value;
  if (log) {
    await ports.accessLog.appendLog({
      actor: staff,
      action: "read",
      target,
      purpose: PURPOSE,
      allowed,
      reason,
      timestamp: ports.clock.now(),
    });
  }
  return { allowed, error: allowed ? undefined : reason };
}

function isShowcaseEligible(consent: ConsentState, isModuleEnabled?: boolean): boolean {
  const moduleEnabled = isModuleEnabled !== undefined ? isModuleEnabled : isExpressivityShowcaseEnabled();
  if (!moduleEnabled) return false;
  if (!isPurposeAllowed(consent, "method:camera")) return false;
  return isPurposeAllowed(consent, "facial_movement_usual_range");
}

/**
 * Use case: retrieve facial expressivity against own usual range for a patient.
 */
export async function getExpressivityShowcase(
  actor: Actor,
  input: GetExpressivityShowcaseInput,
  ports: Ports
): Promise<UseCaseResult<ExpressivityRangeResult | null>> {
  if (actor.kind !== "staff") return { ok: false, error: "Staff access required" };

  const switches = await ports.patients.getPatientAccessSwitches(input.patientId);
  if (!switches) return { ok: false, error: "Patient not found" };

  const access = await checkShowcaseAccess(actor as StaffActor, switches, ports);
  if (!access.allowed) return { ok: false, error: access.error ?? "Access denied" };

  if (!isShowcaseEligible(switches.consent, input.isModuleEnabled)) {
    return { ok: true, value: null };
  }

  if (!ports.camera) {
    return { ok: true, value: { status: "insufficient_history", kind: "insufficient_history", count: 0, minimum: 5 } };
  }

  const readings = await ports.camera.getCameraReadings(input.patientId);
  const scores = readings
    .map((r) => r.expressivityScore)
    .filter((s): s is number => typeof s === "number" && Number.isFinite(s) && s >= 0 && s <= 1);
  if (scores.length === 0) {
    return { ok: true, value: { status: "insufficient_history", kind: "insufficient_history", count: 0, minimum: 5 } };
  }

  const history = scores.slice(0, scores.length - 1);
  const latest = scores[scores.length - 1];
  return { ok: true, value: evaluateExpressivityRange(history, latest) };
}
