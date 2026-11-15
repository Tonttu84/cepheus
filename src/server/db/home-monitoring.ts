import type { DbContext } from "./context";
import type { ConsentState } from "@/domain/consent";
import type {
  HomeMonitoringFacts,
  HomeMonitoringQuery,
  HomeMonitoringRepository,
} from "@/usecases/ports";

export function createHomeMonitoringRepository(ctx: DbContext): HomeMonitoringRepository {
  return {
    async getSupportingFacts(
      query: HomeMonitoringQuery,
      consent: ConsentState
    ): Promise<HomeMonitoringFacts> {
      if (!consent.taking_part) {
        return { supportingLines: [] };
      }

      const db = ctx.client();
      let wearableWornLine: string | null = null;
      let rhythmShiftLine: string | null = null;
      let checkDoneLine: string | null = null;

      // 1. Wearable worn line (consent for ring required)
      if (consent.methods.ring) {
        const ringDays = await db.ringDay.findMany({
          where: {
            participantId: query.patientId,
            date: { gte: query.sinceDate },
          },
          orderBy: { date: "asc" },
        });

        if (ringDays.length > 0) {
          const worn = ringDays.filter(
            (d) => d.ringActive || (d.wearMinutes != null && d.wearMinutes > 0)
          ).length;
          wearableWornLine = query.isSilenceOrMissed
            ? `ring worn on ${worn} of ${ringDays.length} days during the missed rounds`
            : `ring worn on ${worn} of ${ringDays.length} days during the lower rounds`;
        }

        // 2. Rhythm or sleep regularity shifted line (consent for ring required)
        const rhythmWindows = await db.rhythmWindow.findMany({
          where: {
            participantId: query.patientId,
          },
          orderBy: { windowEndDate: "desc" },
          take: 3,
        });

        const hasSriShift = rhythmWindows.some(
          (w) => w.sriZScore != null && (w.sriZScore <= -1.0 || Math.abs(w.sriZScore) >= 1.0)
        );
        const hasRaShift = rhythmWindows.some(
          (w) =>
            (w.raZScore != null && Math.abs(w.raZScore) >= 1.0) ||
            (w.isZScore != null && Math.abs(w.isZScore) >= 1.0)
        );

        if (hasSriShift && hasRaShift) {
          rhythmShiftLine = "day-night rhythm and sleep regularity shifted against earlier weeks";
        } else if (hasSriShift) {
          rhythmShiftLine = "sleep regularity shifted against earlier weeks";
        } else if (hasRaShift) {
          rhythmShiftLine = "day-night rhythm shifted against earlier weeks";
        }
      }

      // 3. Camera or bedside check done (consent for camera required)
      if (consent.methods.camera) {
        const cameraReading = await db.cameraReading.findFirst({
          where: {
            participantId: query.patientId,
            date: { gte: query.sinceDate },
          },
          orderBy: { date: "desc" },
        });

        if (cameraReading) {
          if (cameraReading.source === "arduino_uno_q") {
            checkDoneLine = "bedside check done during this time";
          } else {
            checkDoneLine = "camera check done during this time";
          }
        }
      }

      const supportingLines: string[] = [];
      if (wearableWornLine) supportingLines.push(wearableWornLine);
      if (rhythmShiftLine) supportingLines.push(rhythmShiftLine);
      if (checkDoneLine) supportingLines.push(checkDoneLine);

      return {
        wearableWornLine,
        rhythmShiftLine,
        checkDoneLine,
        supportingLines: supportingLines.slice(0, 3),
      };
    },
  };
}
