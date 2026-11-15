import type { CameraReading } from "@prisma/client";
import type { CameraReadingRepository, StoredCameraReading } from "@/usecases/ports";
import type { DbContext } from "./context";
import { loadParticipantScope } from "./participant-scope";

function toStoredCameraReading(row: CameraReading): StoredCameraReading {
  return {
    id: row.id,
    patientId: row.participantId,
    participantId: row.participantId,
    date: row.date,
    dayIndex: row.dayIndex,
    taskId: row.taskId,
    durationSec: row.durationSec,
    sampleRateHz: row.sampleRateHz,
    effectiveFps: row.effectiveFps,
    faceDetectedRatio: row.faceDetectedRatio,
    expressivityScore: row.expressivityScore,
    smileFraction: row.smileFraction,
    mouthSmileMean: row.mouthSmileMean,
    mouthSmileSd: row.mouthSmileSd,
    browInnerUpSd: row.browInnerUpSd,
    browDownSd: row.browDownSd,
    browOuterUpSd: row.browOuterUpSd,
    eyeSquintSd: row.eyeSquintSd,
    cheekSquintSd: row.cheekSquintSd,
    jawOpenSd: row.jawOpenSd,
    blendshapeStatsJson: row.blendshapeStatsJson,
    yawSdDeg: row.yawSdDeg,
    pitchSdDeg: row.pitchSdDeg,
    rollSdDeg: row.rollSdDeg,
    angularPathDegPerMin: row.angularPathDegPerMin,
    translationSd: row.translationSd,
    expressivityZScore: row.expressivityZScore,
    headMovementZScore: row.headMovementZScore,
    isSimulated: row.isSimulated,
    source: row.source,
  };
}

export function createCameraReadingRepository(ctx: DbContext): CameraReadingRepository {
  return {
    async getCameraReadings(patientId: string): Promise<readonly StoredCameraReading[]> {
      const rows = await ctx.client().cameraReading.findMany({
        where: { participantId: patientId },
        orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
      });
      return rows.map(toStoredCameraReading);
    },

    async saveCameraReading(reading: StoredCameraReading): Promise<StoredCameraReading> {
      const pId = reading.patientId || reading.participantId || "";
      const { clinicId, isSimulated } = await loadParticipantScope(ctx.client(), pId);
      const created = await ctx.client().cameraReading.create({
        data: {
          participantId: pId,
          clinicId,
          date: reading.date,
          taskId: reading.taskId ?? "check_in_clip_60s",
          durationSec: reading.durationSec,
          effectiveFps: reading.effectiveFps,
          faceDetectedRatio: reading.faceDetectedRatio,
          expressivityScore: reading.expressivityScore,
          smileFraction: reading.smileFraction ?? 0,
          yawSdDeg: reading.yawSdDeg ?? 0,
          pitchSdDeg: reading.pitchSdDeg ?? 0,
          rollSdDeg: reading.rollSdDeg ?? null,
          angularPathDegPerMin: reading.angularPathDegPerMin,
          isSimulated: reading.isSimulated ?? isSimulated,
          source: reading.source ?? "live",
        },
      });
      return toStoredCameraReading(created);
    },
  };
}

export const createCameraRepository = createCameraReadingRepository;
