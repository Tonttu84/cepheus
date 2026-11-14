import { describe, expect, it } from "vitest";
import {
  CameraReadingInputSchema,
  CheckInSubmissionSchema,
  Phq9SubmissionSchema,
  RingDayInputSchema,
  RoutineSignalInputSchema,
  SpeechReadingInputSchema,
  evaluatePhq9Submission,
  toSafeClinicFlagView,
} from "../schemas";
import {
  BROAD_AREA_KEYS,
  CRISIS_RESOURCES,
  DEMO_MOMENTS,
  PATIENT_SUGGESTIONS,
  PHQ9_ITEMS,
} from "../constants";

describe("CheckInSubmissionSchema", () => {
  it("accepts missed and not_today check-ins when all item scores are null or omitted", () => {
    const missed = CheckInSubmissionSchema.parse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      roundNumber: 12,
      status: "missed",
      moodScore: null,
      interestScore: null,
      energyScore: null,
      ruminationScore: null,
      compositeScore: null,
      ringActiveAtRound: true,
    });
    expect(missed.status).toBe("missed");
    expect(missed.moodScore).toBeNull();
    expect(missed.selfHarmTriggered).toBe(false);

    const skipped = CheckInSubmissionSchema.parse({
      participantId: "sim-post-tms-01",
      date: "2026-11-10",
      status: "not_today",
    });
    expect(skipped.status).toBe("not_today");
  });

  it("rejects missed or not_today check-ins that coerce scores to 0 or any numeric value", () => {
    const zeroScoredMissed = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "missed",
      moodScore: 0,
      compositeScore: 0,
    });
    expect(zeroScoredMissed.success).toBe(false);

    const numericMissed = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "not_today",
      moodScore: 3,
    });
    expect(numericMissed.success).toBe(false);
  });

  it("validates completed check-ins in 1..5 range and rejects out-of-range values", () => {
    const validFourItems = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      moodScore: 4,
      interestScore: 4,
      energyScore: 3,
      ruminationScore: 4,
      compositeScore: 3.75,
    });
    expect(validFourItems.success).toBe(true);

    const validSingleTap = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      singleItemScore: 3,
    });
    expect(validSingleTap.success).toBe(true);

    const validTwoTap = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      moodScore: 0,
      interestScore: 4,
    });
    expect(validTwoTap.success).toBe(true);

    const twoTapOutOfRange = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      moodScore: 5,
      interestScore: 2,
    });
    expect(twoTapOutOfRange.success).toBe(false);

    const twoTapNonInteger = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      moodScore: 2.5,
      interestScore: 3,
    });
    expect(twoTapNonInteger.success).toBe(false);

    const outOfRange = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      moodScore: 0,
      interestScore: 6,
      energyScore: 3,
      ruminationScore: 4,
    });
    expect(outOfRange.success).toBe(false);

    const zeroSingleTap = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      singleItemScore: 0,
    });
    expect(zeroSingleTap.success).toBe(false);

    const zeroComposite = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      moodScore: 3,
      interestScore: 3,
      energyScore: 3,
      ruminationScore: 3,
      compositeScore: 0,
    });
    expect(zeroComposite.success).toBe(false);

    for (const field of [
      "moodScore",
      "interestScore",
      "energyScore",
      "ruminationScore",
    ] as const) {
      const fourItemWithZero = CheckInSubmissionSchema.safeParse({
        participantId: "sim-post-tms-01",
        date: "2026-11-13",
        status: "completed",
        moodScore: 3,
        interestScore: 3,
        energyScore: 3,
        ruminationScore: 3,
        [field]: 0,
      });
      expect(fourItemWithZero.success).toBe(false);
    }

    const twoTapZeroZero = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      moodScore: 0,
      interestScore: 0,
    });
    expect(twoTapZeroZero.success).toBe(true);

    const twoTapWithEnergy = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      moodScore: 2,
      interestScore: 3,
      energyScore: 3,
    });
    expect(twoTapWithEnergy.success).toBe(false);

    const twoTapWithRumination = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      moodScore: 2,
      interestScore: 3,
      ruminationScore: 3,
    });
    expect(twoTapWithRumination.success).toBe(false);

    const twoTapWithComposite = CheckInSubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      moodScore: 2,
      interestScore: 3,
      compositeScore: 2.5,
    });
    expect(twoTapWithComposite.success).toBe(false);
  });
});

