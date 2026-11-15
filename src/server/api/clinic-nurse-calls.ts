import { decideAccess, type StaffActor, type TargetData } from "@/domain/access";
import type { StoredNurseCallRecord } from "@/usecases/ports";
import type { RouteDeps } from "./deps";

const PURPOSE = "care";

export interface ClinicNurseCallView {
  readonly id: string;
  readonly patientId: string;
  readonly flagId: string | null;
  readonly status: StoredNurseCallRecord["status"];
  readonly requestedAt: string;
  readonly staffUserId: string | null;
}

/**
 * Lists nurse call records for patients of the signed-in staff member's clinic.
 * Staff of another clinic receive none.
 */
export async function listClinicNurseCalls(
  actor: StaffActor,
  deps: RouteDeps
): Promise<ClinicNurseCallView[]> {
  const patientIds = await deps.clinicPatientIds(actor.clinicId);
  const views: ClinicNurseCallView[] = [];

  for (const patientId of patientIds) {
    const switches = await deps.ports.patients.getPatientAccessSwitches(patientId);
    if (!switches) continue;

    const target: TargetData = {
      kind: "call_outcomes",
      patientId: switches.patientId,
      clinicId: switches.clinicId,
    };

    const access = decideAccess({
      actor,
      action: "read",
      target,
      purpose: PURPOSE,
      consent: switches.consent,
    });

    if (!access.ok || !access.value.allowed) continue;

    if (access.value.log) {
      await deps.ports.accessLog.appendLog({
        actor,
        action: "read",
        target,
        purpose: PURPOSE,
        allowed: true,
        reason: access.value.reason,
        timestamp: deps.ports.clock.now(),
      });
    }

    const records = await deps.ports.calls.getNurseCallRecords(patientId);
    for (const record of records) {
      views.push({
        id: record.id ?? `call-${record.patientId}-${record.requestedAt ?? ""}`,
        patientId: record.patientId,
        flagId: record.flagId ?? null,
        status: record.status,
        requestedAt: record.requestedAt ?? deps.ports.clock.now(),
        staffUserId: record.staffUserId ?? null,
      });
    }
  }

  return views;
}
