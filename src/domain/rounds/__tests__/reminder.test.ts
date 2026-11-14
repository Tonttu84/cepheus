import { describe, expect, it } from "vitest";
import { checkReminder, getReminderDueInstant, isReminderDue } from "../reminder";
import { listRounds } from "../rounds";
import type { Round, Schedule } from "../types";

describe("ruling i: when the next round opens before the reminder time, no reminder is sent for that round, because the next round's own prompt reaches the person sooner", () => {
  const timeZone = "Europe/Helsinki";

  it("Monday and Tuesday at 08:00: next round opens before reminder time (not due: the next round opens first)", () => {
    // Schedule on Monday (1) and Tuesday (2) at 08:00 local time
    // Round 1 opens Monday 2026-03-02 at 08:00 (06:00 UTC) and ends Tuesday 2026-03-03 at 08:00 (06:00 UTC)
    // Reminder time would be Tuesday 2026-03-03 at 09:00 (07:00 UTC)
    const schedule: Schedule = {
      weekdays: [1, 2],
      timeOfDay: "08:00",
      timeZone,
      enrolmentDate: "2026-03-01",
    };
    const [round1] = listRounds(schedule, 1);

    // Tested during round (e.g. Monday 12:00 UTC)
    const checkDuring = checkReminder(round1, {
      moment: "2026-03-02T10:00:00.000Z",
      timeZone,
    });
    expect(checkDuring).toEqual({
      due: false,
      reason: "not due: the next round opens first",
    });
    expect(
      isReminderDue(round1, {
        moment: "2026-03-02T10:00:00.000Z",
        timeZone,
      })
    ).toBe(false);

    // Tested at 08:00 when round ends / next round opens
    const checkAtEnd = checkReminder(round1, {
      moment: "2026-03-03T06:00:00.000Z", // 08:00 EET
      timeZone,
    });
    expect(checkAtEnd).toEqual({
      due: false,
      reason: "not due: the next round opens first",
    });
    expect(
      isReminderDue(round1, {
        moment: "2026-03-03T06:00:00.000Z",
        timeZone,
      })
    ).toBe(false);

    // Tested at 09:00 (reminder hour)
    const checkAt0900 = checkReminder(round1, {
      moment: "2026-03-03T07:00:00.000Z", // 09:00 EET
      timeZone,
    });
    expect(checkAt0900).toEqual({
      due: false,
      reason: "not due: the next round opens first",
    });
    expect(
      isReminderDue(round1, {
        moment: "2026-03-03T07:00:00.000Z",
        timeZone,
      })
    ).toBe(false);
  });

  it("Monday and Tuesday at 09:00 exactly: next round opens at the same moment the reminder would be due (not due: the next round opens first)", () => {
    // Schedule on Monday (1) and Tuesday (2) at 09:00 local time
    // Round 1 opens Monday 2026-03-02 at 09:00 (07:00 UTC) and ends Tuesday 2026-03-03 at 09:00 (07:00 UTC)
    // Reminder time is Tuesday 2026-03-03 at 09:00 (07:00 UTC), exactly when round 2 opens
    const schedule: Schedule = {
      weekdays: [1, 2],
      timeOfDay: "09:00",
      timeZone,
      enrolmentDate: "2026-03-01",
    };
    const [round1] = listRounds(schedule, 1);

    const checkDuring = checkReminder(round1, {
      moment: "2026-03-02T10:00:00.000Z",
      timeZone,
    });
    expect(checkDuring).toEqual({
      due: false,
      reason: "not due: the next round opens first",
    });
    expect(
      isReminderDue(round1, {
        moment: "2026-03-02T10:00:00.000Z",
        timeZone,
      })
    ).toBe(false);

    const checkAt0900 = checkReminder(round1, {
      moment: "2026-03-03T07:00:00.000Z", // 09:00 EET
      timeZone,
    });
    expect(checkAt0900).toEqual({
      due: false,
      reason: "not due: the next round opens first",
    });
    expect(
      isReminderDue(round1, {
        moment: "2026-03-03T07:00:00.000Z",
        timeZone,
      })
    ).toBe(false);
  });

  it("Monday and Tuesday at 10:00: reminder is due from 09:00 until the round ends at 10:00", () => {
    // Schedule on Monday (1) and Tuesday (2) at 10:00 local time
    // Round 1 opens Monday 2026-03-02 at 10:00 (08:00 UTC) and ends Tuesday 2026-03-03 at 10:00 (08:00 UTC)
    // Reminder time is Tuesday 2026-03-03 at 09:00 (07:00 UTC)
    // Next round opens at 10:00, which is after reminder time 09:00
    const schedule: Schedule = {
      weekdays: [1, 2],
      timeOfDay: "10:00",
      timeZone,
      enrolmentDate: "2026-03-01",
    };
    const [round1] = listRounds(schedule, 1);

    // Before 09:00 (e.g. 08:59 local / 06:59 UTC): not due yet
    const before0900 = checkReminder(round1, {
      moment: "2026-03-03T06:59:00.000Z",
      timeZone,
    });
    expect(before0900.due).toBe(false);
    expect(
      isReminderDue(round1, {
        moment: "2026-03-03T06:59:00.000Z",
        timeZone,
      })
    ).toBe(false);

    // At 09:00 exactly (07:00 UTC): due!
    const at0900 = checkReminder(round1, {
      moment: "2026-03-03T07:00:00.000Z",
      timeZone,
    });
    expect(at0900).toEqual({ due: true });
    expect(
      isReminderDue(round1, {
        moment: "2026-03-03T07:00:00.000Z",
        timeZone,
      })
    ).toBe(true);

    // At 09:30 (07:30 UTC): still due!
    const at0930 = checkReminder(round1, {
      moment: "2026-03-03T07:30:00.000Z",
      timeZone,
    });
    expect(at0930).toEqual({ due: true });
    expect(
      isReminderDue(round1, {
        moment: "2026-03-03T07:30:00.000Z",
        timeZone,
      })
    ).toBe(true);

    // At 10:00 exactly (08:00 UTC): round ends, next round opens, no longer due
    const at1000 = checkReminder(round1, {
      moment: "2026-03-03T08:00:00.000Z",
      timeZone,
    });
    expect(at1000.due).toBe(false);
    expect(
      isReminderDue(round1, {
        moment: "2026-03-03T08:00:00.000Z",
        timeZone,
      })
    ).toBe(false);
  });
});

