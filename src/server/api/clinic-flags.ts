import { decideAccess, type StaffActor, type TargetData } from "@/domain/access";
import type { FlagArea } from "@/domain/flags";
import type { Ports } from "@/usecases/ports";
import type { RouteDeps } from "./deps";

/** What the clinic sees of a flag: who, the broad area and when. Never answers, scores or totals. */
export interface ClinicFlagView {
  readonly patientId: string;
  readonly area: FlagArea;
  readonly since: string;
  readonly raisedAt: string;
}

const PURPOSE = "care";

async function flagsOfPatient(actor: StaffActor, patientId: string, ports: Ports): Promise<ClinicFlagView[]> {
  const switches = await ports.patients.getPatientAccessSwitches(patientId);
  if (!switches) return [];
  const target: TargetData = { kind: "flags", patientId: switches.patientId, clinicId: switches.clinicId };
  const access = decideAccess({ actor, action: "read", target, purpose: PURPOSE, consent: switches.consent });
  if (!access.ok) throw new Error(access.error);
  const { allowed, reason, log } = access.value;
  if (log) {
    await ports.accessLog.appendLog({
      actor,
      action: "read",
      target,
      purpose: PURPOSE,
      allowed,
      reason,
      timestamp: ports.clock.now(),
    });
  }
  if (!allowed) return [];
  const warnings = await ports.warnings.getWarnings(switches.patientId);
  return warnings.map((w) => ({ patientId: w.patientId, area: "check_in", since: w.since, raisedAt: w.raisedAt }));
}

/**
 * The flags of every patient of the nurse's own clinic, each read through
 * the access rules (a patient without consent for care contributes none).
 * Newest first.
 */
export async function listClinicFlags(actor: StaffActor, deps: RouteDeps): Promise<ClinicFlagView[]> {
  const patientIds = await deps.clinicPatientIds(actor.clinicId);
  const flags: ClinicFlagView[] = [];
  for (const patientId of patientIds) {
    flags.push(...(await flagsOfPatient(actor, patientId, deps.ports)));
  }
  return flags.sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
}
