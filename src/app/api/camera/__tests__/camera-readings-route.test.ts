import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as postCameraReading } from "@/app/api/camera/readings/route";
import {
  apiRequest,
  PATIENT_ID,
  patientCookie,
  patientRecord,
  setUpRoutes,
  staffCookie,
  tearDownRoutes,
} from "@/app/api/__tests__/route-test-kit";

const VALID_BODY = {
  taskId: "check_in_clip_60s",
  durationSec: 20,
  effectiveFps: 10,
  faceDetectedRatio: 0.95,
  expressivityScore: 0.18,
  angularPathDegPerMin: 220,
};

function cameraRequest(
  body: unknown = VALID_BODY,
  cookie: string | null = patientCookie(),
  origin: string | null = "http://localhost:3000"
) {
  const req = apiRequest("/api/camera/readings", { body, cookie });
  if (origin !== null) {
    req.headers.set("origin", origin);
  }
  return req;
}

describe("POST /api/camera/readings", () => {
  let fake: ReturnType<typeof setUpRoutes>;

  beforeEach(async () => {
    fake = setUpRoutes();
    await fake.ports.patients.savePatient(
      patientRecord({
        consent: {
          taking_part: true,
          methods: { ring: false, camera: true },
          rule_check: true,
        },
      })
    );
  });

  afterEach(() => {
    tearDownRoutes();
  });

  it("refuses unauthenticated callers with 401 and staff sessions with 403", async () => {
    const unauth = await postCameraReading(cameraRequest(VALID_BODY, null));
    expect(unauth.status).toBe(401);

    const staff = await postCameraReading(cameraRequest(VALID_BODY, staffCookie()));
    expect(staff.status).toBe(403);
  });

  it("refuses cross-origin requests with 403", async () => {
    const crossOrigin = await postCameraReading(
      cameraRequest(VALID_BODY, patientCookie(), "https://evil.attacker.example")
    );
    expect(crossOrigin.status).toBe(403);
    const crossJson = await crossOrigin.json();
    expect(crossJson.error).toBe("Cross-origin POST rejected.");

    const missingOrigin = await postCameraReading(
      cameraRequest(VALID_BODY, patientCookie(), null)
    );
    expect(missingOrigin.status).toBe(403);
    const missingJson = await missingOrigin.json();
    expect(missingJson.error).toBe("Cross-origin POST rejected.");
  });

  it("refuses with 403 consent_required when camera consent is paused", async () => {
    await fake.ports.patients.savePatient(
      patientRecord({
        consent: {
          taking_part: true,
          methods: { ring: true, camera: false },
          rule_check: true,
        },
      })
    );

    const res = await postCameraReading(cameraRequest());
    expect(res.status).toBe(403);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json).toEqual({ ok: false, error: "consent_required" });
  });

  it("rejects payload containing unexpected raw image/video fields with 400", async () => {
    const rawPayload = {
      ...VALID_BODY,
      imageJpegBase64: "data:image/jpeg;base64,rawdata",
      frames: [1, 2, 3],
    };
    const res = await postCameraReading(cameraRequest(rawPayload));
    expect(res.status).toBe(400);
  });

  it("rejects payload with missing required fields with 400", async () => {
    const missingDuration = {
      effectiveFps: 10,
      faceDetectedRatio: 0.95,
      expressivityScore: 0.18,
      angularPathDegPerMin: 220,
    };
    const res1 = await postCameraReading(cameraRequest(missingDuration));
    expect(res1.status).toBe(400);

    const missingExpressivity = {
      durationSec: 20,
      effectiveFps: 10,
      faceDetectedRatio: 0.95,
      angularPathDegPerMin: 220,
    };
    const res2 = await postCameraReading(cameraRequest(missingExpressivity));
    expect(res2.status).toBe(400);

    const emptyBody = {};
    const res3 = await postCameraReading(cameraRequest(emptyBody));
    expect(res3.status).toBe(400);
  });

  it("persists valid derived movement numbers and returns 200 with saved: true and readingId", async () => {
    const res = await postCameraReading(cameraRequest());
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      saved: boolean;
      readingId: string;
    };
    expect(json).toMatchObject({ ok: true, saved: true });
    expect(typeof json.readingId).toBe("string");
    expect(json.readingId.length).toBeGreaterThan(0);

    const stored = fake.ctx.state.cameraReadings[PATIENT_ID] ?? [];
    expect(stored).toHaveLength(1);
    expect(stored[0].expressivityScore).toBe(0.18);
  });

  it("returns 503 saved:false when storage fails", async () => {
    fake.unitOfWork.failNext = true;
    const res = await postCameraReading(cameraRequest());
    expect(res.status).toBe(503);
    const json = (await res.json()) as { ok: boolean; saved: boolean };
    expect(json).toMatchObject({ ok: false, saved: false });
  });
});
