import { closeElapsedRounds, evaluatePatient } from "@/usecases";
import { advanceDemoTime, type AdvanceDemoTimeResult } from "./clock";
import { getRouteDeps, type RouteDeps } from "./deps";
import { getSimulatedPatientIds } from "@/server/db";

/**
 * Advances demo time and performs the system's work for every simulated patient:
 * closes elapsed rounds and runs the warning rule through the use cases.
 */
export async function advanceDemoAndRunSystemWork(
  days: number,
  deps: RouteDeps = getRouteDeps()
): Promise<AdvanceDemoTimeResult> {
  const adv = advanceDemoTime(days);
  if (!adv.ok) {
    return adv;
  }

  const patientIds = await getSimulatedPatientIds();
  for (const patientId of patientIds) {
    try {
      await closeElapsedRounds({ kind: "system" }, { patientId }, deps.ports);
      await evaluatePatient({ kind: "system" }, { patientId }, deps.ports);
    } catch (err) {
      console.error(`[demo] Error updating simulated patient ${patientId}:`, err);
    }
  }

  return adv;
}
