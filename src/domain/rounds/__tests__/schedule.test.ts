import { describe, expect, it } from "vitest";
import { validateSchedule } from "../schedule";

describe("ruling g: invalid schedules are refused with an error", () => {
  it("refuses the same weekday twice", () => {
    const result = validateSchedule({
      weekdays: [1, 1],
      timeOfDay: "09:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("same weekday twice");
    }
  });

  it("refuses a weekday out of range when below 1", () => {
    const result = validateSchedule({
      weekdays: [0, 4],
      timeOfDay: "09:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("weekday out of range");
    }
  });

  it("refuses a weekday out of range when above 7", () => {
    const result = validateSchedule({
      weekdays: [1, 8],
      timeOfDay: "09:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("weekday out of range");
    }
  });

  it("refuses a weekday out of range when non-integer", () => {
    const result = validateSchedule({
      weekdays: [1.5, 4],
      timeOfDay: "09:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("weekday out of range");
    }
  });

  it("refuses a malformed time when hours or minutes exceed clock limits", () => {
    const invalidHours = validateSchedule({
      weekdays: [1, 4],
      timeOfDay: "24:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    });
    expect(invalidHours.ok).toBe(false);
    if (!invalidHours.ok) {
      expect(invalidHours.error.toLowerCase()).toContain("malformed time");
    }

    const invalidMinutes = validateSchedule({
      weekdays: [1, 4],
      timeOfDay: "12:60",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    });
    expect(invalidMinutes.ok).toBe(false);
    if (!invalidMinutes.ok) {
      expect(invalidMinutes.error.toLowerCase()).toContain("malformed time");
    }
  });

  it("refuses a malformed time when format is invalid", () => {
    const result = validateSchedule({
      weekdays: [1, 4],
      timeOfDay: "9:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("malformed time");
    }
  });

  it("refuses an unknown time zone", () => {
    const result = validateSchedule({
      weekdays: [1, 4],
      timeOfDay: "09:00",
      timeZone: "Invalid/Not_A_Timezone",
      enrolmentDate: "2026-03-01",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("unknown time zone");
    }
  });

  it("refuses a malformed date when format is not YYYY-MM-DD", () => {
    const result = validateSchedule({
      weekdays: [1, 4],
      timeOfDay: "09:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "not-a-date",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("malformed date");
    }
  });

  it("refuses an ISO instant for the enrolment date with a clear error", () => {
    const result = validateSchedule({
      weekdays: [1, 4],
      timeOfDay: "09:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01T08:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Malformed date: expected valid YYYY-MM-DD");
    }
  });

  it("refuses a malformed date when calendar day does not exist (e.g. 2026-02-29 non-leap year)", () => {
    const result = validateSchedule({
      weekdays: [1, 4],
      timeOfDay: "09:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-02-29",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("malformed date");
    }
  });

  it("refuses when weekdays does not contain exactly two weekdays", () => {
    const single = validateSchedule({
      weekdays: [1],
      timeOfDay: "09:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    });
    expect(single.ok).toBe(false);

    const triple = validateSchedule({
      weekdays: [1, 3, 5],
      timeOfDay: "09:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    });
    expect(triple.ok).toBe(false);
  });

  it("accepts a valid schedule with two weekdays, time HH:MM, time zone, and date", () => {
    const result = validateSchedule({
      weekdays: [1, 4],
      timeOfDay: "14:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-03-01",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.weekdays).toEqual([1, 4]);
      expect(result.value.timeOfDay).toBe("14:00");
      expect(result.value.timeZone).toBe("Europe/Helsinki");
      expect(result.value.enrolmentDate).toBe("2026-03-01");
    }
  });
});
