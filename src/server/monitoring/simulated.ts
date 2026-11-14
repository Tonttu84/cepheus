import { mapFitbitDayToRingDay, type FitbitMappedDay } from "@/domain/fitbit";
import type {
  HealthConnectDailyTotal,
  HealthConnectHeartRateRecord,
  HealthConnectHrvRecord,
  HealthConnectSleepRecord,
  HealthConnectStepRecord,
  HealthConnectWebhookPayload,
} from "@/domain/health-connect";
import { generateSimulatedPersonWeeks } from "@/lib/simulation";

/**
 * Generates 7 simulated wearable days shaped through the Fitbit domain mapper,
 * explicitly labelled isSimulated: true so the UI/API never misrepresent them
 * as live Fitbit data.
 */
export function buildSimulatedFitbitWeek(endDate?: string): FitbitMappedDay[] {
  const dataset = generateSimulatedPersonWeeks({ throughDay: 28 });
  const lastSeven = dataset.ringDays.slice(-7);

  return lastSeven.map((ringDay, idx) => {
    const targetDate = endDate
      ? shiftDateIso(endDate, idx - (lastSeven.length - 1))
      : ringDay.date;

    const hourly = ringDay.hourlyActivityJson
      ? (JSON.parse(ringDay.hourlyActivityJson) as (number | null)[])
      : new Array<number | null>(24).fill(null);

    const intradaySteps = hourly.map((val, hour) => ({
      time: `${String(hour).padStart(2, "0")}:00:00`,
      value: val !== null ? Math.round(val * 12) : 0,
    }));

    const prevDate = shiftDateIso(targetDate, -1);
    const mapped = mapFitbitDayToRingDay({
      date: targetDate,
      dayIndex: idx + 1,
      sleepLogs: [
        {
          dateOfSleep: targetDate,
          startTime: `${prevDate}T23:15:00.000`,
          endTime: `${targetDate}T07:05:00.000`,
          isMainSleep: true,
          minutesAsleep: Math.round(ringDay.totalSleepMin ?? 430),
          minutesAwake: Math.round(ringDay.wasoMinutes ?? 28),
          timeInBed: Math.round(ringDay.timeInBedMin ?? 470),
          levels: {
            data: [
              {
                dateTime: `${prevDate}T23:15:00.000`,
                level: "light",
                seconds: 7200,
              },
              {
                dateTime: `${targetDate}T01:15:00.000`,
                level: "wake",
                seconds: Math.max(60, Math.round((ringDay.wasoMinutes ?? 25) * 60)),
              },
              {
                dateTime: `${targetDate}T01:45:00.000`,
                level: "deep",
                seconds: 19200,
              },
            ],
          },
        },
      ],
      activity: {
        date: targetDate,
        steps: ringDay.steps ?? 5200,
        activityCalories: ringDay.activeCaloriesKcal ?? 480,
        intradaySteps,
      },
      heart: {
        date: targetDate,
        restingHeartRate: ringDay.avgHrBpm ?? 63,
      },
    });

    return mapped;
  });
}

function shiftDateIso(baseDate: string, deltaDays: number): string {
  const [y, m, d] = baseDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/**
 * Generates a realistic 7-day Health Connect webhook JSON payload
 * matching Life Dashboard Companion / HC Webhook schemas, marked isSimulated: true.
 */
export function buildSimulatedHealthConnectPayload(
  endDate: string = new Date().toISOString().slice(0, 10)
): HealthConnectWebhookPayload {
  const dataset = generateSimulatedPersonWeeks({ throughDay: 28 });
  const lastSeven = dataset.ringDays.slice(-7);

  const sleep: HealthConnectSleepRecord[] = [];
  const steps: HealthConnectStepRecord[] = [];
  const heart_rate: HealthConnectHeartRateRecord[] = [];
  const heart_rate_variability: HealthConnectHrvRecord[] = [];
  const daily_totals: HealthConnectDailyTotal[] = [];

  lastSeven.forEach((ringDay, idx) => {
    const targetDate = shiftDateIso(endDate, idx - (lastSeven.length - 1));
    const prevDate = shiftDateIso(targetDate, -1);

    sleep.push({
      session_end_time: `${targetDate}T07:05:00Z`,
      duration_seconds: Math.round((ringDay.timeInBedMin ?? 470) * 60),
      stages: [
        {
          stage: "deep",
          start_time: `${prevDate}T23:15:00Z`,
          end_time: `${targetDate}T01:15:00Z`,
        },
        {
          stage: "awake",
          start_time: `${targetDate}T01:15:00Z`,
          end_time: `${targetDate}T01:40:00Z`,
        },
        {
          stage: "rem",
          start_time: `${targetDate}T01:40:00Z`,
          end_time: `${targetDate}T07:05:00Z`,
        },
      ],
    });

    const hourly = ringDay.hourlyActivityJson
      ? (JSON.parse(ringDay.hourlyActivityJson) as (number | null)[])
      : new Array<number | null>(24).fill(0);

    for (let h = 0; h < 24; h++) {
      const hourStr = String(h).padStart(2, "0");
      steps.push({
        bucket_start: `${targetDate}T${hourStr}:00:00Z`,
        total: Math.max(0, Math.round((hourly[h] ?? 0) * 12)),
      });
    }

    daily_totals.push({
      date: targetDate,
      steps: ringDay.steps ?? 5200,
      active_calories_kcal: ringDay.activeCaloriesKcal ?? 460,
    });

    heart_rate.push({
      time: `${targetDate}T03:30:00Z`,
      avg: ringDay.avgHrBpm ?? 61,
      min: ringDay.lowestHrBpm ?? 54,
    });

    heart_rate_variability.push({
      time: `${targetDate}T03:30:00Z`,
      rmssd_millis: ringDay.avgHrvRmssdMs ?? 45,
    });
  });

  return {
    test: false,
    source: "health_connect",
    isSimulated: true,
    sleep,
    steps,
    daily_totals,
    heart_rate,
    heart_rate_variability,
  };
}
