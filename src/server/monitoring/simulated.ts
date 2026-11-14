import { mapFitbitDayToRingDay, type FitbitMappedDay } from "@/domain/fitbit";
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
