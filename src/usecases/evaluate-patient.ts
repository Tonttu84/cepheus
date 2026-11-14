import { decideAccess, type Actor, type TargetData } from '../domain/access';
import {
  evaluateHistory,
  type EvaluatedEffect,
  type HistoryCall,
  type HistoryPhq9,
  type HistoryRound,
  type PatientHistory,
} from '../domain/history';
import type {
  EvaluatePatientResult,
  PatientRecord,
  Ports,
  StoredRound,
  StoredWarning,
  StoredSmallDip,
  StoredBaselineNotWellNotice,
  UseCaseResult,
} from './ports';

export interface EvaluatePatientInput {
  readonly patientId: string;
}

function buildRoundsHistory(stored: readonly StoredRound[]): HistoryRound[] {
  return stored
    .filter((r) => r.status === 'answered' || r.status === 'not_today' || r.status === 'missed')
    .map((r) => ({
      roundNumber: r.roundNumber,
      localDate: r.localDate,
      status: r.status!,
      ...(r.status === 'answered' && typeof r.mood === 'number' ? { mood: r.mood } : {}),
      ...(r.status === 'answered' && typeof r.interest === 'number' ? { interest: r.interest } : {}),
    }));
}

function isEffectStored(
  effect: EvaluatedEffect,
  warnings: readonly StoredWarning[],
  smallDips: readonly StoredSmallDip[],
  notices: readonly StoredBaselineNotWellNotice[]
): boolean {
  const isSameCause = (
    c1: EvaluatedEffect['causedBy'],
    c2: EvaluatedEffect['causedBy']
  ) => {
    if (c1.type !== c2.type) return false;
    if (c1.type === 'round' && c2.type === 'round') {
      return c1.roundNumber === c2.roundNumber && c1.date === c2.date;
    }
    if (c1.type === 'phq9' && c2.type === 'phq9') {
      return c1.date === c2.date;
    }
    return false;
  };

  if (effect.type === 'warning') {
    return warnings.some((w) => isSameCause(w.causedBy, effect.causedBy));
  }
  if (effect.type === 'small_dip') {
    return smallDips.some((d) => isSameCause(d.causedBy, effect.causedBy));
  }
  return notices.some((n) => isSameCause(n.causedBy, effect.causedBy));
}

async function persistNewEffect(
  effect: EvaluatedEffect,
  patientId: string,
  now: string,
  ports: Ports
): Promise<void> {
  if (effect.type === 'warning') {
    await ports.warnings.saveWarning({
      patientId,
      kind: effect.kind!,
      since: effect.since!,
      version: effect.version,
      causedBy: effect.causedBy,
      raisedAt: now,
    });
  } else if (effect.type === 'small_dip') {
    const roundNumber = effect.causedBy.type === 'round' ? effect.causedBy.roundNumber : 0;
    await ports.smallDips.saveSmallDip({
      patientId,
      roundNumber,
      date: effect.causedBy.date,
      version: effect.version,
      causedBy: effect.causedBy,
      shownAt: now,
    });
  } else if (effect.type === 'baseline_not_well') {
    await ports.baselineNotWell.saveNotice({
      patientId,
      version: effect.version,
      causedBy: effect.causedBy,
      notifiedAt: now,
    });
  }
}

/**
 * Evaluates warning rules and baselines for one patient and stores any new effects.
 *
 * Architecture note:
 * Storing facts (answers, missed rounds) and evaluating rules are separate use cases.
 * The server layer will call evaluatePatient right after answering the phone,
 * and again from the scheduled job.
 *
 * evaluatePatient runs under the system actor. All reads (patient, rounds, phq9s,
 * calls, existing warnings/dips) and all writes are performed inside ONE unit of work
 * so two concurrent runs for the same patient cannot both store the same warning.
 */
