import type { RoundOutcomeReader, StoredRoundOutcome } from "@/usecases/rewards/ports";
import type { DbContext } from "./context";
import { lockParticipant } from "./participant-lock";
import { createRoundRepository } from "./rounds";

export function createRewardsRoundOutcomeReader(
  ctx: DbContext,
  roundRepo = createRoundRepository(ctx)
): RoundOutcomeReader {
  return {
    async getRoundOutcome(patientId: string, roundNumber: number): Promise<StoredRoundOutcome | null> {
      await lockParticipant(ctx, patientId);
      const round = await roundRepo.getRound(patientId, roundNumber);
      if (!round || !round.status) {
        return null;
      }
      return {
        roundNumber: round.roundNumber,
        status: round.status,
        answeredAt: round.answeredAt ?? null,
      };
    },

    async getAnsweredRoundsCount(patientId: string): Promise<number> {
      await lockParticipant(ctx, patientId);
      const rounds = await roundRepo.getRounds(patientId);
      return rounds.filter((r) => r.status === "answered").length;
    },
  };
}
