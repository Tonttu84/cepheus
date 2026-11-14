import { createHash } from "node:crypto";
import { decideAccess, type StaffActor, type TargetData } from "@/domain/access";
import type { FlagArea } from "@/domain/flags";
import { closeElapsedRounds } from "@/usecases";
import type { Ports } from "@/usecases/ports";
import type { RouteDeps } from "./deps";
import { runRuleIfNeeded } from "./rule";

/** What the clinic sees of a flag: who, the broad area and when. Never answers, scores or totals. */
export interface ClinicFlagView {
  readonly patientId: string;
  readonly area: FlagArea;
  readonly since: string;
  readonly raisedAt: string;
}

const PURPOSE = "care";

function shortHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 8);
}

function logPatientFailure(step: string, patientId: string, error: unknown): void {
  const message = error instanceof Error ? error.message.slice(0, 120) : String(error).slice(0, 120);
  console.error(`[api] Clinic update failed during ${step}:`, {
    patientHash: shortHash(patientId),
    error: message,
  });
}

async function updateOnePatient(patientId: string, ports: Ports): Promise<void> {
  try {
    const closed = await closeElapsedRounds({ kind: "system" }, { patientId }, ports);
    if (!closed.ok) {
      if (closed.error !== "consent_required") {
        logPatientFailure("closeElapsedRounds", patientId, closed.error);
      }
      return;
    }
    await runRuleIfNeeded(patientId, true, ports);
  } catch (error) {
    logPatientFailure("updateOnePatient", patientId, error);
  }
}

/**
 * Brings every patient of one clinic up to date: closes elapsed rounds and
 * runs the warning rule for each patient. Catches per patient on storage
 * failure and carries on so one patient cannot hide others' flags.
 */
export async function bringClinicUpToDate(clinicId: string, deps: RouteDeps): Promise<void> {
  const patientIds = await deps.clinicPatientIds(clinicId);
  for (const patientId of patientIds) {
    await updateOnePatient(patientId, deps.ports);
  }
}

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
  await bringClinicUpToDate(actor.clinicId, deps);
  const patientIds = await deps.clinicPatientIds(actor.clinicId);
  const flags: ClinicFlagView[] = [];
  for (const patientId of patientIds) {
    try {
      flags.push(...(await flagsOfPatient(actor, patientId, deps.ports)));
    } catch (error) {
      logPatientFailure("flagsOfPatient", patientId, error);
    }
  }
  return flags.sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
}
