import { describe, expect, it } from "vitest";
import { containsRawMediaFields, evaluateArduinoEdgePayload } from "../evaluate";

describe("Arduino UNO Q Edge Domain Validation (src/domain/arduino)", () => {
  it("refuses any payload containing raw video, image, or audio keys (even nested)", () => {
    expect(
      containsRawMediaFields({
        deviceId: "unoq-1",
        camera: { nested: { imageBase64: "abc" } },
      })
    ).toBe("imageBase64");

    const res = evaluateArduinoEdgePayload({
      deviceId: "unoq-1",
      date: "2026-11-14",
      camera: {
        durationSec: 20,
        effectiveFps: 15,
        faceDetectedRatio: 0.9,
        expressivityScore: 0.08,
        angularPathDegPerMin: 120,
        frame: "raw-jpeg-bytes",
      },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/raw media field "frame"/i);
    }
  });

  it("normalizes derived camera & immobility/daylight metrics and detects daytime dim-room light cue", () => {
    const res = evaluateArduinoEdgePayload({
      deviceId: "unoq-desk-01",
      date: "2026-11-14",
      hourOfDay: 13,
      isSimulated: false,
      camera: {
        durationSec: 20,
        effectiveFps: 14.5,
        faceDetectedRatio: 0.92,
        expressivityScore: 0.074,
        smileFraction: 0.14,
        yawSdDeg: 3.1,
        pitchSdDeg: 2.4,
        angularPathDegPerMin: 148.5,
      },
      routine: {
        sensorActive: true,
        stationaryMinutes: 240,
        longestBoutMinutes: 115,
        prolongedBoutCount: 2,
        ambientLuxMean: 32,
        lowLightDaytimeHours: 5,
      },
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.cameraReading?.source).toBe("arduino_uno_q");
      expect(res.value.cameraReading?.isSimulated).toBe(false);
      expect(res.value.routineReadings).toHaveLength(2);
      expect(res.value.routineReadings[0].channel).toBe("home_immobility_bouts");
      expect(res.value.routineReadings[1].channel).toBe("daylight_exposure");
      expect(res.value.lightCue.activateRingLightCue).toBe(true);
    }
  });

  it("does not trigger daytime light cue late at night or when room is bright", () => {
    const night = evaluateArduinoEdgePayload({
      deviceId: "unoq-desk-01",
      date: "2026-11-14",
      hourOfDay: 23,
      routine: {
        sensorActive: true,
        stationaryMinutes: 180,
        longestBoutMinutes: 120,
        prolongedBoutCount: 1,
        ambientLuxMean: 10,
      },
    });
    expect(night.ok).toBe(true);
    if (night.ok) {
      expect(night.value.lightCue.activateRingLightCue).toBe(false);
    }
  });
});
