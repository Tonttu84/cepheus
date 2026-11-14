import type {
  Phq9ApplicationResult,
  Phq9Progress,
  Phq9Submission,
  Phq9SubmissionContext,
  Result,
  Round,
  RoundStatus,
  Submission,
} from "./types";

export interface SubmissionApplicationResult {
  readonly status: "answered" | "not_today";
  readonly submission: Submission;
  readonly isDuplicate: boolean;
  readonly replacedNotToday: boolean;
  readonly ignored: boolean;
}

/**
 * Checks whether a PHQ-9 submission must be refused.
 * Returns an error message if refused, or null if accepted.
 */
function checkPhq9Refusal(ctx: Phq9SubmissionContext): string | null {
  let isRoundOpen = ctx.isRoundOpen;
  if (isRoundOpen === undefined) {
    if (ctx.round && ctx.moment) {
      const curMs =
        typeof ctx.moment === "string"
          ? new Date(ctx.moment).getTime()
          : ctx.moment.getTime();
      const openMs = new Date(ctx.round.opensAt).getTime();
      const endMs = new Date(ctx.round.endsAt).getTime();
      isRoundOpen = curMs >= openMs && curMs < endMs;
    } else {
      isRoundOpen = true;
    }
  }

  if (!isRoundOpen) {
    return "Cannot submit PHQ-9: round is not open";
  }

  if (!ctx.isDue) {
    return "Cannot submit PHQ-9: PHQ-9 is not due in this round";
  }

  const roundStatus: RoundStatus | null =
    ctx.roundStatus !== undefined
      ? ctx.roundStatus
      : ctx.currentSubmission
      ? ctx.currentSubmission.kind === "answer"
        ? "answered"
        : "not_today"
      : null;

  if (roundStatus === "not_today") {
    return "Cannot submit PHQ-9 after 'Not today'";
  }

  if (roundStatus !== "answered") {
    return "Cannot submit PHQ-9 before taps are answered";
  }

  return null;
}

/**
 * Moves PHQ-9 progress forward according to Requirement 3 and Ruling (b):
 * - Moves progress forward and never backward:
 *   - "not_started" -> "unfinished" or "completed"
 *   - "unfinished" -> "completed"
 *   - "completed" stays "completed"
 * - Duplicate submissions report isDuplicate: true.
 */
function advancePhq9Progress(
  currentProgress: Phq9Progress,
  targetProgress: "unfinished" | "completed"
): Phq9ApplicationResult {
  if (currentProgress === "completed") {
    return {
      progress: "completed",
      isDuplicate: true,
    };
  }

  if (currentProgress === "unfinished") {
    if (targetProgress === "completed") {
      return {
        progress: "completed",
        isDuplicate: false,
      };
    }
    return {
      progress: "unfinished",
      isDuplicate: true,
    };
  }

  // currentProgress is "not_started"
  return {
    progress: targetProgress,
    isDuplicate: false,
  };
}

/**
 * Applies a PHQ-9 submission to update PHQ-9 progress in a round.
 * Requirement 3, Ruling (b) & Review finding 1:
 * - Accepted any time the round is open, the PHQ-9 is due in it, and the taps have been answered.
 * - Refused with a clear error when:
 *   - the round is not open
 *   - the PHQ-9 is not due in that round
 *   - the round is "not_today"
 *   - the taps are not answered yet
 * - Moves progress forward and never backward:
 *   - "not_started" -> "unfinished" or "completed"
 *   - "unfinished" -> "completed"
 *   - "completed" stays "completed"; a later unfinished submission after completion
 *     changes nothing and is reported as a duplicate.
 *   - duplicate submissions (completed twice, or unfinished twice) change nothing and report isDuplicate: true.
 */
export function applyPhq9Submission(
  currentProgressOrContext: Phq9Progress | null | undefined | Phq9SubmissionContext,
  submission: Phq9Submission,
  context?: Phq9SubmissionContext
): Result<Phq9ApplicationResult, string> {
  let currentProgress: Phq9Progress = "not_started";
  let ctx: Phq9SubmissionContext;

  if (
    currentProgressOrContext !== null &&
    typeof currentProgressOrContext === "object"
  ) {
    ctx = currentProgressOrContext;
    currentProgress = ctx.currentProgress ?? "not_started";
  } else {
    currentProgress = currentProgressOrContext ?? "not_started";
    ctx = context ?? { isDue: true };
  }

  const refusalError = checkPhq9Refusal(ctx);
  if (refusalError) {
    return { ok: false, error: refusalError };
  }

  const targetProgress =
    typeof submission === "string" ? submission : submission.progress;
  if (targetProgress !== "unfinished" && targetProgress !== "completed") {
    return {
      ok: false,
      error: "Invalid PHQ-9 progress submission: must be 'unfinished' or 'completed'",
    };
  }

  return {
    ok: true,
    value: advancePhq9Progress(currentProgress, targetProgress),
  };
}

/**
 * Requirement 5 & Ruling (f):
 * A second answer for a round that already has an answer changes nothing and
 * reports that it was a duplicate. An answer in a round that so far has "Not today"
 * replaces it. "Not today" never replaces an answer.
 */
export function applySubmission(
  currentSubmission: Submission | null | undefined,
  newSubmission: Submission
): SubmissionApplicationResult {
  if (!currentSubmission) {
    return {
      status: newSubmission.kind === "answer" ? "answered" : "not_today",
      submission: newSubmission,
      isDuplicate: false,
      replacedNotToday: false,
      ignored: false,
    };
  }

  if (currentSubmission.kind === "not_today") {
    if (newSubmission.kind === "answer") {
      return {
        status: "answered",
        submission: newSubmission,
        isDuplicate: false,
        replacedNotToday: true,
        ignored: false,
      };
    }
    return {
      status: "not_today",
      submission: currentSubmission,
      isDuplicate: true,
      replacedNotToday: false,
      ignored: false,
    };
  }

  // Current submission is "answer"
  if (newSubmission.kind === "answer") {
    return {
      status: "answered",
      submission: currentSubmission,
      isDuplicate: true,
      replacedNotToday: false,
      ignored: false,
    };
  }

  // "Not today" arriving when an answer already exists changes nothing
  return {
    status: "answered",
    submission: currentSubmission,
    isDuplicate: false,
    replacedNotToday: false,
    ignored: true,
  };
}

/**
 * Requirement 5:
 * A round ends when the next one opens. Its final status is answered, not_today
 * or missed. If nothing was submitted by the time the round ends, it is missed.
 * not_today and missed stay distinct.
 */
export function finalizeRound(submission: Submission | null | undefined): RoundStatus {
  if (!submission) {
    return "missed";
  }
  return submission.kind === "answer" ? "answered" : "not_today";
}

/**
 * Determines a round's status at a specific moment in time.
 */
export function getRoundStatusAt(
  round: Round,
  moment: string | Date,
  submission: Submission | null | undefined
): "open" | RoundStatus {
  const currentMs = typeof moment === "string" ? new Date(moment).getTime() : moment.getTime();
  const endsAtMs = new Date(round.endsAt).getTime();

  if (currentMs < endsAtMs) {
    if (submission?.kind === "answer") {
      return "answered";
    }
    if (submission?.kind === "not_today") {
      return "not_today";
    }
    return "open";
  }

  return finalizeRound(submission);
}
