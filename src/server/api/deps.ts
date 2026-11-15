import { DEFAULT_EXTRA_ITEMS_CONFIG } from "@/domain/extra-items";
import { getDemoClock } from "@/server/api/clock";
import { isExtraQuestionEnabled } from "@/server/api/settings";
import { createPrismaPorts, createPrismaRewardsPorts, getClinicPatientIds } from "@/server/db";
import { ensureHomeDemoParticipant } from "@/server/monitoring/store";
import type { Ports } from "@/usecases/ports";
import type { RewardsPorts } from "@/usecases/rewards/ports";
import { getRewardsSettings } from "./rewards-settings";

export interface RouteDeps {
  readonly ports: Ports;
  readonly rewardsPorts: RewardsPorts;
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
  const ports = createPrismaPorts(undefined, undefined, getDemoClock());
  const settings = getRewardsSettings();
  return {
    ports: {
      ...ports,
      extraItemsConfig: {
        ...DEFAULT_EXTRA_ITEMS_CONFIG,
        enabled: isExtraQuestionEnabled(),
      },
    },
    rewardsPorts: createPrismaRewardsPorts({ enabled: settings.rewardsEnabled }),
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