describe("ruling d: reminder due logic", () => {
  const round: Round = {
    number: 1,
    localDate: "2026-03-02", // Monday
    opensAt: "2026-03-02T12:00:00.000Z", // 14:00 EET
    endsAt: "2026-03-05T12:00:00.000Z", // Thursday 14:00 EET
  };
  const timeZone = "Europe/Helsinki";

  it("calculates the reminder due instant at 09:00 local time on the day after the round opened", () => {
    // Round opened 2026-03-02, day after is 2026-03-03.
    // In Europe/Helsinki (UTC+2), 09:00 local is 07:00:00 UTC.
    const instant = getReminderDueInstant(round, timeZone);
    expect(instant).toBe("2026-03-03T07:00:00.000Z");
  });

  it("the reminder is not due one minute before 09:00 local time", () => {
    // 08:59 local time is 06:59:00 UTC
    const oneMinuteBefore = "2026-03-03T06:59:00.000Z";
    const due = isReminderDue(round, {
      moment: oneMinuteBefore,
      timeZone,
      hasSubmission: false,
      reminderSent: false,
    });
    expect(due).toBe(false);
  });

  it("the reminder is due exactly at 09:00 local time on the day after round opened", () => {
    // 09:00 local time is 07:00:00 UTC
    const exactlyAt0900 = "2026-03-03T07:00:00.000Z";
    const due = isReminderDue(round, {
      moment: exactlyAt0900,
      timeZone,
      hasSubmission: false,
      reminderSent: false,
    });
    expect(due).toBe(true);
  });

  it("the reminder is not due after it was sent", () => {
    const after0900 = "2026-03-03T08:00:00.000Z";
    const due = isReminderDue(round, {
      moment: after0900,
      timeZone,
      hasSubmission: false,
      reminderSent: true,
    });
    expect(due).toBe(false);
  });

  it("the reminder is not due after a submission has been made", () => {
    const after0900 = "2026-03-03T08:00:00.000Z";
    const due = isReminderDue(round, {
      moment: after0900,
      timeZone,
      hasSubmission: true,
      reminderSent: false,
    });
    expect(due).toBe(false);
  });

  it("the reminder is not due after the round ended", () => {
    // Round ends at 2026-03-05T12:00:00.000Z
    const afterRoundEnded = "2026-03-05T12:00:00.000Z";
    const due = isReminderDue(round, {
      moment: afterRoundEnded,
      timeZone,
      hasSubmission: false,
      reminderSent: false,
    });
    expect(due).toBe(false);
  });

  it("respects a custom reminder hour from the config", () => {
    const customConfig = {
      reminderHour: 10,
      reminderMinute: 0,
      phq9IntervalRounds: 4,
      initialPhq9RoundNumber: 1,
    };
    // At 09:30 local (07:30 UTC), reminder is not due with hour 10
    const at0930 = "2026-03-03T07:30:00.000Z";
    expect(
      isReminderDue(
        round,
        { moment: at0930, timeZone, hasSubmission: false, reminderSent: false },
        customConfig
      )
    ).toBe(false);

    // At 10:00 local (08:00 UTC), reminder is due
    const at1000 = "2026-03-03T08:00:00.000Z";
    expect(
      isReminderDue(
        round,
        { moment: at1000, timeZone, hasSubmission: false, reminderSent: false },
        customConfig
      )
    ).toBe(true);
  });
});

