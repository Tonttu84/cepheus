import { describe, expect, it } from "vitest";
import { mapHealthConnectPayloadToRingDays } from "../mapper";

describe("Health Connect Domain Mapper (src/domain/health-connect)", () => {
  it("maps sleep stages into 1440-char sleepWakeGrid, WASO, and sleep midpoint", () => {
    const days = mapHealthConnectPayloadToRingDays({
      source: "health_connect",
      sleep: [
        {
          session_end_time: "2026-11-14T07:00:00Z",
          duration_seconds: 28800, // 23:00 prev day -> 07:00
          stages: [
            {
              stage: "deep",
              start_time: "2026-11-13T23:00:00Z",
              end_time: "2026-11-14T01:00:00Z",
            },
            {
              stage: "awake",
              start_time: "2026-11-14T01:00:00Z",
              end_time: "2026-11-14T01:20:00Z",
            },
            {
              stage: "rem",
              start_time: "2026-11-14T01:20:00Z",
              end_time: "2026-11-14T07:00:00Z",
            },
          ],
        },
      ],
    });

    expect(days).toHaveLength(1);
    const day = days[0];
    expect(day.date).toBe("2026-11-14");
    expect(day.sleepWakeGrid).toHaveLength(1440);
    expect(day.sleepWakeGrid?.slice(0, 60)).toBe("1".repeat(60));
    expect(day.sleepWakeGrid?.slice(60, 80)).toBe("0".repeat(20));
    expect(day.sleepWakeGrid?.slice(80, 420)).toBe("1".repeat(340));
    expect(day.wasoMinutes).toBe(20);
    expect(day.totalSleepMin).toBe(460);
    expect(day.nightActivityBouts).toBe(1);
    expect(day.sleepMidpointMin).toBe(180); // 03:00
    expect(day.source).toBe("health_connect");
    expect(day.isSimulated).toBe(false);
  });

  it("buckets hourly steps while preferring daily_totals to prevent double counting, and aggregates HR/HRV", () => {
    const days = mapHealthConnectPayloadToRingDays({
      source: "healthkit_ios",
      steps: [
        { bucket_start: "2026-11-14T08:00:00+02:00", total: 420 },
        { bucket_start: "2026-11-14T08:30:00+02:00", total: 180 },
        { bucket_start: "2026-11-14T14:00:00+02:00", count: 1200 },
      ],
      daily_totals: [{ date: "2026-11-14", steps: 1550, active_calories_kcal: 310 }],
      heart_rate: [
        { time: "2026-11-14T03:00:00+02:00", bpm: 54 },
        { time: "2026-11-14T04:00:00+02:00", avg: 62, min: 52 },
      ],
      heart_rate_variability: [
        { time: "2026-11-14T04:00:00+02:00", rmssd_millis: 44 },
        { time: "2026-11-14T05:00:00+02:00", rmssd_millis: 52 },
      ],
    });

    expect(days).toHaveLength(1);
    const day = days[0];
    expect(day.source).toBe("healthkit_ios");
    expect(day.hourlyActivity[8]).toBe(600);
    expect(day.hourlyActivity[14]).toBe(1200);
    expect(day.hourlyActivity[23]).toBeNull();
    expect(day.steps).toBe(1550); // deduplicated daily_totals wins over 1800 raw sum
    expect(day.activeCaloriesKcal).toBe(310);
    expect(day.lowestHrBpm).toBe(52);
    expect(day.avgHrBpm).toBe(58);
    expect(day.avgHrvRmssdMs).toBe(48);
  });
});
