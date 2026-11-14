import { describe, expect, it } from "vitest";
import { getOpenRound, getRoundForSubmission, listRounds } from "../rounds";
import type { Schedule } from "../types";

describe("the list of rounds (requirement 1)", () => {
  it("enrolment on a chosen weekday before the chosen time opens round 1 on that same day", () => {
    // Weekdays Monday (1) and Thursday (4) at 14:00 local time in Europe/Helsinki
    // Enrolment on Monday 2026-03-02 (starts at 00:00 local)
    const schedule: Schedule = {
      weekdays: [1, 4],
      timeOfDay: "14:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-02",
    };

    const rounds = listRounds(schedule, 2);
    expect(rounds).toHaveLength(2);

    expect(rounds[0]).toEqual({
      number: 1,
      localDate: "2026-03-02",
      opensAt: "2026-03-02T12:00:00.000Z", // 14:00 EET is 12:00 UTC
      endsAt: "2026-03-05T12:00:00.000Z",
    });

    expect(rounds[1]).toEqual({
      number: 2,
      localDate: "2026-03-05",
      opensAt: "2026-03-05T12:00:00.000Z",
      endsAt: "2026-03-09T12:00:00.000Z",
    });
  });

  it("enrolment on a date after a chosen weekday opens round 1 on the next chosen weekday", () => {
    // Enrolment on Tuesday 2026-03-03 (after Monday); chosen weekdays are Monday (1) and Thursday (4)
    const schedule: Schedule = {
      weekdays: [1, 4],
      timeOfDay: "14:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-03",
    };

    const rounds = listRounds(schedule, 2);
    expect(rounds[0].number).toBe(1);
    expect(rounds[0].localDate).toBe("2026-03-05"); // Thursday
    expect(rounds[0].opensAt).toBe("2026-03-05T12:00:00.000Z");

    expect(rounds[1].number).toBe(2);
    expect(rounds[1].localDate).toBe("2026-03-09"); // Next Monday
    expect(rounds[1].opensAt).toBe("2026-03-09T12:00:00.000Z");
  });

  it("enrolment the day before a chosen weekday opens round 1 on the chosen weekday", () => {
    // Enrolment on Sunday 2026-03-01; chosen weekdays are Monday (1) and Thursday (4)
    const schedule: Schedule = {
      weekdays: [1, 4],
      timeOfDay: "14:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    };

    const rounds = listRounds(schedule, 1);
    expect(rounds[0].number).toBe(1);
    expect(rounds[0].localDate).toBe("2026-03-02");
    expect(rounds[0].opensAt).toBe("2026-03-02T12:00:00.000Z");
  });

  it("each next round opens at the next chosen weekday and ends the moment the next one opens", () => {
    const schedule: Schedule = {
      weekdays: [2, 5], // Tuesday and Friday
      timeOfDay: "10:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    };

    const rounds = listRounds(schedule, 4);
    expect(rounds.map((r) => r.localDate)).toEqual([
      "2026-03-03", // Tuesday
      "2026-03-06", // Friday
      "2026-03-10", // Tuesday
      "2026-03-13", // Friday
    ]);

    expect(rounds[0].endsAt).toBe(rounds[1].opensAt);
    expect(rounds[1].endsAt).toBe(rounds[2].opensAt);
    expect(rounds[2].endsAt).toBe(rounds[3].opensAt);
  });

  it("generates rounds across 29 February on a leap year", () => {
    // 2024 is a leap year; 2024-02-27 is Tuesday (2), 2024-02-29 is Thursday (4)
    const leapSchedule: Schedule = {
      weekdays: [2, 4],
      timeOfDay: "10:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2024-02-26",
    };
    const rounds = listRounds(leapSchedule, 3);
    expect(rounds[0].localDate).toBe("2024-02-27");
    expect(rounds[1].localDate).toBe("2024-02-29"); // leap day
    expect(rounds[2].localDate).toBe("2024-03-05");
  });

  it("generates rounds across a year boundary", () => {
    // 2026-12-28 is Monday (1), 2026-12-29 is Tuesday (2), 2027-01-01 is Friday (5)
    const yearEndSchedule: Schedule = {
      weekdays: [2, 5],
      timeOfDay: "10:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-12-28",
    };
    const rounds = listRounds(yearEndSchedule, 3);
    expect(rounds[0].localDate).toBe("2026-12-29");
    expect(rounds[1].localDate).toBe("2027-01-01"); // across year boundary
    expect(rounds[2].localDate).toBe("2027-01-05");
  });
});

describe("which round is open at a given moment (requirement 2)", () => {
  const schedule: Schedule = {
    weekdays: [1, 4], // Monday, Thursday
    timeOfDay: "14:00",
    timeZone: "Europe/Helsinki",
    enrolmentDate: "2026-03-02",
  };
  // Round 1 opens at 2026-03-02T12:00:00.000Z, ends at 2026-03-05T12:00:00.000Z

  it("returns none before round 1 opens (one millisecond before)", () => {
    const oneMsBefore = new Date("2026-03-02T11:59:59.999Z");
    expect(getOpenRound(schedule, oneMsBefore)).toBeNull();
  });

  it("returns round 1 exactly at its opening instant", () => {
    const exactlyAtOpen = new Date("2026-03-02T12:00:00.000Z");
    const openRound = getOpenRound(schedule, exactlyAtOpen);
    expect(openRound).not.toBeNull();
    expect(openRound?.number).toBe(1);
  });

  it("returns round 1 one millisecond before round 2 opens", () => {
    const oneMsBeforeRound2 = new Date("2026-03-05T11:59:59.999Z");
    const openRound = getOpenRound(schedule, oneMsBeforeRound2);
    expect(openRound?.number).toBe(1);
  });

  it("returns round 2 exactly at round 2 opening instant", () => {
    const round2Open = new Date("2026-03-05T12:00:00.000Z");
    const openRound = getOpenRound(schedule, round2Open);
    expect(openRound?.number).toBe(2);
  });
});

describe("ruling j: round 1 when enrolment is on or before a chosen weekday", () => {
  it("ruling j: when the enrolment date is one of the chosen weekdays, round 1 is that day's round at the chosen time, also when the person is enrolled later that day than the chosen time; it is then open at once", () => {
    // Enrolment on Monday 2026-03-02; chosen weekdays are Monday (1) and Thursday (4) at 10:00 local time
    const schedule: Schedule = {
      weekdays: [1, 4],
      timeOfDay: "10:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-02",
    };

    const rounds = listRounds(schedule, 2);
    expect(rounds[0].number).toBe(1);
    expect(rounds[0].localDate).toBe("2026-03-02");
    expect(rounds[0].opensAt).toBe("2026-03-02T08:00:00.000Z"); // 10:00 EET is 08:00 UTC

    // When enrolled later that day than the chosen time (e.g. 14:00 EET / 12:00 UTC)
    // Round 1 is already open and remains open until Thursday 10:00 EET
    const laterThatDay = "2026-03-02T12:00:00.000Z";
    const openRound = getOpenRound(schedule, laterThatDay);
    expect(openRound).not.toBeNull();
    expect(openRound?.number).toBe(1);
    expect(openRound?.localDate).toBe("2026-03-02");
  });

  it("ruling j: when the enrolment date is the day before a chosen weekday, round 1 opens on that chosen weekday", () => {
    // Enrolment on Sunday 2026-03-01; chosen weekdays are Monday (1) and Thursday (4) at 10:00 local time
    const schedule: Schedule = {
      weekdays: [1, 4],
      timeOfDay: "10:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    };

    const rounds = listRounds(schedule, 1);
    expect(rounds[0].number).toBe(1);
    expect(rounds[0].localDate).toBe("2026-03-02"); // Monday
    expect(rounds[0].opensAt).toBe("2026-03-02T08:00:00.000Z");

    // Before Monday 10:00 local, no round is open
    expect(getOpenRound(schedule, "2026-03-01T15:00:00.000Z")).toBeNull();
    expect(getOpenRound(schedule, "2026-03-02T07:59:59.999Z")).toBeNull();

    // Exactly at Monday 10:00 local (08:00 UTC), round 1 opens
    const openRound = getOpenRound(schedule, "2026-03-02T08:00:00.000Z");
    expect(openRound).not.toBeNull();
    expect(openRound?.number).toBe(1);
  });
});

describe("ruling e: an answer belongs to the round that is open at the moment it arrives", () => {
  const schedule: Schedule = {
    weekdays: [1, 4],
    timeOfDay: "14:00",
    timeZone: "Europe/Helsinki",
    enrolmentDate: "2026-03-02",
  };
  // Round 1 opens Monday 2026-03-02T12:00:00Z and ends Thursday 2026-03-05T12:00:00Z

  it("a late answer arriving after the scheduled day but before the next round opens counts for that round", () => {
    // Arriving Wednesday 2026-03-04 at 18:00 local (16:00 UTC)
    const lateArrival = "2026-03-04T16:00:00.000Z";
    const round = getRoundForSubmission(schedule, lateArrival);
    expect(round).not.toBeNull();
    expect(round?.number).toBe(1);
    expect(round?.localDate).toBe("2026-03-02");
  });
});

describe("Daylight saving time in Europe/Helsinki across March and October transitions", () => {
  it("a round window that spans the March clock change is 71 hours in UTC", () => {
    // Clocks go forward on Sunday 2026-03-29: 03:00 EET -> 04:00 EEST
    const schedule: Schedule = {
      weekdays: [5, 1], // Friday and Monday
      timeOfDay: "18:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-27",
    };

    const rounds = listRounds(schedule, 2);
    expect(rounds).toHaveLength(2);

    // Round 1 opens Friday 18:00 EET (16:00 UTC)
    expect(rounds[0].opensAt).toBe("2026-03-27T16:00:00.000Z");
    // Round 1 ends Monday 18:00 EEST (15:00 UTC)
    expect(rounds[0].endsAt).toBe("2026-03-30T15:00:00.000Z");

    const durationMs = new Date(rounds[0].endsAt).getTime() - new Date(rounds[0].opensAt).getTime();
    expect(durationMs).toBe(71 * 3600 * 1000); // exactly 71 hours

    // Open round throughout the window
    expect(getOpenRound(schedule, "2026-03-28T12:00:00.000Z")?.number).toBe(1);
    expect(getOpenRound(schedule, "2026-03-29T12:00:00.000Z")?.number).toBe(1);
    expect(getOpenRound(schedule, "2026-03-30T14:59:59.999Z")?.number).toBe(1);
    expect(getOpenRound(schedule, "2026-03-30T15:00:00.000Z")?.number).toBe(2);
  });

  it("a round window that spans the October clock change is 73 hours in UTC", () => {
    // Clocks go back on Sunday 2026-10-25: 04:00 EEST -> 03:00 EET
    const schedule: Schedule = {
      weekdays: [5, 1], // Friday and Monday
      timeOfDay: "18:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-10-23",
    };

    const rounds = listRounds(schedule, 2);
    expect(rounds).toHaveLength(2);

    // Round 1 opens Friday 18:00 EEST (15:00 UTC)
    expect(rounds[0].opensAt).toBe("2026-10-23T15:00:00.000Z");
    // Round 1 ends Monday 18:00 EET (16:00 UTC)
    expect(rounds[0].endsAt).toBe("2026-10-26T16:00:00.000Z");

    const durationMs = new Date(rounds[0].endsAt).getTime() - new Date(rounds[0].opensAt).getTime();
    expect(durationMs).toBe(73 * 3600 * 1000); // exactly 73 hours

    expect(getOpenRound(schedule, "2026-10-24T12:00:00.000Z")?.number).toBe(1);
    expect(getOpenRound(schedule, "2026-10-25T12:00:00.000Z")?.number).toBe(1);
    expect(getOpenRound(schedule, "2026-10-26T15:59:59.999Z")?.number).toBe(1);
    expect(getOpenRound(schedule, "2026-10-26T16:00:00.000Z")?.number).toBe(2);
  });

  it("a round that ends at local midnight across the March clock change", () => {
    const schedule: Schedule = {
      weekdays: [4, 7], // Thursday and Sunday
      timeOfDay: "00:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-26",
    };

    const rounds = listRounds(schedule, 2);
    // Round 1 opens Thursday 2026-03-26 at 00:00 EET (2026-03-25T22:00:00.000Z)
    expect(rounds[0].opensAt).toBe("2026-03-25T22:00:00.000Z");
    // Round 1 ends Sunday 2026-03-29 at 00:00 local midnight EET (2026-03-28T22:00:00.000Z)
    expect(rounds[0].endsAt).toBe("2026-03-28T22:00:00.000Z");

    // Round 2 opens at that local midnight and ends Thursday 2026-04-02 at 00:00 EEST (2026-04-01T21:00:00.000Z)
    expect(rounds[1].opensAt).toBe("2026-03-28T22:00:00.000Z");
    expect(rounds[1].endsAt).toBe("2026-04-01T21:00:00.000Z");

    // 1 ms before midnight belongs to round 1; at midnight belongs to round 2
    expect(getOpenRound(schedule, "2026-03-28T21:59:59.999Z")?.number).toBe(1);
    expect(getOpenRound(schedule, "2026-03-28T22:00:00.000Z")?.number).toBe(2);
  });

  it("a round that ends at local midnight across the October clock change", () => {
    const schedule: Schedule = {
      weekdays: [4, 7], // Thursday and Sunday
      timeOfDay: "00:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-10-22",
    };

    const rounds = listRounds(schedule, 2);
    // Round 1 opens Thursday 2026-10-22 at 00:00 EEST (2026-10-21T21:00:00.000Z)
    expect(rounds[0].opensAt).toBe("2026-10-21T21:00:00.000Z");
    // Round 1 ends Sunday 2026-10-25 at 00:00 local midnight EEST (2026-10-24T21:00:00.000Z)
    expect(rounds[0].endsAt).toBe("2026-10-24T21:00:00.000Z");

    // Round 2 opens at that midnight and ends Thursday 2026-10-29 at 00:00 EET (2026-10-28T22:00:00.000Z)
    expect(rounds[1].opensAt).toBe("2026-10-24T21:00:00.000Z");
    expect(rounds[1].endsAt).toBe("2026-10-28T22:00:00.000Z");

    expect(getOpenRound(schedule, "2026-10-24T20:59:59.999Z")?.number).toBe(1);
    expect(getOpenRound(schedule, "2026-10-24T21:00:00.000Z")?.number).toBe(2);
  });

  it("an answer given in the repeated hour or skipped hour window", () => {
    // October fall back: 03:00 to 04:00 occurs twice on 2026-10-25
    // First occurrence: 00:00Z to 01:00Z (UTC+3, EEST)
    // Second occurrence: 01:00Z to 02:00Z (UTC+2, EET)
    const octSchedule: Schedule = {
      weekdays: [5, 1], // opens Friday 18:00 EEST (15:00 UTC), ends Monday 18:00 EET (16:00 UTC)
      timeOfDay: "18:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-10-23",
    };

    // Both occurrences are within round 1 and attribute to round 1
    const firstOcc = getRoundForSubmission(octSchedule, "2026-10-25T00:30:00.000Z");
    expect(firstOcc?.number).toBe(1);
    expect(firstOcc?.localDate).toBe("2026-10-23");

    const secondOcc = getRoundForSubmission(octSchedule, "2026-10-25T01:30:00.000Z");
    expect(secondOcc?.number).toBe(1);
    expect(secondOcc?.localDate).toBe("2026-10-23");

    // March spring forward: 03:00 to 04:00 is skipped on 2026-03-29
    // 01:00 UTC jumps directly to 04:00 local EEST
    const marSchedule: Schedule = {
      weekdays: [5, 1],
      timeOfDay: "18:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-27",
    };

    const answerAfterSkippedHour = getRoundForSubmission(marSchedule, "2026-03-29T01:30:00.000Z");
    expect(answerAfterSkippedHour?.number).toBe(1);
    expect(answerAfterSkippedHour?.localDate).toBe("2026-03-27");
  });
});