describe("Phq9SubmissionSchema & evaluatePhq9Submission", () => {
  it("flags immediate crisis path whenever item 9 (self-harm) is greater than 0", () => {
    const withSelfHarm = evaluatePhq9Submission({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      item1Interest: 1,
      item2Mood: 1,
      item3Sleep: 1,
      item4Energy: 1,
      item5Appetite: 0,
      item6SelfWorth: 1,
      item7Concentration: 1,
      item8Psychomotor: 0,
      item9SelfHarm: 1,
      crisisPathShown: true,
      isSimulated: true,
      source: "synthetic",
    });

    expect(withSelfHarm.totalScore).toBe(7);
    expect(withSelfHarm.crisisPathRequired).toBe(true);
  });

  it("does not require crisis path when item 9 is 0, and keeps missed PHQ-9 scores null", () => {
    const withoutSelfHarm = evaluatePhq9Submission({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "completed",
      item1Interest: 2,
      item2Mood: 2,
      item3Sleep: 1,
      item4Energy: 2,
      item5Appetite: 1,
      item6SelfWorth: 1,
      item7Concentration: 1,
      item8Psychomotor: 0,
      item9SelfHarm: 0,
      crisisPathShown: false,
      isSimulated: true,
      source: "synthetic",
    });

    expect(withoutSelfHarm.totalScore).toBe(10);
    expect(withoutSelfHarm.crisisPathRequired).toBe(false);

    const missed = evaluatePhq9Submission({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "missed",
      crisisPathShown: false,
      isSimulated: true,
      source: "synthetic",
    });
    expect(missed.totalScore).toBeNull();
    expect(missed.crisisPathRequired).toBe(false);
  });

  it("handles unfinished (in_progress) PHQ-9 without scoring and triggers crisis immediately on item 9 > 0", () => {
    const unfinishedWithSelfHarm = evaluatePhq9Submission({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "in_progress",
      item1Interest: 2,
      item9SelfHarm: 1,
      crisisPathShown: true,
      isSimulated: true,
      source: "synthetic",
    });
    expect(unfinishedWithSelfHarm.totalScore).toBeNull();
    expect(unfinishedWithSelfHarm.crisisPathRequired).toBe(true);

    const unfinishedWithoutSelfHarm = evaluatePhq9Submission({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "in_progress",
      item1Interest: 1,
      item2Mood: 2,
      crisisPathShown: false,
      isSimulated: true,
      source: "synthetic",
    });
    expect(unfinishedWithoutSelfHarm.totalScore).toBeNull();
    expect(unfinishedWithoutSelfHarm.crisisPathRequired).toBe(false);

    const unfinishedWithTotalScore = Phq9SubmissionSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      status: "in_progress",
      item1Interest: 1,
      totalScore: 1,
    });
    expect(unfinishedWithTotalScore.success).toBe(false);
  });
});

describe("Privacy-preserving sensor schemas (.strict())", () => {
  it("CameraReadingInputSchema accepts derived MediaPipe numbers and rejects raw video/frame/image fields", () => {
    const validDerived = CameraReadingInputSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      durationSec: 60,
      effectiveFps: 10,
      faceDetectedRatio: 0.98,
      expressivityScore: 0.34,
      smileFraction: 0.18,
      yawSdDeg: 4.2,
      pitchSdDeg: 3.1,
      angularPathDegPerMin: 42.5,
    });
    expect(validDerived.success).toBe(true);

    for (const forbiddenField of [
      "video",
      "frames",
      "imageBase64",
      "audio",
      "blob",
    ]) {
      const withRawPayload = CameraReadingInputSchema.safeParse({
        participantId: "sim-post-tms-01",
        date: "2026-11-13",
        durationSec: 60,
        effectiveFps: 10,
        faceDetectedRatio: 0.98,
        expressivityScore: 0.34,
        smileFraction: 0.18,
        yawSdDeg: 4.2,
        pitchSdDeg: 3.1,
        angularPathDegPerMin: 42.5,
        [forbiddenField]: "raw-binary-data",
      });
      expect(withRawPayload.success).toBe(false);
    }
  });

  it("SpeechReadingInputSchema accepts derived timing numbers and rejects raw audio or transcript fields", () => {
    const validSpeech = SpeechReadingInputSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      syllableCount: 110,
      readingTimeSec: 30,
      speakingTimeSec: 23.5,
      pauseTimeSec: 6.5,
      speechRateSylPerSec: 3.67,
      articulationRateSylPerSec: 4.68,
      pauseCountOver250ms: 8,
      meanPauseLengthMs: 420,
      pauseRatio: 0.216,
    });
    expect(validSpeech.success).toBe(true);

    const withRawAudio = SpeechReadingInputSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      syllableCount: 110,
      readingTimeSec: 30,
      speakingTimeSec: 23.5,
      pauseTimeSec: 6.5,
      speechRateSylPerSec: 3.67,
      articulationRateSylPerSec: 4.68,
      pauseCountOver250ms: 8,
      meanPauseLengthMs: 420,
      pauseRatio: 0.216,
      audioBlob: "base64-wav-data",
    });
    expect(withRawAudio.success).toBe(false);
  });

  it("RoutineSignalInputSchema rejects raw merchant or transaction fields", () => {
    const withMerchants = RoutineSignalInputSchema.safeParse({
      participantId: "sim-post-tms-01",
      periodStartDate: "2026-11-01",
      periodEndDate: "2026-11-07",
      channel: "financial_routine",
      broadArea: "financial_routine",
      derivedValue: 2.1,
      unit: "weekly_index",
      transactions: [{ merchant: "Store", amount: 42.5 }],
    });
    expect(withMerchants.success).toBe(false);
  });

  it("RingDayInputSchema validates 24h hourlyActivity and 1440-char sleepWakeGrid", () => {
    const validRing = RingDayInputSchema.safeParse({
      participantId: "sim-post-tms-01",
      date: "2026-11-13",
      dayIndex: 18,
      hourlyActivity: Array.from({ length: 24 }, () => 120),
      sleepWakeGrid: "1".repeat(480) + "0".repeat(960),
    });
    expect(validRing.success).toBe(true);
  });
});