describe("reminder time zone resolution and missing time zone handling", () => {
  const round: Round = {
    number: 1,
    localDate: "2026-03-02",
    opensAt: "2026-03-02T12:00:00.000Z",
    endsAt: "2026-03-05T12:00:00.000Z",
  };

  it("reminder check falls back to the schedule's time zone when options.timeZone is omitted", () => {
    const schedule: Schedule = {
      weekdays: [1, 4],
      timeOfDay: "14:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-02",
    };
    // 09:00 EET on 2026-03-03 is 07:00 UTC
    const at0900 = "2026-03-03T07:00:00.000Z";
    const result = checkReminder(round, {
      moment: at0900,
      schedule,
    });
    expect(result).toEqual({ due: true });
    expect(
      isReminderDue(round, {
        moment: at0900,
        schedule,
      })
    ).toBe(true);
  });

  it("reminder check returns missing time zone when neither timeZone nor schedule is provided", () => {
    const at0900 = "2026-03-03T07:00:00.000Z";
    const result = checkReminder(round, {
      moment: at0900,
    });
    expect(result).toEqual({
      due: false,
      reason: "missing time zone",
    });
    expect(
      isReminderDue(round, {
        moment: at0900,
      })
    ).toBe(false);
  });
});

describe("reminder due time on clock-change days (Europe/Helsinki)", () => {
  const timeZone = "Europe/Helsinki";

  it("spring forward: round opened Saturday 28 March 2026, reminder due Sunday 29 March 2026 at 09:00 local (06:00 UTC)", () => {
    // Hand-worked UTC instants for Europe/Helsinki (clocks went forward that night):
    // Round opens on Saturday 28 March 2026 (EET, UTC+2).
    // On the night between Saturday 28 and Sunday 29 March 2026, clocks spring forward at 03:00 to 04:00 (EET UTC+2 -> EEST UTC+3).
    // The reminder is due at 09:00 local wall clock on Sunday 29 March 2026.
    // In EEST (UTC+3), 09:00 local is 06:00:00 UTC (not 07:00 UTC):
    //   09:00 local - 3 hours offset = 06:00:00 UTC.
    // One minute before 09:00 local (08:59 local) is:
    //   08:59 local - 3 hours offset = 05:59:00 UTC.
    //
    // If a naive calculation added 24 hours to Saturday 09:00 local (07:00 UTC),
    // it would incorrectly produce 07:00 UTC instead of 06:00 UTC.
    const round: Round = {
      number: 1,
      localDate: "2026-03-28", // Saturday
      opensAt: "2026-03-28T10:00:00.000Z", // Saturday 12:00 EET
      endsAt: "2026-03-31T10:00:00.000Z", // Tuesday 13:00 EEST
    };

    expect(getReminderDueInstant(round, timeZone)).toBe("2026-03-29T06:00:00.000Z");

    // Check one minute before (08:59 local = 05:59 UTC): not due
    const oneMinuteBefore = "2026-03-29T05:59:00.000Z";
    expect(isReminderDue(round, { moment: oneMinuteBefore, timeZone })).toBe(false);
    expect(checkReminder(round, { moment: oneMinuteBefore, timeZone })).toEqual({
      due: false,
      reason: "reminder time has not arrived yet",
    });

    // Check exactly at the instant (09:00 local = 06:00 UTC): due
    const exactlyAtInstant = "2026-03-29T06:00:00.000Z";
    expect(isReminderDue(round, { moment: exactlyAtInstant, timeZone })).toBe(true);
    expect(checkReminder(round, { moment: exactlyAtInstant, timeZone })).toEqual({
      due: true,
    });
  });

  it("fall back: round opened Saturday 24 October 2026, reminder due Sunday 25 October 2026 at 09:00 local (07:00 UTC)", () => {
    // Hand-worked UTC instants for Europe/Helsinki (clocks went back that night):
    // Round opens on Saturday 24 October 2026 (EEST, UTC+3).
    // On the night between Saturday 24 and Sunday 25 October 2026, clocks fall back at 04:00 to 03:00 (EEST UTC+3 -> EET UTC+2).
    // The reminder is due at 09:00 local wall clock on Sunday 25 October 2026.
    // In EET (UTC+2), 09:00 local is 07:00:00 UTC (not 06:00 UTC):
    //   09:00 local - 2 hours offset = 07:00:00 UTC.
    // One minute before 09:00 local (08:59 local) is:
    //   08:59 local - 2 hours offset = 06:59:00 UTC.
    //
    // If a naive calculation added 24 hours to Saturday 09:00 local (06:00 UTC),
    // it would incorrectly produce 06:00 UTC instead of 07:00 UTC.
    const round: Round = {
      number: 1,
      localDate: "2026-10-24", // Saturday
      opensAt: "2026-10-24T09:00:00.000Z", // Saturday 12:00 EEST
      endsAt: "2026-10-27T10:00:00.000Z", // Tuesday 12:00 EET
    };

    expect(getReminderDueInstant(round, timeZone)).toBe("2026-10-25T07:00:00.000Z");

    // Check one minute before (08:59 local = 06:59 UTC): not due
    const oneMinuteBefore = "2026-10-25T06:59:00.000Z";
    expect(isReminderDue(round, { moment: oneMinuteBefore, timeZone })).toBe(false);
    expect(checkReminder(round, { moment: oneMinuteBefore, timeZone })).toEqual({
      due: false,
      reason: "reminder time has not arrived yet",
    });

    // Check exactly at the instant (09:00 local = 07:00 UTC): due
    const exactlyAtInstant = "2026-10-25T07:00:00.000Z";
    expect(isReminderDue(round, { moment: exactlyAtInstant, timeZone })).toBe(true);
    expect(checkReminder(round, { moment: exactlyAtInstant, timeZone })).toEqual({
      due: true,
    });
  });
});