export async function evaluatePatient(
  actor: Actor,
  input: EvaluatePatientInput,
  ports: Ports
): Promise<UseCaseResult<EvaluatePatientResult>> {
  if (!input.patientId || typeof input.patientId !== 'string') {
    return { ok: false, error: 'Invalid patientId' };
  }

  // Check initial access permissions before entering unit of work for non-system actors
  if (actor.kind !== 'system') {
    const target = { kind: 'flags' as const, patientId: input.patientId };
    const initialAccess = decideAccess({
      actor,
      action: 'write',
      target,
      purpose: 'care',
    });

    if (!initialAccess.ok) {
      return { ok: false, error: initialAccess.error };
    }

    if (!initialAccess.value.allowed) {
      if (initialAccess.value.log) {
        await ports.accessLog.appendLog({
          actor,
          action: 'write',
          target,
          purpose: 'care',
          allowed: false,
          reason: initialAccess.value.reason,
          timestamp: ports.clock.now(),
        });
      }
      return { ok: false, error: initialAccess.value.reason };
    }
  }

  let resultValue: EvaluatePatientResult | null = null;
  let accessError: string | null = null;

  try {
    await ports.unitOfWork.execute(async () => {
      // Clock read exactly once inside the unit of work
      const now = ports.clock.now();

      // This one read is what the access decision itself requires.
      const switches = await ports.patients.getPatientAccessSwitches(input.patientId);
      if (!switches) {
        throw new Error('Patient not found');
      }

      const target: TargetData = {
        kind: 'flags',
        patientId: switches.patientId,
        clinicId: switches.clinicId,
      };

      const consentAccess = decideAccess({
        actor,
        action: 'write',
        target,
        purpose: 'care',
        consent: switches.consent,
      });

      if (!consentAccess.ok) {
        throw new Error(consentAccess.error);
      }

      if (!consentAccess.value.allowed) {
        accessError = consentAccess.value.reason;
        if (consentAccess.value.log) {
          await ports.accessLog.appendLog({
            actor,
            action: 'write',
            target,
            purpose: 'care',
            allowed: false,
            reason: consentAccess.value.reason,
            timestamp: now,
          });
        }
        return;
      }

      // Patient data is read only after the access decision is allowed.
      const patient: PatientRecord | null = await ports.patients.getPatient(input.patientId);
      if (!patient) {
        throw new Error('Patient not found');
      }

      const [storedRounds, storedPhq9s, storedCalls, warnings, smallDips, notices] =
        await Promise.all([
          ports.rounds.getRounds(patient.patientId),
          ports.phq9.getPhq9s(patient.patientId),
          ports.calls.getCalls(patient.patientId),
          ports.warnings.getWarnings(patient.patientId),
          ports.smallDips.getSmallDips(patient.patientId),
          ports.baselineNotWell.getNotices(patient.patientId),
        ]);

      const rounds = buildRoundsHistory(storedRounds);
      const phq9s: HistoryPhq9[] = storedPhq9s
        .filter((p) => p.progress === 'completed' && p.date && typeof p.total === 'number')
        .map((p) => ({ date: p.date!, total: p.total! }));
      const calls: HistoryCall[] = storedCalls.map((c) => ({
        date: c.date,
        ...(c.position ? { position: c.position } : {}),
      }));

      const history: PatientHistory = { rounds, phq9s, calls };
      const evalResult = evaluateHistory(history);
      if (!evalResult.ok) {
        throw new Error(`Rule evaluation failed: ${evalResult.error}`);
      }

      const newEffects: EvaluatedEffect[] = [];
      for (const effect of evalResult.value.effects) {
        if (!isEffectStored(effect, warnings, smallDips, notices)) {
          await persistNewEffect(effect, patient.patientId, now, ports);
          newEffects.push(effect);
        }
      }

      resultValue = {
        storedEffectsCount: newEffects.length,
        newEffects,
      };
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Evaluation failed' };
  }

  if (accessError) {
    return { ok: false, error: accessError };
  }

  return { ok: true, value: resultValue! };
}
