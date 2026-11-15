import { createHash } from "node:crypto";
import { decideAccess, type StaffActor, type TargetData } from "@/domain/access";
import type { ConsentState } from "@/domain/consent";
import type { FlagArea } from "@/domain/flags";
import { evaluateHistory, type HistoryRound } from "@/domain/history";
import type { ExpressivityRangeResult } from "@/domain/camera";
import { closeElapsedRounds, getExpressivityShowcase } from "@/usecases";
import type { Ports, StoredWarning } from "@/usecases/ports";
import type { RouteDeps } from "./deps";
import { runRuleIfNeeded } from "./rule";
import { isExpressivityShowcaseEnabled } from "./settings";

export type FlagWarningKind =
  | "low_answers"
  | "silence"
  | "mixed"
  | "phq9"
  | "gad7"
  | "sustained_dip";

export interface ClinicFlagFacts {
  readonly warningKind?: FlagWarningKind;
  readonly latestTotal?: number;
  readonly previousTotal?: number | null;
  readonly change?: number | null;
  readonly isFirstMeasurement?: boolean;
  readonly roundsUnderBaseline?: number;
  readonly missedRoundsCount?: number;
  readonly missedSince?: string;
  readonly hasOpenCrisisEvent?: boolean;
  readonly supportingLines?: readonly string[];
  readonly expressivityShowcase?: ExpressivityRangeResult | null;
  readonly isSimulated?: boolean;
}

/** What the clinic sees of a flag: who, the broad area, when, the warning kind and its facts. */
export interface ClinicFlagView {
  readonly patientId: string;
  readonly area: FlagArea;
  readonly since: string;
  readonly raisedAt: string;
  readonly warningKind?: FlagWarningKind;
  readonly facts?: ClinicFlagFacts;
  readonly supportingLines?: readonly string[];
  readonly isSimulated?: boolean;
}

const PURPOSE = "care";

function shortHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 8);
}

function logPatientFailure(step: string, patientId: string, error: unknown): void {
  const message = error instanceof Error ? error.message.slice(0, 120) : String(error).slice(0, 120);
  console.error(`[api] Clinic update failed during ${step}:`, {
    patientHash: shortHash(patientId),
    error: message,
  });
}

async function updateOnePatient(patientId: string, ports: Ports): Promise<void> {
  try {
    const closed = await closeElapsedRounds({ kind: "system" }, { patientId }, ports);
    if (!closed.ok) {
      if (closed.error !== "consent_required") {
        logPatientFailure("closeElapsedRounds", patientId, closed.error);
      }
      return;
    }
    await runRuleIfNeeded(patientId, true, ports);
  } catch (error) {
    logPatientFailure("updateOnePatient", patientId, error);
  }
}

export type ClinicFlagsDeps = Pick<RouteDeps, "ports" | "clinicPatientIds"> & {
  readonly resolveDevicePatient?: RouteDeps["resolveDevicePatient"];
};

/**
 * Brings every patient of one clinic up to date: closes elapsed rounds and
 * runs the warning rule for each patient. Catches per patient on storage
 * failure and carries on so one patient cannot hide others' flags.
 */
export async function bringClinicUpToDate(clinicId: string, deps: ClinicFlagsDeps): Promise<void> {
  const patientIds = await deps.clinicPatientIds(clinicId);
  for (const patientId of patientIds) {
    await updateOnePatient(patientId, deps.ports);
  }
}

