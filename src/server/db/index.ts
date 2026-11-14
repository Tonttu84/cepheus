import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { Ports } from "@/usecases/ports";
import { createAccessLogRepository } from "./access-log";
import { createCallRepository } from "./calls";
import { createDbContext } from "./context";
import { createCrisisRepository } from "./crisis";
import {
  createBaselineNotWellRepository,
  createSmallDipRepository,
  createWarningRepository,
} from "./effects";
import { createExtraAnswerRepository } from "./extra-answers";
import { createPatientRepository } from "./patients";
import { createPhq9Repository } from "./phq9";
import { createRoundRepository } from "./rounds";

export function createPrismaPorts(prisma: PrismaClient = getPrisma()): Ports {
  const ctx = createDbContext(prisma);

  return {
    clock: { now: () => new Date().toISOString() },
    patients: createPatientRepository(ctx),
    rounds: createRoundRepository(ctx),
    phq9: createPhq9Repository(ctx),
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
