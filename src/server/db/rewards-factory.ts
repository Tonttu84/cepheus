import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { RewardsConfig } from "@/domain/rewards/types";
import type { RewardsPorts } from "@/usecases/rewards/ports";
import { createDbContext } from "./context";
import { createRewardLedgerRepository } from "./reward-ledger";
import { createRewardsRoundOutcomeReader } from "./rewards-rounds";
import { createRewardsScheduleReader } from "./rewards-schedule";
import { createTaskPreferenceRepository } from "./task-preferences";
import { createTaskRecordRepository } from "./task-records";

/**
 * The rewards and small tasks use case ports on PostgreSQL.
 * Uses the same unit of work (one transaction and patient row lock) as createPrismaPorts.
 */
export function createPrismaRewardsPorts(
  prismaOrConfig?: PrismaClient | Partial<RewardsConfig>,
  config?: Partial<RewardsConfig>
): RewardsPorts {
  const isPrisma = prismaOrConfig && "$transaction" in prismaOrConfig;
  const prisma = isPrisma ? (prismaOrConfig as PrismaClient) : getPrisma();
  const cfg = isPrisma ? config : (prismaOrConfig as Partial<RewardsConfig> | undefined);
  const ctx = createDbContext(prisma);

  return {
    clock: { now: () => new Date().toISOString() },
    ledger: createRewardLedgerRepository(ctx),
    preferences: createTaskPreferenceRepository(ctx),
    taskRecords: createTaskRecordRepository(ctx),
    patients: createRewardsScheduleReader(ctx),
    rounds: createRewardsRoundOutcomeReader(ctx),
    unitOfWork: ctx.unitOfWork,
    config: cfg,
  };
}
