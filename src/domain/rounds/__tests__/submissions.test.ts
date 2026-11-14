import { describe, expect, it } from "vitest";
import { isPhq9Due } from "../phq9";
import {
  applyPhq9Submission,
  applySubmission,
  finalizeRound,
  getRoundStatusAt,
} from "../submissions";
import type { Round, RoundOutcome, Submission } from "../types";

describe("PHQ-9 round progress and submissions", () => {
  it("taps answered then PHQ-9 completed in the same round", () => {
    // Round 1 is open and PHQ-9 is due
    const taps = applySubmission(undefined, { kind: "answer", mood: 3, interest: 4 });
    expect(taps.status).toBe("answered");

    const phq9 = applyPhq9Submission("not_started", "completed", {
      isRoundOpen: true,
      isDue: true,
      roundStatus: taps.status,
    });
    expect(phq9.ok).toBe(true);
    if (phq9.ok) {
      expect(phq9.value.progress).toBe("completed");
      expect(phq9.value.isDuplicate).toBe(false);
    }
  });

  it("taps, PHQ-9 unfinished, return and complete in the same round", () => {
    const taps = applySubmission(undefined, { kind: "answer", mood: 3, interest: 3 });
    expect(taps.status).toBe("answered");

    // Starts PHQ-9, leaves unfinished while round is open
    const initialPhq9 = applyPhq9Submission("not_started", "unfinished", {
      isRoundOpen: true,
      isDue: true,
      roundStatus: taps.status,
    });
    expect(initialPhq9.ok).toBe(true);
    if (initialPhq9.ok) {
      expect(initialPhq9.value.progress).toBe("unfinished");
      expect(initialPhq9.value.isDuplicate).toBe(false);
    }

    // Returns while the round is still open and completes it
    const completedPhq9 = applyPhq9Submission(
      initialPhq9.ok ? initialPhq9.value.progress : "unfinished",
      "completed",
      {
        isRoundOpen: true,
        isDue: true,
        roundStatus: taps.status,
      }
    );
    expect(completedPhq9.ok).toBe(true);
    if (completedPhq9.ok) {
      expect(completedPhq9.value.progress).toBe("completed");
      expect(completedPhq9.value.isDuplicate).toBe(false);
    }
  });

  it("unfinished at the end of the round then due in the next round and completed there", () => {
    // In round 1 (PHQ-9 due), person answers taps but leaves PHQ-9 unfinished
    const round1Taps = applySubmission(undefined, { kind: "answer", mood: 3, interest: 3 });
    const round1Phq9 = applyPhq9Submission("not_started", "unfinished", {
      isRoundOpen: true,
      isDue: true,
      roundStatus: round1Taps.status,
    });
    expect(round1Phq9.ok).toBe(true);

    const round1Outcome: RoundOutcome = {
      roundNumber: 1,
      status: round1Taps.status,
      phq9Progress: round1Phq9.ok ? round1Phq9.value.progress : "unfinished",
    };

    // At round 2, because PHQ-9 was not completed in round 1, it is due again
    expect(isPhq9Due(2, [round1Outcome])).toBe(true);

    // In round 2, taps are answered and PHQ-9 is completed
    const round2Taps = applySubmission(undefined, { kind: "answer", mood: 3, interest: 4 });
    const round2Phq9 = applyPhq9Submission("not_started", "completed", {
      isRoundOpen: true,
      isDue: true,
      roundStatus: round2Taps.status,
    });
    expect(round2Phq9.ok).toBe(true);
    if (round2Phq9.ok) {
      expect(round2Phq9.value.progress).toBe("completed");
    }

    const round2Outcome: RoundOutcome = {
      roundNumber: 2,
      status: round2Taps.status,
      phq9Progress: round2Phq9.ok ? round2Phq9.value.progress : "completed",
    };

    // Round 3: PHQ-9 is no longer due because it was completed in round 2
    expect(isPhq9Due(3, [round1Outcome, round2Outcome])).toBe(false);
  });

  it("PHQ-9 submitted before the taps (refused)", () => {
    // Round is open and PHQ-9 is due, but taps have not been answered yet
    const result = applyPhq9Submission("not_started", "completed", {
      isRoundOpen: true,
      isDue: true,
      roundStatus: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/taps/i);
    }
  });

  it("in a round where it is not due (refused)", () => {
    // Round 2 after completion in round 1: PHQ-9 is not due
    const result = applyPhq9Submission("not_started", "completed", {
      isRoundOpen: true,
      isDue: false,
      roundStatus: "answered",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not due/i);
    }
  });

  it('after "Not today" (refused)', () => {
    // Round received "Not today"
    const notToday = applySubmission(undefined, { kind: "not_today" });
    const result = applyPhq9Submission("not_started", "completed", {
      isRoundOpen: true,
      isDue: true,
      roundStatus: notToday.status,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not today/i);
    }
  });

  it("completed twice (duplicate, nothing changes)", () => {
    // Initial completion
    const first = applyPhq9Submission("not_started", "completed", {
      isRoundOpen: true,
      isDue: true,
      roundStatus: "answered",
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value.progress).toBe("completed");
      expect(first.value.isDuplicate).toBe(false);
    }

    // Submitted "completed" second time: duplicate, nothing changes
    const second = applyPhq9Submission("completed", "completed", {
      isRoundOpen: true,
      isDue: true,
      roundStatus: "answered",
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.progress).toBe("completed");
      expect(second.value.isDuplicate).toBe(true);
    }

    // Submitted "unfinished" after completion: duplicate, stays completed
    const laterUnfinished = applyPhq9Submission("completed", "unfinished", {
      isRoundOpen: true,
      isDue: true,
      roundStatus: "answered",
    });
    expect(laterUnfinished.ok).toBe(true);
    if (laterUnfinished.ok) {
      expect(laterUnfinished.value.progress).toBe("completed");
      expect(laterUnfinished.value.isDuplicate).toBe(true);
    }
  });
});