describe("toSafeClinicFlagView (Decision D8 & financial routine privacy)", () => {
  it("hides specific measure details by default when patientSharedDetails is false", () => {
    const safeView = toSafeClinicFlagView(
      {
        id: "flag-1",
        participantId: "sim-post-tms-01",
        sinceDate: "2026-11-01",
        triggerKind: "sustained_dip",
        primaryArea: "check_in",
        broadAreasJson: JSON.stringify(["check_in", "sleep"]),
        status: "open",
        ringActiveDuringSilence: true,
        patientSharedDetails: false,
        isSimulated: true,
      },
      "Check-in dropped 1.4 SD below baseline and SRI dropped by 12 points."
    );

    expect(safeView.broadAreas).toEqual(["check_in", "sleep"]);
    expect(safeView.sharedMeasureSummary).toBeNull();
  });

  it("includes sharedMeasureSummary when patientSharedDetails is true for non-financial areas", () => {
    const summaryText =
      "Patient opted to share: check-in composite shifted from 4.1 to 2.3 over two rounds.";
    const safeView = toSafeClinicFlagView(
      {
        id: "flag-2",
        participantId: "sim-post-tms-01",
        sinceDate: "2026-11-01",
        triggerKind: "sustained_dip",
        primaryArea: "check_in",
        broadAreasJson: JSON.stringify(["check_in", "sleep"]),
        status: "open",
        ringActiveDuringSilence: true,
        patientSharedDetails: true,
        isSimulated: true,
      },
      summaryText
    );

    expect(safeView.sharedMeasureSummary).toBe(summaryText);
  });

  it("NEVER exposes sharedMeasureSummary when primaryArea or broadAreas involves financial_routine", () => {
    const safeViewPrimary = toSafeClinicFlagView(
      {
        id: "flag-3",
        participantId: "sim-post-tms-01",
        sinceDate: "2026-11-01",
        triggerKind: "sustained_dip",
        primaryArea: "financial_routine",
        broadAreasJson: JSON.stringify(["check_in", "financial_routine"]),
        status: "open",
        ringActiveDuringSilence: true,
        patientSharedDetails: true,
        isSimulated: true,
      },
      "Late-night card orders increased by 3.2 SD"
    );

    expect(safeViewPrimary.primaryArea).toBe("financial_routine");
    expect(safeViewPrimary.sharedMeasureSummary).toBeNull();
  });
});

describe("Domain Constants Compliance", () => {
  it("defines the three demo moments and five broad life areas", () => {
    expect(DEMO_MOMENTS.well.dayIndex).toBe(18);
    expect(DEMO_MOMENTS.small_dip.dayIndex).toBe(29);
    expect(DEMO_MOMENTS.sustained_drift.dayIndex).toBe(56);
    expect(BROAD_AREA_KEYS).toEqual([
      "check_in",
      "sleep",
      "daily_routine",
      "activity_outside_home",
      "financial_routine",
    ]);
  });

  it("ensures crisis resources include 112 and MIELI Helpline and patient suggestions exclude unsupported actions", () => {
    expect(CRISIS_RESOURCES.some((r) => r.phone === "112")).toBe(true);
    expect(CRISIS_RESOURCES.some((r) => r.phone === "09 2525 0111")).toBe(true);
    expect(PATIENT_SUGGESTIONS[0]?.actionKey).toBe("short_walk");
    expect(PATIENT_SUGGESTIONS[0]?.actionTitle).toBe(
      "Take a 10-minute walk outside"
    );
    const allText = JSON.stringify(PATIENT_SUGGESTIONS).toLowerCase();
    expect(allText).not.toContain("happy memory");
    expect(allText).not.toContain("sad music");
    expect(allText).not.toContain("cold water");
    expect(PHQ9_ITEMS).toHaveLength(9);
    expect(PHQ9_ITEMS[8]?.isSelfHarmItem).toBe(true);
  });
});
