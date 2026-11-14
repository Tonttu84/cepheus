import { DEFAULT_ROUNDS_CONFIG } from "./config";
import {
  addDays,
  findUtcInstantForLocalWallClock,
  getIsoWeekday,
} from "./time";
import type { Round, RoundsConfig, Schedule, Weekday } from "./types";

export interface RoundListOptions {
  readonly count?: number;
}

/**
 * Ruling (j): When the enrolment date is one of the chosen weekdays, round 1 is
 * that day's round at the chosen time, also when the person is enrolled later
 * that day than the chosen time; it is then open at once.
 *
 * The enrolment date is a calendar date YYYY-MM-DD, active from the start of that local day.
 * The check `opensAtMs >= enrolmentMs` was removed because it was always true:
 * the enrolment date starts at 00:00 local time, so any chosen timeOfDay on that
 * same date is >= 00:00. Round 1 is simply that day's round if enrolmentDate is a
 * chosen weekday, or the first chosen weekday after it.
 */
function findFirstRoundDate(schedule: Schedule): string {
  let candidateDate = schedule.enrolmentDate;
  while (!schedule.weekdays.includes(getIsoWeekday(candidateDate))) {
    candidateDate = addDays(candidateDate, 1);
  }
  return candidateDate;
}

function findNextRoundDate(currentDate: string, weekdays: readonly [Weekday, Weekday]): string {
  let nextDate = addDays(currentDate, 1);
  while (!weekdays.includes(getIsoWeekday(nextDate))) {
    nextDate = addDays(nextDate, 1);
  }
  return nextDate;
}

/**
 * Returns the list of rounds according to requirement 1.
 * Round 1 opens at the first chosen weekday and time on or after the enrolment date,
 * in the patient's time zone; each next round opens at the next chosen weekday.
 * A round ends the moment the next one opens.
 */
export function listRounds(
  schedule: Schedule,
  countOrOptions: number | RoundListOptions = DEFAULT_ROUNDS_CONFIG.defaultRoundCount,
  config: Partial<RoundsConfig> = DEFAULT_ROUNDS_CONFIG
): Round[] {
  const defaultCount = config.defaultRoundCount ?? DEFAULT_ROUNDS_CONFIG.defaultRoundCount;
  const count =
    typeof countOrOptions === "number"
      ? countOrOptions
      : (countOrOptions.count ?? defaultCount);
  if (count <= 0) {
    return [];
  }

  const roundDates: string[] = [];
  let curDate = findFirstRoundDate(schedule);
  // Generate count + 1 dates to know each round's endsAt (the next round's opensAt)
  for (let i = 0; i <= count; i++) {
    roundDates.push(curDate);
    curDate = findNextRoundDate(curDate, schedule.weekdays);
  }

  const openInstants = roundDates.map((date) =>
    findUtcInstantForLocalWallClock(date, schedule.timeOfDay, schedule.timeZone)
  );

  const rounds: Round[] = [];
  for (let i = 0; i < count; i++) {
    rounds.push({
      number: i + 1,
      localDate: roundDates[i],
      opensAt: openInstants[i],
      endsAt: openInstants[i + 1],
    });
  }
  return rounds;
}

/**
 * Determines which round is open at a given moment (requirement 2).
 * Returns null if the moment is before round 1 opens.
 */
export function getOpenRound(
  schedule: Schedule,
  moment: string | Date,
  config: Partial<RoundsConfig> = DEFAULT_ROUNDS_CONFIG
): Round | null {
  const maxRounds = config.maxSearchRounds ?? DEFAULT_ROUNDS_CONFIG.maxSearchRounds;
  const targetMs = typeof moment === "string" ? new Date(moment).getTime() : moment.getTime();

  let curNumber = 1;
  let curDate = findFirstRoundDate(schedule);
  let curOpensAt = findUtcInstantForLocalWallClock(curDate, schedule.timeOfDay, schedule.timeZone);
  let curOpensAtMs = new Date(curOpensAt).getTime();

  if (targetMs < curOpensAtMs) {
    return null;
  }

  while (curNumber <= maxRounds) {
    const nextDate = findNextRoundDate(curDate, schedule.weekdays);
    const nextOpensAt = findUtcInstantForLocalWallClock(
      nextDate,
      schedule.timeOfDay,
      schedule.timeZone
    );
    const nextOpensAtMs = new Date(nextOpensAt).getTime();

    if (targetMs < nextOpensAtMs) {
      return {
        number: curNumber,
        localDate: curDate,
        opensAt: curOpensAt,
        endsAt: nextOpensAt,
      };
    }

    curNumber++;
    curDate = nextDate;
    curOpensAt = nextOpensAt;
    curOpensAtMs = nextOpensAtMs;
  }
  return null;
}

/**
 * Ruling (e): an answer belongs to the round that is open at the moment it arrives.
 * So an answer arriving after the scheduled day but before the next round opens counts for that round.
 */
export function getRoundForSubmission(
  schedule: Schedule,
  arrivalMoment: string | Date,
  config: Partial<RoundsConfig> = DEFAULT_ROUNDS_CONFIG
): Round | null {
  return getOpenRound(schedule, arrivalMoment, config);
}