describe("ruling f & requirement 5: what a submission does to a round", () => {
  const answerA: Submission = {
    kind: "answer",
    mood: 3,
    interest: 4,
  };

  const answerB: Submission = {
    kind: "answer",
    mood: 2,
    interest: 2,
  };

  const notToday: Submission = {
    kind: "not_today",
  };

  it("'Not today' then an answer: answer replaces 'Not today'", () => {
    // Round initially receives "Not today"
    const initial = applySubmission(undefined, notToday);
    expect(initial.status).toBe("not_today");
    expect(initial.submission.kind).toBe("not_today");

    // Later, an answer arrives in the same round
    const updated = applySubmission(initial.submission, answerA);
    expect(updated.status).toBe("answered");
    expect(updated.submission).toEqual(answerA);
    expect(updated.replacedNotToday).toBe(true);
    expect(updated.isDuplicate).toBe(false);
  });

  it("an answer then 'Not today': 'Not today' never replaces an answer", () => {
    // Round initially receives an answer
    const initial = applySubmission(undefined, answerA);
    expect(initial.status).toBe("answered");

    // Later, "Not today" arrives
    const updated = applySubmission(initial.submission, notToday);
    expect(updated.status).toBe("answered");
    expect(updated.submission).toEqual(answerA); // changes nothing
    expect(updated.ignored).toBe(true);
  });

  it("a duplicate answer changes nothing and reports that it was a duplicate", () => {
    const initial = applySubmission(undefined, answerA);
    expect(initial.status).toBe("answered");

    const duplicate = applySubmission(initial.submission, answerB);
    expect(duplicate.status).toBe("answered");
    expect(duplicate.submission).toEqual(answerA); // original answer retained
    expect(duplicate.isDuplicate).toBe(true);
  });
});

describe("requirement 5: how a round ends", () => {
  const round: Round = {
    number: 1,
    localDate: "2026-03-02",
    opensAt: "2026-03-02T12:00:00.000Z",
    endsAt: "2026-03-05T12:00:00.000Z",
  };

  it("a round ends as missed when nothing was submitted by the time the round ends", () => {
    const status = finalizeRound(undefined);
    expect(status).toBe("missed");
  });

  it("a round ends as not_today when skipped with Not today", () => {
    const status = finalizeRound({ kind: "not_today" });
    expect(status).toBe("not_today");
  });

  it("a round ends as answered when answered", () => {
    const status = finalizeRound({ kind: "answer", mood: 3, interest: 3 });
    expect(status).toBe("answered");
  });

  it("not_today and missed stay distinct", () => {
    const missedStatus = finalizeRound(null);
    const notTodayStatus = finalizeRound({ kind: "not_today" });
    expect(missedStatus).not.toBe(notTodayStatus);
    expect(missedStatus).toBe("missed");
    expect(notTodayStatus).toBe("not_today");
  });

  it("evaluates open vs final round status at different moments", () => {
    // While round is open and unsubmitted -> open
    const openMoment = "2026-03-03T10:00:00.000Z";
    expect(getRoundStatusAt(round, openMoment, undefined)).toBe("open");

    // After round ended with no submission -> missed
    const afterEndMoment = "2026-03-05T12:00:00.000Z";
    expect(getRoundStatusAt(round, afterEndMoment, undefined)).toBe("missed");

    // After round ended with Not today -> not_today
    expect(getRoundStatusAt(round, afterEndMoment, { kind: "not_today" })).toBe("not_today");

    // After round ended with answer -> answered
    expect(getRoundStatusAt(round, afterEndMoment, { kind: "answer" })).toBe("answered");
  });
});