async function computeRawFlagFacts(
  warning: StoredWarning,
  patientId: string,
  ports: Ports,
  consent: ConsentState
): Promise<ClinicFlagFacts> {
  const kind = warning.kind as FlagWarningKind | undefined;
  if (!kind) {
    return {};
  }

  // Crisis events
  const crisisEvents = await ports.crisis.getCrisisEvents(patientId);
  const hasOpenCrisisEvent = crisisEvents.some((e) => !e.acknowledgedAt);

  // Supporting home monitoring lines
  let supportingLines: readonly string[] = [];
  if (ports.homeMonitoring) {
    const monitoring = await ports.homeMonitoring.getSupportingFacts(
      {
        patientId,
        sinceDate: warning.since,
        isSilenceOrMissed: kind === "silence" || kind === "mixed",
      },
      consent
    );
    supportingLines = monitoring.supportingLines;
  }

  if (kind === "phq9") {
    const phq9s = await ports.phq9.getPhq9s(patientId);
    const completed = phq9s
      .filter((p) => p.progress === "completed" && typeof p.total === "number")
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

    const causeDate = warning.causedBy?.date;
    const currentIdx = causeDate
      ? completed.findIndex((p) => p.date === causeDate)
      : completed.length - 1;
    const current = currentIdx >= 0 ? completed[currentIdx] : completed[completed.length - 1];

    if (!current || typeof current.total !== "number") {
      return {
        warningKind: kind,
        hasOpenCrisisEvent,
        supportingLines,
      };
    }

    const latestTotal = current.total;
    const isFirstMeasurement = currentIdx <= 0;
    const previousTotal = isFirstMeasurement ? null : completed[currentIdx - 1]?.total ?? null;
    const change = previousTotal !== null ? latestTotal - previousTotal : null;

    return {
      warningKind: kind,
      latestTotal,
      previousTotal,
      change,
      isFirstMeasurement,
      hasOpenCrisisEvent,
      supportingLines,
    };
  }

  if (kind === "gad7") {
    const gad7s = ports.gad7 ? await ports.gad7.getGad7s(patientId) : [];
    const completed = gad7s
      .filter((g) => typeof g.total === "number")
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

    const causeDate = warning.causedBy?.date;
    const currentIdx = causeDate
      ? completed.findIndex((g) => g.date === causeDate)
      : completed.length - 1;
    const current = currentIdx >= 0 ? completed[currentIdx] : completed[completed.length - 1];

    if (!current || typeof current.total !== "number") {
      return {
        warningKind: kind,
        hasOpenCrisisEvent,
        supportingLines,
      };
    }

    const latestTotal = current.total;
    const isFirstMeasurement = currentIdx <= 0;
    const previousTotal = isFirstMeasurement ? null : completed[currentIdx - 1]?.total ?? null;
    const change = previousTotal !== null ? latestTotal - previousTotal : null;

    return {
      warningKind: kind,
      latestTotal,
      previousTotal,
      change,
      isFirstMeasurement,
      hasOpenCrisisEvent,
      supportingLines,
    };
  }

  if (kind === "low_answers" || kind === "sustained_dip") {
    const storedRounds = await ports.rounds.getRounds(patientId);
    const roundsHistory: HistoryRound[] = storedRounds
      .filter((r) => r.status === "answered" || r.status === "not_today" || r.status === "missed")
      .map((r) => ({
        roundNumber: r.roundNumber,
        localDate: r.localDate,
        status: r.status!,
        ...(r.status === "answered" && typeof r.mood === "number" ? { mood: r.mood } : {}),
        ...(r.status === "answered" && typeof r.interest === "number" ? { interest: r.interest } : {}),
      }));

    let roundsUnderBaseline: number | undefined;
    if (roundsHistory.length > 0) {
      const evalResult = evaluateHistory({ rounds: roundsHistory });
      if (evalResult.ok) {
        const lowRounds = evalResult.value.rounds.filter(
          (r) => r.kind === "low" && r.localDate >= warning.since
        );
        if (lowRounds.length > 0) {
          roundsUnderBaseline = lowRounds.length;
        }
      }
    }

    return {
      warningKind: kind,
      roundsUnderBaseline,
      hasOpenCrisisEvent,
      supportingLines,
    };
  }

  if (kind === "silence") {
    const storedRounds = await ports.rounds.getRounds(patientId);
    const missed = storedRounds.filter(
      (r) => r.localDate >= warning.since && (r.status === "missed" || r.status === "not_today")
    );
    const missedRoundsCount = missed.length > 0 ? missed.length : undefined;

    return {
      warningKind: kind,
      missedRoundsCount,
      missedSince: warning.since,
      hasOpenCrisisEvent,
      supportingLines,
    };
  }

  if (kind === "mixed") {
    const storedRounds = await ports.rounds.getRounds(patientId);
    const roundsHistory: HistoryRound[] = storedRounds
      .filter((r) => r.status === "answered" || r.status === "not_today" || r.status === "missed")
      .map((r) => ({
        roundNumber: r.roundNumber,
        localDate: r.localDate,
        status: r.status!,
        ...(r.status === "answered" && typeof r.mood === "number" ? { mood: r.mood } : {}),
        ...(r.status === "answered" && typeof r.interest === "number" ? { interest: r.interest } : {}),
      }));

    let roundsUnderBaseline: number | undefined;
    if (roundsHistory.length > 0) {
      const evalResult = evaluateHistory({ rounds: roundsHistory });
      if (evalResult.ok) {
        const lowRounds = evalResult.value.rounds.filter(
          (r) => r.kind === "low" && r.localDate >= warning.since
        );
        if (lowRounds.length > 0) {
          roundsUnderBaseline = lowRounds.length;
        }
      }
    }

    const missed = storedRounds.filter(
      (r) => r.localDate >= warning.since && (r.status === "missed" || r.status === "not_today")
    );
    const missedRoundsCount = missed.length > 0 ? missed.length : undefined;

    return {
      warningKind: kind,
      roundsUnderBaseline,
      missedRoundsCount,
      missedSince: warning.since,
      hasOpenCrisisEvent,
      supportingLines,
    };
  }

  return {
    warningKind: kind,
    hasOpenCrisisEvent,
    supportingLines,
  };
}

