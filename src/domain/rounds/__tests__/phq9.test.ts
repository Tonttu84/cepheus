import { describe, expect, it } from "vitest";
import { isPhq9Due, isScheduledPhq9Round } from "../phq9";
import { applySubmission, finalizeRound } from "../submissions";
import type { RoundOutcome, Submission } from "../types";

describe("ruling a: round 1 is a PHQ-9 round, and after that every fourth round", () => {
  it("marks round 1, 5, 9 and every fourth round as scheduled PHQ-9 rounds", () => {
    expect(isScheduledPhq9Round(1)).toBe(true);
    expect(isScheduledPhq9Round(5)).toBe(true);
    expect(isScheduledPhq9Round(9)).toBe(true);
    expect(isScheduledPhq9Round(13)).toBe(true);

    expect(isScheduledPhq9Round(2)).toBe(false);
    expect(isScheduledPhq9Round(3)).toBe(false);
    expect(isScheduledPhq9Round(4)).toBe(false);
    expect(isScheduledPhq9Round(6)).toBe(false);
    expect(isScheduledPhq9Round(7)).toBe(false);
    expect(isScheduledPhq9Round(8)).toBe(false);
  });

  it("the scheduled cadence never shifts even with custom round intervals", () => {
    // With custom cadence (e.g. interval 3)
    const customConfig = {
      reminderHour: 9,
      reminderMinute: 0,
      phq9IntervalRounds: 3,
      initialPhq9RoundNumber: 1,
    };
    expect(isScheduledPhq9Round(1, customConfig)).toBe(true);
    expect(isScheduledPhq9Round(4, customConfig)).toBe(true);
    expect(isScheduledPhq9Round(7, customConfig)).toBe(true);
  });
});

describe("ruling b: a PHQ-9 that was due and was not completed is due again in the next round", () => {
  it("the PHQ-9 is due in round 1 with empty history", () => {
    expect(isPhq9Due(1, [])).toBe(true);
  });

  it("the PHQ-9 is not due in round 2 when round 1 PHQ-9 was completed", () => {
    const history: RoundOutcome[] = [
      { roundNumber: 1, status: "answered", phq9Completed: true },
    ];
    expect(isPhq9Due(2, history)).toBe(false);
  });

  it("carried over once: PHQ-9 not completed in round 1 is due again in round 2", () => {
    const skippedHistory: RoundOutcome[] = [
      { roundNumber: 1, status: "not_today" },
    ];
    expect(isPhq9Due(2, skippedHistory)).toBe(true);

    const missedHistory: RoundOutcome[] = [
      { roundNumber: 1, status: "missed" },
    ];
    expect(isPhq9Due(2, missedHistory)).toBe(true);

    const unfinishedHistory: RoundOutcome[] = [
      { roundNumber: 1, status: "answered", phq9Completed: false },
    ];
    expect(isPhq9Due(2, unfinishedHistory)).toBe(true);
  });

  it("stops carrying over once completed in round 2", () => {
    const history: RoundOutcome[] = [
      { roundNumber: 1, status: "not_today" },
      { roundNumber: 2, status: "answered", phq9Completed: true },
    ];
    expect(isPhq9Due(3, history)).toBe(false);
    expect(isPhq9Due(4, history)).toBe(false);
  });

  it("carried over three times: PHQ-9 unfinished through rounds 1, 2, and 3 is due in round 4", () => {
    const history: RoundOutcome[] = [
      { roundNumber: 1, status: "missed" },
      { roundNumber: 2, status: "not_today" },
      { roundNumber: 3, status: "answered", phq9Completed: false },
    ];
    // Carried over: 1 -> 2 (once), 2 -> 3 (twice), 3 -> 4 (three times)
    expect(isPhq9Due(4, history)).toBe(true);
  });

  it("carried over onto round 5: if carried over onto a scheduled PHQ-9 round, one PHQ-9 is due, not two", () => {
    const history: RoundOutcome[] = [
      { roundNumber: 1, status: "missed" },
      { roundNumber: 2, status: "missed" },
      { roundNumber: 3, status: "missed" },
      { roundNumber: 4, status: "missed" },
    ];
    // In round 5, both the schedule and carry-over apply, exactly one PHQ-9 is due
    expect(isPhq9Due(5, history)).toBe(true);

    // If completed in round 5, it clears the obligation for round 6
    const completedInRound5: RoundOutcome[] = [
      ...history,
      { roundNumber: 5, status: "answered", phq9Completed: true },
    ];
    expect(isPhq9Due(6, completedInRound5)).toBe(false);
  });

  it("ruling c: on a PHQ-9 round the two taps come first, 'Not today' skips both and carries PHQ-9 over", () => {
    // Confirm round 1 is a scheduled PHQ-9 round where PHQ-9 is due
    expect(isScheduledPhq9Round(1)).toBe(true);
    expect(isPhq9Due(1, [])).toBe(true);

    // Patient sends a "Not today" submission on this round through domain functions
    const notTodaySubmission: Submission = { kind: "not_today" };
    const application = applySubmission(undefined, notTodaySubmission);

    // The round ends as not_today
    const finalStatus = finalizeRound(application.submission);
    expect(finalStatus).toBe("not_today");

    // No taps and no PHQ-9 are recorded for it
    expect(application.submission.kind).toBe("not_today");
    expect((application.submission as { mood?: number }).mood).toBeUndefined();
    expect((application.submission as { interest?: number }).interest).toBeUndefined();
    expect((application.submission as { answers?: unknown }).answers).toBeUndefined();
    expect((application.submission as { phq9Completed?: boolean }).phq9Completed).toBeUndefined();

    // Round outcome recorded from domain functions
    const round1Outcome: RoundOutcome = {
      roundNumber: 1,
      status: finalStatus,
      phq9Completed:
        application.submission.kind === "answer"
          ? application.submission.phq9Completed
          : undefined,
    };
    expect(round1Outcome.status).toBe("not_today");
    expect(round1Outcome.phq9Completed).toBeUndefined();

    // PHQ-9 is due in the next round
    expect(isPhq9Due(2, [round1Outcome])).toBe(true);
  });
});
