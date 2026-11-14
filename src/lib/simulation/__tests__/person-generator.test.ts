import { describe, expect, it } from "vitest";
import {
  createSeededRng,
  DEFAULT_SIMULATION_SEED,
  generateSimulatedPersonWeeks,
  SIMULATED_PARTICIPANT_EXTERNAL_ID,
  sliceDatasetThroughDay,
} from "../index";

describe("createSeededRng", () => {
  it("produces an identical sequence for the same seed and differs for another seed", () => {
    const rngA = createSeededRng(20261113);
    const rngB = createSeededRng(20261113);
    const rngC = createSeededRng(999999);

    const seqA = Array.from({ length: 12 }, () => rngA.next());
    const seqB = Array.from({ length: 12 }, () => rngB.next());
    const seqC = Array.from({ length: 12 }, () => rngC.next());

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("generateSimulatedPersonWeeks", () => {
  it("is 100% deterministic for the same seed and varies noise for a different seed while preserving phases", () => {
    const run1 = generateSimulatedPersonWeeks({ seed: DEFAULT_SIMULATION_SEED });
    const run2 = generateSimulatedPersonWeeks({ seed: DEFAULT_SIMULATION_SEED });
    const runAlt = generateSimulatedPersonWeeks({ seed: 1337 });

    expect(run1).toEqual(run2);
    expect(run1.ringDays[0].steps).not.toBe(runAlt.ringDays[0].steps);
    // Both seeds preserve the 56-day trajectory and 3 demo phases
    expect(runAlt.ringDays).toHaveLength(56);
    expect(runAlt.checkInRounds).toHaveLength(16);
    expect(runAlt.clinicFlags).toHaveLength(1);
  });

  it("marks every generated record as isSimulated: true and uses an anonymous participant label", () => {
    const dataset = generateSimulatedPersonWeeks();

    expect(dataset.participant.externalId).toBe(SIMULATED_PARTICIPANT_EXTERNAL_ID);
    expect(dataset.participant.label).toBe("Simulated post-TMS participant");
    expect(dataset.participant.isSimulated).toBe(true);
    expect(dataset.participant.source).toBe("synthetic");

    for (const row of dataset.ringDays) {
      expect(row.isSimulated).toBe(true);
      expect(row.source).toBe("synthetic");
    }
    for (const row of dataset.checkInRounds) {
      expect(row.isSimulated).toBe(true);
      expect(row.source).toBe("synthetic");
    }
    for (const row of dataset.phq9Assessments) {
      expect(row.isSimulated).toBe(true);
      expect(row.source).toBe("synthetic");
    }
    for (const row of dataset.rhythmWindows) {
      expect(row.isSimulated).toBe(true);
    }
    for (const row of dataset.cameraReadings) {
      expect(row.isSimulated).toBe(true);
      expect(row.source).toBe("synthetic");
    }
    for (const row of dataset.routineReadings) {
      expect(row.isSimulated).toBe(true);
      expect(row.source).toBe("synthetic");
    }
    for (const row of dataset.patientSuggestions) {
      expect(row.isSimulated).toBe(true);
    }
    for (const row of dataset.clinicFlags) {
      expect(row.isSimulated).toBe(true);
    }
  });

  it("enforces RingDay invariants across all 56 days (24h activity array, 1440-char binary sleepWakeGrid, ringActive true)", () => {
    const dataset = generateSimulatedPersonWeeks();

    expect(dataset.ringDays).toHaveLength(56);
    expect(dataset.ringDays[0].date).toBe("2026-09-18");
    expect(dataset.ringDays[55].date).toBe("2026-11-12");

    for (const day of dataset.ringDays) {
      expect(day.ringActive).toBe(true);
      expect(day.wearMinutes).toBeGreaterThanOrEqual(1380);
      expect(day.sleepWakeGrid).toHaveLength(1440);
      expect(/^[01]{1440}$/.test(day.sleepWakeGrid)).toBe(true);

      const hourly = JSON.parse(day.hourlyActivityJson) as unknown[];
      expect(Array.isArray(hourly)).toBe(true);
      expect(hourly).toHaveLength(24);
      for (const val of hourly) {
        expect(typeof val).toBe("number");
        expect(Number.isFinite(val)).toBe(true);
        expect(val as number).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("never scores missed check-in rounds or missed PHQ-9 assessments as 0, while recording ringActiveAtRound: true", () => {
    const dataset = generateSimulatedPersonWeeks();

    const missedRounds = dataset.checkInRounds.filter((r) => r.status === "missed");
    expect(missedRounds).toHaveLength(2);
    expect(missedRounds.map((r) => r.dayIndex)).toEqual([52, 55]);

    for (const r of missedRounds) {
      expect(r.respondedAt).toBeNull();
      expect(r.reminderSentAt).not.toBeNull();
      expect(r.moodScore).toBeNull();
      expect(r.interestScore).toBeNull();
      expect(r.ringActiveAtRound).toBe(true);
    }

    const completedRounds = dataset.checkInRounds.filter((r) => r.status === "completed");
    for (const r of completedRounds) {
      expect(Number.isInteger(r.moodScore)).toBe(true);
      expect(Number.isInteger(r.interestScore)).toBe(true);
      expect(r.moodScore).toBeGreaterThanOrEqual(0);
      expect(r.moodScore).toBeLessThanOrEqual(4);
      expect(r.interestScore).toBeGreaterThanOrEqual(0);
      expect(r.interestScore).toBeLessThanOrEqual(4);
    }

    const missedPhq9 = dataset.phq9Assessments.filter((p) => p.status === "missed");
    expect(missedPhq9).toHaveLength(1);
    expect(missedPhq9[0].dayIndex).toBe(56);
    expect(missedPhq9[0].totalScore).toBeNull();
    expect(missedPhq9[0].item1Interest).toBeNull();
    expect(missedPhq9[0].item9SelfHarm).toBeNull();
  });

  it("slices accurately at all 3 demo moments: Day 18 (well), Day 29 (small_dip), and Day 56 (sustained_drift)", () => {
    const full = generateSimulatedPersonWeeks();

    // 1. Demo Moment "well" -> Day 18 (Week 3)
    const wellSlice = sliceDatasetThroughDay(full, 18);
    expect(wellSlice.participant.currentDemoDay).toBe(18);
    expect(wellSlice.ringDays).toHaveLength(18);
    expect(wellSlice.patientSuggestions).toHaveLength(0);
    expect(wellSlice.clinicFlags).toHaveLength(0);
    const wellAvgMood =
      wellSlice.checkInRounds.reduce((acc, r) => acc + (r.moodScore ?? 0), 0) /
      wellSlice.checkInRounds.length;
    expect(wellAvgMood).toBeGreaterThanOrEqual(3.0);
    const day18Window = wellSlice.rhythmWindows[wellSlice.rhythmWindows.length - 1];
    expect(day18Window.sri).toBeGreaterThanOrEqual(80);

    // 2. Demo Moment "small_dip" -> Day 29 (Week 5)
    const smallDipSlice = sliceDatasetThroughDay(full, 29);
    expect(smallDipSlice.participant.currentDemoDay).toBe(29);
    expect(smallDipSlice.ringDays).toHaveLength(29);
    expect(smallDipSlice.clinicFlags).toHaveLength(0);
    expect(smallDipSlice.patientSuggestions).toHaveLength(1);
    expect(smallDipSlice.patientSuggestions[0].dayIndex).toBe(28);
    expect(smallDipSlice.patientSuggestions[0].reason).toBe("small_dip");
    expect(smallDipSlice.patientSuggestions[0].actionKey).toBe("short_walk");
    expect(smallDipSlice.patientSuggestions[0].status).toBe("shown");
    const round8 = smallDipSlice.checkInRounds.find((r) => r.roundNumber === 8);
    expect(round8?.moodScore).toBe(1);

    // 3. Demo Moment "sustained_drift" -> Day 56 (Week 8)
    const driftSlice = sliceDatasetThroughDay(full, 56);
    expect(driftSlice.participant.currentDemoDay).toBe(56);
    expect(driftSlice.ringDays).toHaveLength(56);
    expect(driftSlice.patientSuggestions[0].status).toBe("completed");
    expect(driftSlice.clinicFlags).toHaveLength(1);

    const flag = driftSlice.clinicFlags[0];
    expect(flag.status).toBe("open");
    expect(flag.ringActiveDuringSilence).toBe(true);
    expect(flag.patientSharedDetails).toBe(false);
    const broadAreas = JSON.parse(flag.broadAreasJson) as string[];
    expect(broadAreas).toEqual(["check_in", "sleep", "daily_routine"]);

    const day56Window = driftSlice.rhythmWindows[driftSlice.rhythmWindows.length - 1];
    expect(day56Window.sri).toBeLessThan(68);
  });
});
