import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { Clock, Ports } from "@/usecases/ports";
import { createAccessLogRepository } from "./access-log";
import { createCallRepository } from "./calls";
import { getEnv } from "@/server/env";
import { createDbContext, type DbContextOptions } from "./context";
import { createCrisisRepository } from "./crisis";
import {
  createBaselineNotWellRepository,
  createSmallDipRepository,
  createWarningRepository,
} from "./effects";
import { createExtraAnswerRepository } from "./extra-answers";
import { createGad7Repository } from "./gad7";
import { createPatientRepository, getClinicPatientIds } from "./patients";
import { createPhq9Repository } from "./phq9";
import { createRoundRepository } from "./rounds";

export { getClinicPatientIds };

/**
 * The use case ports on PostgreSQL. Item answers are written to the database
 * only when `storeItemAnswers` is on (`STORE_ITEM_ANSWERS` by default);
 * otherwise in-progress answers live in the process's shared memory store.
 */
export function createPrismaPorts(
  prisma: PrismaClient = getPrisma(),
  options: DbContextOptions = { storeItemAnswers: getEnv().STORE_ITEM_ANSWERS },
  clock?: Clock
): Ports {
  const ctx = createDbContext(prisma, options);

  return {
    clock: clock ?? { now: () => new Date().toISOString() },
    patients: createPatientRepository(ctx),
    rounds: createRoundRepository(ctx),
    phq9: createPhq9Repository(ctx),
    gad7: createGad7Repository(ctx),
    calls: createCallRepository(ctx),
    warnings: createWarningRepository(ctx),
    smallDips: createSmallDipRepository(ctx),
    crisis: createCrisisRepository(ctx),
    baselineNotWell: createBaselineNotWellRepository(ctx),
    accessLog: createAccessLogRepository(ctx),
    extraAnswers: createExtraAnswerRepository(ctx),
    unitOfWork: ctx.unitOfWork,
  };
}

export { clearSimulatedAnswers, resetSimulatedData, type ResetOptions } from "./reset";
export {
  getSimulatedPatientSummaries,
  getSimulatedPatientIds,
  checkDemoNeedsReset,
  type SimulatedPatientDemoSummary,
} from "./demo-patients";
