import {
  decideAccess,
  type AccessDecision,
  type Actor,
  type TargetData,
  type Purpose,
} from '../domain/access';
import { GAD7_ITEMS, scoreGad7, type Gad7Answer } from '../domain/instruments';
import { getOpenRound, isPhq9Due } from '../domain/rounds';
import type {
  PatientRecord,
  Ports,
  StoredGad7,
  StoredPhq9,
  StoredRound,
  SubmitGad7AnswerResult,
  UseCaseResult,
} from './ports';
import { buildPhq9DueHistory } from './shared';

export interface SubmitGad7AnswerInput {
  readonly patientId: string;
  readonly itemId: string;
  readonly value: number;
}

const USE_CASE_PURPOSE: Purpose = 'self_access';

/** A GAD-7 with a total is completed; real storage may keep the total and drop the item answers. */
function isCompleted(assessment: StoredGad7): boolean {
  return typeof assessment.total === 'number';
}

function validateInput(input: SubmitGad7AnswerInput): string | null {
  if (!input.patientId || typeof input.patientId !== 'string') return 'Invalid patientId';
  const item = GAD7_ITEMS.find((i) => i.id === input.itemId);
  if (!item) return 'Invalid item id';
  const { value } = input;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < item.min || value > item.max) {
    return 'Invalid item value';
  }
  return null;
}

/**
 * The GAD-7 follows the PHQ-9's schedule (round 1, then every fourth round,
 * an unfinished one carried to the next round), worked out from the GAD-7's
 * own history so that the two questionnaires never block each other.
 */
function checkEligibility(
  roundNumber: number,
  rounds: readonly StoredRound[],
  gad7s: readonly StoredGad7[]
): string | null {
  const asProgress: StoredPhq9[] = gad7s.map((g) => ({
    patientId: g.patientId,
    roundNumber: g.roundNumber,
    progress: isCompleted(g) ? 'completed' : 'unfinished',
    answers: [],
  }));
  if (!isPhq9Due(roundNumber, buildPhq9DueHistory(roundNumber, rounds, asProgress))) {
    return 'Cannot submit GAD-7: GAD-7 is not due in this round';
  }
  if (gad7s.some((g) => g.roundNumber === roundNumber && isCompleted(g))) {
    return 'Cannot submit GAD-7 answer: GAD-7 is already completed';
  }
  return null;
}

function mergeAnswer(answers: readonly Gad7Answer[], itemId: string, value: number): Gad7Answer[] {
  return [...answers.filter((a) => a.id !== itemId), { id: itemId, value }].sort(
    (a, b) => Number(a.id) - Number(b.id)
  );
}

async function appendLog(
  ports: Ports,
  actor: Actor,
  target: TargetData,
  decision: AccessDecision,
  timestamp: string
): Promise<void> {
  await ports.accessLog.appendLog({
    actor,
    action: 'write',
    target,
    purpose: USE_CASE_PURPOSE,
    allowed: decision.allowed,
    reason: decision.reason,
    timestamp,
  });
}

/** The first access question, asked before anything is read; returns a refusal or null. */
async function refuseBeforeReading(
  actor: Actor,
  input: SubmitGad7AnswerInput,
  ports: Ports
): Promise<string | null> {
  const target: TargetData = {
    kind: 'answers',
    patientId: input?.patientId,
    clinicId: actor.kind === 'patient' || actor.kind === 'staff' ? actor.clinicId : undefined,
  };
  const access = decideAccess({ actor, action: 'write', target, purpose: USE_CASE_PURPOSE });
  if (!access.ok) return access.error;
  if (access.value.allowed) return null;

  const awaitsConsentCheck =
    actor.kind === 'patient' &&
    actor.patientId === input?.patientId &&
    access.value.reason === 'consent_required';
  if (awaitsConsentCheck) return null;

  if (access.value.log) await appendLog(ports, actor, target, access.value, ports.clock.now());
  return access.value.reason;
}

/** The access decision with the patient's own switches, inside the unit of work. */
async function refuseWithSwitches(
  actor: Actor,
  patientId: string,
  now: string,
  ports: Ports
): Promise<string | null> {
  const switches = await ports.patients.getPatientAccessSwitches(patientId);
  if (!switches) throw new Error('Patient not found');
  const target: TargetData = { kind: 'answers', patientId: switches.patientId, clinicId: switches.clinicId };
  const access = decideAccess({
    actor,
    action: 'write',
    target,
    purpose: USE_CASE_PURPOSE,
    consent: switches.consent,
  });
  if (!access.ok) throw new Error(access.error);
  if (access.value.log) await appendLog(ports, actor, target, access.value, now);
  return access.value.allowed ? null : access.value.reason;
}

async function storeAnswer(
  patient: PatientRecord,
  input: SubmitGad7AnswerInput,
  now: string,
  ports: Ports
): Promise<boolean> {
  if (!patient.questionnaires?.includes('gad7')) throw new Error('GAD-7 is not assigned to this patient');
  if (!ports.gad7) throw new Error('GAD-7 repository is not configured');

  const openRound = getOpenRound(patient.schedule, now);
  if (!openRound) throw new Error('No round is currently open');
  const storedRound = await ports.rounds.getRound(patient.patientId, openRound.number);
  if (storedRound?.status !== 'answered') throw new Error('Cannot submit GAD-7 before taps are answered');

  const [rounds, gad7s] = await Promise.all([
    ports.rounds.getRounds(patient.patientId),
    ports.gad7.getGad7s(patient.patientId),
  ]);
  const refusal = checkEligibility(openRound.number, rounds, gad7s);
  if (refusal) throw new Error(refusal);

  const unfinished = gad7s.find((g) => !isCompleted(g));
  const answers = mergeAnswer(unfinished?.answers ?? [], input.itemId, input.value);
  const isComplete = answers.length === GAD7_ITEMS.length;
  await ports.gad7.saveGad7({
    patientId: patient.patientId,
    roundNumber: unfinished?.roundNumber ?? openRound.number,
    answers,
    total: isComplete ? scoreGad7(answers) : null,
    completedAt: isComplete ? now : null,
    date: isComplete ? openRound.localDate : null,
  });
  return isComplete;
}

/**
 * Submits an answer to one GAD-7 item. It mirrors `submitPhq9Answer`: the
 * access decision first, the answer merged into the questionnaire in
 * progress, a total only once all seven items are answered, and everything
 * stored in one unit of work. The GAD-7 has no self-harm item, so there is no
 * crisis rule here. Running the warning rule is a separate use case.
 */
export async function submitGad7Answer(
  actor: Actor,
  input: SubmitGad7AnswerInput,
  ports: Ports
): Promise<UseCaseResult<SubmitGad7AnswerResult>> {
  const early = await refuseBeforeReading(actor, input, ports);
  if (early) return { ok: false, error: early };

  const invalid = validateInput(input);
  if (invalid) return { ok: false, error: invalid };

  let refusal: string | null = null;
  let isComplete = false;
  try {
    await ports.unitOfWork.execute(async () => {
      const now = ports.clock.now();
      refusal = await refuseWithSwitches(actor, input.patientId, now, ports);
      if (refusal) return;
      const patient = await ports.patients.getPatient(input.patientId);
      if (!patient) throw new Error('Patient not found');
      isComplete = await storeAnswer(patient, input, now, ports);
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage failed' };
  }

  if (refusal) return { ok: false, error: refusal };
  return { ok: true, value: { isComplete, ruleRunNeeded: isComplete } };
}