async function computeFlagFacts(
  warning: StoredWarning,
  patientId: string,
  ports: Ports,
  consent: ConsentState,
  actor?: StaffActor
): Promise<ClinicFlagFacts> {
  const baseFacts = await computeRawFlagFacts(warning, patientId, ports, consent);
  if (!baseFacts.warningKind) return baseFacts;

  let expressivityShowcase: ExpressivityRangeResult | null = null;
  if (actor && isExpressivityShowcaseEnabled()) {
    try {
      const showcaseRes = await getExpressivityShowcase(actor, { patientId }, ports);
      if (showcaseRes.ok) {
        expressivityShowcase = showcaseRes.value;
      }
    } catch {
      // Optional showcase must not fail flag computation
    }
  }

  return {
    ...baseFacts,
    expressivityShowcase,
  };
}

async function flagsOfPatient(actor: StaffActor, patientId: string, ports: Ports): Promise<ClinicFlagView[]> {
  const switches = await ports.patients.getPatientAccessSwitches(patientId);
  if (!switches) return [];
  const target: TargetData = { kind: "flags", patientId: switches.patientId, clinicId: switches.clinicId };
  const access = decideAccess({ actor, action: "read", target, purpose: PURPOSE, consent: switches.consent });
  if (!access.ok) throw new Error(access.error);
  const { allowed, reason, log } = access.value;
  if (log) {
    await ports.accessLog.appendLog({
      actor,
      action: "read",
      target,
      purpose: PURPOSE,
      allowed,
      reason,
      timestamp: ports.clock.now(),
    });
  }
  if (!allowed) return [];
  const warnings = await ports.warnings.getWarnings(switches.patientId);

  const views: ClinicFlagView[] = [];
  for (const w of warnings) {
    const facts = await computeFlagFacts(w, switches.patientId, ports, switches.consent, actor);
    views.push({
      patientId: w.patientId,
      area: "check_in",
      since: w.since,
      raisedAt: w.raisedAt,
      warningKind: facts.warningKind,
      facts,
      supportingLines: facts.supportingLines,
    });
  }
  return views;
}

/**
 * The flags of every patient of the nurse's own clinic, each read through
 * the access rules (a patient without consent for care contributes none).
 * Newest first.
 */
export async function listClinicFlags(actor: StaffActor, deps: ClinicFlagsDeps): Promise<ClinicFlagView[]> {
  await bringClinicUpToDate(actor.clinicId, deps);
  const patientIds = await deps.clinicPatientIds(actor.clinicId);
  const flags: ClinicFlagView[] = [];
  for (const patientId of patientIds) {
    try {
      flags.push(...(await flagsOfPatient(actor, patientId, deps.ports)));
    } catch (error) {
      logPatientFailure("flagsOfPatient", patientId, error);
    }
  }
  return flags.sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
}
