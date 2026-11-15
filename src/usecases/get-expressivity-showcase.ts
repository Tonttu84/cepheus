import {
  decideAccess,
  type Actor,
  type StaffActor,
  type TargetData,
} from "@/domain/access";
import { isPurposeAllowed } from "@/domain/consent";
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

/**
 * Use case: retrieve facial expressivity against own usual range for a patient.
 *
 * Rules:
 * 1. Staff only: clinic staff can read the showcase.
 * 2. Access control: matches monitoring facts access check (target kind: flags, purpose: care).
 * 3. Computed and shown only when ALL hold:
 *    - module switch is on (expressivityShowcase)
 *    - patient's camera consent is on (method:camera)
 *    - patient's facial movement range permission is on (facial_movement_usual_range)
 * 4. Stored camera data: reads ONLY expressivityScore. Any placeholder or non-measured
 *    values in other fields (smileFraction, yaw, pitch, etc.) are strictly ignored.
 */
export async function getExpressivityShowcase(
  actor: Actor,
  input: GetExpressivityShowcaseInput,
  ports: Ports
): Promise<UseCaseResult<ExpressivityRangeResult | null>> {
  if (actor.kind !== "staff") {
    return { ok: false, error: "Staff access required" };
  }

  const staff = actor as StaffActor;
  const patientId = input.patientId;

  const switches = await ports.patients.getPatientAccessSwitches(patientId);
  if (!switches) {
    return { ok: false, error: "Patient not found" };
  }

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

  if (!access.ok) {
    return { ok: false, error: access.error };
  }

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

  if (!allowed) {
    return { ok: false, error: reason };
  }

  // Check the three gating conditions:
  // 1. Module runtime switch
  const moduleEnabled =
    input.isModuleEnabled !== undefined
      ? input.isModuleEnabled
      : isExpressivityShowcaseEnabled();
  if (!moduleEnabled) {
    return { ok: true, value: null };
  }

  // 2. Patient camera consent
  const cameraConsented = isPurposeAllowed(switches.consent, "method:camera");
  if (!cameraConsented) {
    return { ok: true, value: null };
  }

  // 3. Patient specific facial movement range permission
  const permissionConsented = isPurposeAllowed(
    switches.consent,
    "facial_movement_usual_range"
  );
  if (!permissionConsented) {
    return { ok: true, value: null };
  }

  // All 3 conditions hold. Read stored camera readings through ports.
  if (!ports.camera) {
    return {
      ok: true,
      value: {
        status: "insufficient_history",
        kind: "insufficient_history",
        count: 0,
        minimum: 5,
      },
    };
  }

  const readings = await ports.camera.getCameraReadings(patientId);
  // Strictly use expressivityScore ONLY.
  const scores = readings.map((r) => r.expressivityScore);

  if (scores.length === 0) {
    return {
      ok: true,
      value: {
        status: "insufficient_history",
        kind: "insufficient_history",
        count: 0,
        minimum: 5,
      },
    };
  }

  const history = scores.slice(0, scores.length - 1);
  const latest = scores[scores.length - 1];

  const evaluation = evaluateExpressivityRange(history, latest);
  return { ok: true, value: evaluation };
}
