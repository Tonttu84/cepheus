import { getPrisma } from "@/lib/db";
import {
  SIMULATED_PATIENT_PRESETS,
  type PatientAuthSession,
  type SimulatedPatientPresetKey,
} from "@/lib/auth-types";

export interface StrongEidProvider {
  authenticateSimulatedPreset(
    participantCode: string
  ): Promise<PatientAuthSession | null>;
}

const DEFAULT_SIMULATED_CLINIC_ID = "sim-clinic-01";

export type ParticipantIdResolver = (
  participantCode: SimulatedPatientPresetKey,
  fallbackPatientId: string
) => Promise<{ patientId: string; clinicId: string }>;

async function defaultResolveParticipantIds(
  participantCode: SimulatedPatientPresetKey,
  fallbackPatientId: string
): Promise<{ patientId: string; clinicId: string }> {
  try {
    const participant = await getPrisma().participant.findUnique({
      where: { participantCode },
      select: { id: true, clinicId: true },
    });
    if (participant) {
      return {
        patientId: participant.id,
        clinicId: participant.clinicId ?? DEFAULT_SIMULATED_CLINIC_ID,
      };
    }
  } catch {
    // Database unavailable (e.g. unit tests without PostgreSQL); use deterministic fallback.
  }

  return {
    patientId: fallbackPatientId,
    clinicId: DEFAULT_SIMULATED_CLINIC_ID,
  };
}

let activeParticipantIdResolver: ParticipantIdResolver =
  defaultResolveParticipantIds;

export function _setParticipantIdResolver(
  resolver: ParticipantIdResolver | null
): void {
  activeParticipantIdResolver = resolver ?? defaultResolveParticipantIds;
}

export class SimulatedFinnishEidProvider implements StrongEidProvider {
  async authenticateSimulatedPreset(
    participantCode: string
  ): Promise<PatientAuthSession | null> {
    const preset = SIMULATED_PATIENT_PRESETS.find(
      (item) => item.participantCode === participantCode
    );
    if (!preset) {
      return null;
    }

    const { patientId, clinicId } = await activeParticipantIdResolver(
      preset.participantCode,
      preset.externalId
    );

    return {
      kind: "patient",
      actor: {
        kind: "patient",
        patientId,
        clinicId,
      },
      participantCode: preset.participantCode,
      label: preset.label,
      avatarInitials: preset.avatarInitials,
      authMethod: "simulated_finnish_eid",
      isSimulated: true,
      signedInAt: new Date().toISOString(),
    };
  }
}

export const simulatedFinnishEidProvider: StrongEidProvider =
  new SimulatedFinnishEidProvider();
