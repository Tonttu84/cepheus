import { createPrismaPorts, getClinicPatientIds } from "@/server/db";
import { ensureHomeDemoParticipant } from "@/server/monitoring/store";
import type { Ports } from "@/usecases/ports";

export interface RouteDeps {
  readonly ports: Ports;
  /** The ids of every patient of one clinic; the ports have no such listing. */
  readonly clinicPatientIds: (clinicId: string) => Promise<readonly string[]>;
  /** Maps a device to the patient it belongs to (D43). */
  readonly resolveDevicePatient?: (deviceId: string) => Promise<{ patientId: string; clinicId: string }>;
}

export async function defaultResolveDevicePatient(): Promise<{ patientId: string; clinicId: string }> {
  const participant = await ensureHomeDemoParticipant();
  if (!participant.clinicId) {
    throw new Error("Demo participant has no clinic configured.");
  }
  return {
    patientId: participant.id,
    clinicId: participant.clinicId,
  };
}

function createDefaultDeps(): RouteDeps {
  return {
    ports: createPrismaPorts(),
    clinicPatientIds: (clinicId: string) => getClinicPatientIds(clinicId),
    resolveDevicePatient: defaultResolveDevicePatient,
  };
}

let factory: () => RouteDeps = createDefaultDeps;

/** The storage the routes use: PostgreSQL, or what a test put in its place. */
export function getRouteDeps(): RouteDeps {
  return factory();
}

export function setRouteDepsForTests(next: () => RouteDeps): void {
  factory = next;
}

export function resetRouteDeps(): void {
  factory = createDefaultDeps;
}
