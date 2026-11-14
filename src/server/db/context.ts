import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { UnitOfWork } from "@/usecases/ports";
import {
  sharedAnswerStore,
  type AnswerStoreView,
  type InMemoryAnswerStore,
  type StagedAnswerStore,
} from "./answer-store";

export interface DbContextOptions {
  /** Write questionnaire item answers to the database; off keeps them in memory only. */
  readonly storeItemAnswers?: boolean;
  /** Where in-progress answers live when `storeItemAnswers` is off; the process's shared store by default. */
  readonly answerStore?: InMemoryAnswerStore;
}

export interface DbContext {
  readonly client: () => Prisma.TransactionClient;
  readonly isInUnitOfWork: () => boolean;
  readonly unitOfWork: UnitOfWork;
  readonly storeItemAnswers: boolean;
  /** In-progress answers as the current unit of work sees them, or the shared store outside one. */
  readonly answers: () => AnswerStoreView;
}

interface ActiveUnit {
  readonly tx: Prisma.TransactionClient;
  readonly answers: StagedAnswerStore;
}

export function createDbContext(prisma: PrismaClient, options: DbContextOptions = {}): DbContext {
  const activeUnit = new AsyncLocalStorage<ActiveUnit>();
  const answerStore = options.answerStore ?? sharedAnswerStore;

  return {
    client: () => activeUnit.getStore()?.tx ?? prisma,
    isInUnitOfWork: () => activeUnit.getStore() !== undefined,
    storeItemAnswers: options.storeItemAnswers ?? false,
    answers: () => activeUnit.getStore()?.answers ?? answerStore,
    unitOfWork: {
      // Answer changes are staged and applied only after the transaction has
      // committed; when it fails they are dropped with the rollback.
      execute: async (work) => {
        const answers = answerStore.stage();
        const result = await prisma.$transaction((tx) => activeUnit.run({ tx, answers }, work));
        answers.commit();
        return result;
      },
    },
  };
}
