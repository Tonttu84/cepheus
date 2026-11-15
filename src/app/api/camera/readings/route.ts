import { requireApiSession } from "@/server/auth";
import {
  getRouteDeps,
  guardPatient,
  orStorageFailure,
  parseInput,
  readJsonBody,
  respond,
  failureOf,
} from "@/server/api";
import { CameraReadingInputSchema } from "@/lib/schemas";
import { storeCameraReading } from "@/usecases/store-camera-reading";

export const dynamic = "force-dynamic";
const ROUTE = "camera:readings";

export async function POST(request: Request) {
  const sessionGuard = requireApiSession(request, "patient");
  if (!sessionGuard.ok) return sessionGuard.response;
  
  const guard = guardPatient(request, ROUTE);
  if (!guard.ok) return guard.response;
  
  const input = parseInput(CameraReadingInputSchema, await readJsonBody(request));
  if (!input.ok) return input.response;
  
  const { actor } = guard;
  const context = { route: ROUTE, actorKind: actor.kind };

  if (input.data.participantId !== actor.patientId) {
    return respond({ error: "participantId mismatch" }, 400);
  }

  return orStorageFailure(context, async () => {
    const { ports } = getRouteDeps();
    const result = await storeCameraReading(
      actor,
      {
        patientId: actor.patientId,
        date: input.data.date,
        dayIndex: input.data.dayIndex ?? null,
        taskId: input.data.taskId,
        durationSec: input.data.durationSec,
        sampleRateHz: input.data.sampleRateHz,
        effectiveFps: input.data.effectiveFps,
        faceDetectedRatio: input.data.faceDetectedRatio,
        expressivityScore: input.data.expressivityScore,
        smileFraction: input.data.smileFraction,
        mouthSmileMean: input.data.mouthSmileMean ?? null,
        mouthSmileSd: input.data.mouthSmileSd ?? null,
        browInnerUpSd: input.data.browInnerUpSd ?? null,
        browDownSd: input.data.browDownSd ?? null,
        browOuterUpSd: input.data.browOuterUpSd ?? null,
        eyeSquintSd: input.data.eyeSquintSd ?? null,
        cheekSquintSd: input.data.cheekSquintSd ?? null,
        jawOpenSd: input.data.jawOpenSd ?? null,
        blendshapeStatsJson: input.data.blendshapeStatsJson ?? null,
        yawSdDeg: input.data.yawSdDeg,
        pitchSdDeg: input.data.pitchSdDeg,
        rollSdDeg: input.data.rollSdDeg ?? null,
        angularPathDegPerMin: input.data.angularPathDegPerMin,
        translationSd: input.data.translationSd ?? null,
        expressivityZScore: input.data.expressivityZScore ?? null,
        headMovementZScore: input.data.headMovementZScore ?? null,
        isSimulated: input.data.isSimulated,
        source: input.data.source,
      },
      ports
    );

    if (!result.ok) {
      if (result.error === "consent_required") {
        return respond({ error: "consent_required" }, 403);
      }
      return respond({ error: result.error }, 400);
    }

    return respond({ ok: true, saved: true });
  });

}

