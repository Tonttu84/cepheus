import type { PatientScheduleInfo, PatientScheduleReader } from "@/usecases/rewards/ports";
import type { DbContext } from "./context";
import { lockParticipant } from "./participant-lock";
import { createPatientRepository } from "./patients";

export function createRewardsScheduleReader(
  ctx: DbContext,
  patientRepo = createPatientRepository(ctx)
): PatientScheduleReader {
  return {
    async getPatientSchedule(patientId: string): Promise<PatientScheduleInfo | null> {
      await lockParticipant(ctx, patientId);
      const patient = await patientRepo.getPatient(patientId);
      if (!patient || !patient.clinicId) {
        return null;
      }
      return {
        patientId: patient.patientId,
        clinicId: patient.clinicId,
        schedule: patient.schedule,
      };
    },
  };
}
