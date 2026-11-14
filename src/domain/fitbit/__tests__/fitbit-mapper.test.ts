import { describe, expect, it } from "vitest";
import {
  buildHourlyActivityFromFitbit,
  buildSleepWakeGridFromFitbit,
  computeSleepMidpointMin,
  mapFitbitDayToRingDay,
} from "../mapper";
import type { FitbitSleepLog } from "../types";

describe("Fitbit Domain Mapper (src/domain/fitbit)", () => {
  it("computes sleep midpoint relative to targetDate midnight across midnight and post-midnight bedtimes", () => {
    // 23:15 prev day (-45 min) to 07:15 targetDate (+435 min) -> midpoint +195 (03:15)
    expect(
      computeSleepMidpointMin(
        "2026-11-12T23:15:00.000",
        "2026-11-13T07:15:00.000",
        "2026-11-13"
      )
    ).toBe(195);

    // 01:00 targetDate (+60 min) to 09:00 targetDate (+540 min) -> midpoint +300 (05:00)
    expect(
      computeSleepMidpointMin(
        "2026-11-13T01:00:00.000",
        "2026-11-13T09:00:00.000",
        "2026-11-13"
      )
    ).toBe(300);

    // Invalid ordering returns null
    expect(
      computeSleepMidpointMin(
        "2026-11-13T08:00:00.000",
        "2026-11-13T07:00:00.000",
        "2026-11-13"
      )
    ).toBeNull();
  });

  it("builds an exact 1440-character sleep/wake grid with wake gaps preserved", () => {
    const sleepLogs: FitbitSleepLog[] = [
      {
        dateOfSleep: "2026-11-13",
        startTime: "2026-11-12T23:30:00.000",
        endTime: "2026-11-13T07:00:00.000",
        isMainSleep: true,
        minutesAsleep: 410,
        minutesAwake: 40,
        timeInBed: 450,
        levels: {
          data: [
            {
              dateTime: "2026-11-12T23:30:00.000",
              level: "light",
              seconds: 5400, // until 01:00 (minutes 0..59 on targetDate)
            },
            {
              dateTime: "2026-11-13T01:00:00.000",
              level: "wake",
              seconds: 1800, // 01:00..01:30 (minutes 60..89 awake)
            },
            {
              dateTime: "2026-11-13T01:30:00.000",
              level: "deep",
              seconds: 19800, // 01:30..07:00 (minutes 90..419 asleep)
            },
          ],
        },
      },
    ];

    const grid = buildSleepWakeGridFromFitbit(sleepLogs, "2026-11-13");
    expect(grid).not.toBeNull();
    expect(grid?.length).toBe(1440);
    expect(grid?.slice(0, 60)).toBe("1".repeat(60));
    expect(grid?.slice(60, 90)).toBe("0".repeat(30));
    expect(grid?.slice(90, 420)).toBe("1".repeat(330));
    expect(grid?.slice(420, 1440)).toBe("0".repeat(1020));
  });

  it("aggregates intraday step points into 24 hours without coercing missing hours to zero", () => {
    const { hourly, validHours } = buildHourlyActivityFromFitbit([
      { time: "00:00:00", value: 0 },
      { time: "08:00:00", value: 150 },
      { time: "08:15:00", value: 250 },
      { time: "12:30:00", value: 900 },
      { time: "invalid", value: 100 },
      { time: "14:00:00", value: -5 },
    ]);

    expect(validHours).toBe(3);
    expect(hourly).toHaveLength(24);
    expect(hourly[0]).toBe(0);
    expect(hourly[8]).toBe(400);
    expect(hourly[12]).toBe(900);
    expect(hourly[14]).toBeNull();
    expect(hourly[23]).toBeNull();
  });

  it("maps a full Fitbit day bundle into a RingDay-compatible object marked non-simulated", () => {
    const intraday = Array.from({ length: 24 }, (_, h) => ({
      time: `${String(h).padStart(2, "0")}:00:00`,
      value: h >= 8 && h <= 20 ? 350 : 5,
    }));

    const mapped = mapFitbitDayToRingDay({
      date: "2026-11-13",
      dayIndex: 1,
      sleepLogs: [
        {
          dateOfSleep: "2026-11-13",
          startTime: "2026-11-12T23:00:00.000",
          endTime: "2026-11-13T07:00:00.000",
          isMainSleep: true,
          minutesAsleep: 455,
          minutesAwake: 25,
          timeInBed: 480,
          levels: {
            data: [
              { dateTime: "2026-11-12T23:00:00.000", level: "light", seconds: 7200 },
              { dateTime: "2026-11-13T01:00:00.000", level: "wake", seconds: 1500 },
              { dateTime: "2026-11-13T01:25:00.000", level: "rem", seconds: 20100 },
            ],
          },
        },
      ],
      activity: {
        date: "2026-11-13",
        steps: 4605,
        activityCalories: 520,
        intradaySteps: intraday,
      },
      heart: {
        date: "2026-11-13",
        restingHeartRate: 62,
      },
    });

    expect(mapped.ringActive).toBe(true);
    expect(mapped.intradayAvailable).toBe(true);
    expect(mapped.steps).toBe(4605);
    expect(mapped.avgHrBpm).toBe(62);
    expect(mapped.sleepMidpointMin).toBe(180); // 03:00 AM
    expect(mapped.nightActivityBouts).toBe(1);
    expect(mapped.sleepWakeGrid?.length).toBe(1440);
    expect(mapped.isSimulated).toBe(false);
    expect(mapped.source).toBe("fitbit");
  });
});
