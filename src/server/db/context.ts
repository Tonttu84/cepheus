import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { UnitOfWork } from "@/usecases/ports";

export interface DbContext {
  readonly client: () => Prisma.TransactionClient;
  readonly isInUnitOfWork: () => boolean;
  readonly unitOfWork: UnitOfWork;
}

export function createDbContext(prisma: PrismaClient): DbContext {
  const activeTransaction = new AsyncLocalStorage<Prisma.TransactionClient>();

  return {
    client: () => activeTransaction.getStore() ?? prisma,
    isInUnitOfWork: () => activeTransaction.getStore() !== undefined,
    unitOfWork: {
      execute: (work) => prisma.$transaction((tx) => activeTransaction.run(tx, work)),
    },
  };
}
