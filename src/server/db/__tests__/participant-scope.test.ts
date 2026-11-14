import { describe, expect, it } from "vitest";
import { StoredDataError } from "../errors";
import { roundColumnsFor, toSchedule } from "../participant-scope";

describe("participant scope helpers", () => {
  const row = {
    enrolmentDate: "2026-11-16",
    scheduleDaysJson: "[1,4]",
    scheduleTime: "18:00",
    timeZone: "Europe/Helsinki",
  };

  it("builds the schedule from the participant columns", () => {
    expect(toSchedule(row)).toEqual({
      weekdays: [1, 4],
      timeOfDay: "18:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-11-16",
    });
  });

  it("gives no schedule when a schedule column is empty", () => {
    expect(toSchedule({ ...row, scheduleDaysJson: null })).toBeNull();
    expect(toSchedule({ ...row, scheduleTime: null })).toBeNull();
    expect(toSchedule({ ...row, enrolmentDate: null })).toBeNull();
  });

  it("refuses stored schedule columns that are not a valid schedule", () => {
    expect(() => toSchedule({ ...row, scheduleDaysJson: "[1,9]" })).toThrow(/schedule/i);
  });

  it("gives the round columns for the enrolment day: day 1, week 1, opening at the chosen local time", () => {
    const schedule = toSchedule(row)!;
    expect(roundColumnsFor(schedule, "2026-11-16")).toEqual({
      scheduledAt: new Date("2026-11-16T16:00:00.000Z"),
      dayIndex: 1,
      weekNumber: 1,
    });
  });

  it("counts days and weeks from the enrolment date, across the change to summer time", () => {
    const schedule = toSchedule(row)!;
    expect(roundColumnsFor(schedule, "2026-11-23")).toMatchObject({ dayIndex: 8, weekNumber: 2 });
    expect(roundColumnsFor(schedule, "2027-03-29")).toEqual({
      scheduledAt: new Date("2027-03-29T15:00:00.000Z"),
      dayIndex: 134,
      weekNumber: 20,
    });
  });
  it("refuses stored weekdays that are not JSON, or not a list of numbers, with a named error", () => {
    for (const scheduleDaysJson of ["[1,", "\"1,4\"", "{\"a\":1}", "[\"1\",\"4\"]"]) {
      expect(() => toSchedule({ ...row, scheduleDaysJson })).toThrow(StoredDataError);
    }
  });

  it("refuses a stored schedule that is not valid with the same named error", () => {
    expect(() => toSchedule({ ...row, scheduleDaysJson: "[1,9]" })).toThrow(StoredDataError);
  });
});
