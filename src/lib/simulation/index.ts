export const SIMULATED_PARTICIPANT_EXTERNAL_ID = "sim-post-tms-01";
export const DEFAULT_SIMULATION_SEED = 20261113;
export type {
  DemoMomentKey,
  SimulatedPersonDataset,
  GenerateSimulationOptions,
} from "./types";
export { createSeededRng } from "./prng";
export {
  generateSimulatedPersonWeeks,
  sliceDatasetThroughDay,
} from "./person-generator";
