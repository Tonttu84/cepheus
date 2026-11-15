import { z } from "zod";
import type { TaskKey } from "@/domain/small-tasks/types";
import type { TaskPreferenceRepository } from "@/usecases/rewards/ports";
import type { DbContext } from "./context";
import { loadParticipantScope } from "./participant-scope";
import { lockParticipant } from "./participant-lock";
import { parseStoredJson } from "./stored-data";

const TASK_KEYS_SCHEMA: z.ZodType<readonly TaskKey[]> = z.array(
  z.enum([
    "short_walk",
    "breathing_space",
    "bright_light",
    "social_contact",
    "pleasant_activity",
  ])
);

export function createTaskPreferenceRepository(ctx: DbContext): TaskPreferenceRepository {
  return {
    async getPreferences(patientId) {
      await lockParticipant(ctx, patientId);
      const row = await ctx.client().taskPreference.findUnique({
        where: { participantId: patientId },
      });
      if (!row) return null;
      return parseStoredJson(row.preferredKeysJson, TASK_KEYS_SCHEMA, "task preferences");
    },

    async savePreferences(patientId, preferredTaskKeys) {
      await lockParticipant(ctx, patientId);
      const { clinicId, isSimulated } = await loadParticipantScope(ctx.client(), patientId);
      const preferredKeysJson = JSON.stringify(preferredTaskKeys);
      await ctx.client().taskPreference.upsert({
        where: { participantId: patientId },
        create: {
          participantId: patientId,
          clinicId,
          preferredKeysJson,
          isSimulated,
        },
        update: {
          preferredKeysJson,
          clinicId,
          isSimulated,
        },
      });
    },
  };
}
