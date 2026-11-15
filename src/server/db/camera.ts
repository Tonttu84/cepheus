import type { DbContext } from "./context";
import type { CameraRepository, StoredCameraReading } from "@/usecases/ports";

export function createCameraRepository(ctx: DbContext): CameraRepository {
  return {
    async getCameraReadings(patientId: string): Promise<readonly StoredCameraReading[]> {
      const readings = await ctx.client().cameraReading.findMany({
        where: { participantId: patientId },
        orderBy: { recordedAt: "asc" },
      });
      return readings;
    },
    async saveCameraReading(reading: StoredCameraReading): Promise<void> {
      await ctx.client().cameraReading.create({
        data: reading,
      });
    },
  };
}
