import type { HistoryRound, HistoryPhq9, HistoryGad7, HistoryCall, PatientHistory, QuestionnaireType } from './types';
import type { RuleConfig } from '../config';

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isValidCalendarDate(dateString: unknown): boolean {
  if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }
  const [year, month, day] = dateString.split('-').map((v) => Number.parseInt(v, 10));
  if (month < 1 || month > 12) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateRoundScores(round: Record<string, unknown>): ValidationResult<void> {
  const status = round.status;
  if (status === 'answered') {
    const { mood, interest } = round;
    const isMoodValid = typeof mood === 'number' && Number.isInteger(mood) && mood >= 0 && mood <= 4;
    const isInterestValid = typeof interest === 'number' && Number.isInteger(interest) && interest >= 0 && interest <= 4;
    if (!isMoodValid || !isInterestValid) {
      return { ok: false, error: 'Answered round requires integer mood and interest scores between 0 and 4' };
    }
  } else {
    if (round.mood !== undefined || round.interest !== undefined) {
      return { ok: false, error: 'Unanswered round must not have tap scores' };
    }
  }
  return { ok: true, value: undefined };
}

function validateRounds(rounds: unknown): ValidationResult<HistoryRound[]> {
  if (!Array.isArray(rounds)) {
    return { ok: false, error: 'Rounds must be an array' };
  }

  const validated: HistoryRound[] = [];
  let prevDate: string | null = null;

  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    if (!r || typeof r !== 'object') {
      return { ok: false, error: `Round at index ${i} is not an object` };
    }
    const candidate = r as Record<string, unknown>;
    const expectedNumber = i + 1;
    if (candidate.roundNumber !== expectedNumber) {
      return { ok: false, error: `Round number at index ${i} must be ${expectedNumber}` };
    }
    if (!isValidCalendarDate(candidate.localDate)) {
      return { ok: false, error: `Round ${expectedNumber} has invalid localDate` };
    }
    const localDate = candidate.localDate as string;
    if (prevDate !== null && localDate <= prevDate) {
      return { ok: false, error: `Round dates must be strictly increasing and not duplicated` };
    }
    prevDate = localDate;

    if (candidate.status !== 'answered' && candidate.status !== 'not_today' && candidate.status !== 'missed') {
      return { ok: false, error: `Round ${expectedNumber} has invalid status` };
    }

    const scoresRes = validateRoundScores(candidate);
    if (!scoresRes.ok) {
      return scoresRes;
    }

    validated.push({
      roundNumber: expectedNumber,
      localDate,
      status: candidate.status,
      ...(candidate.status === 'answered'
        ? { mood: candidate.mood as number, interest: candidate.interest as number }
        : {}),
    });
  }

  return { ok: true, value: validated };
}

function validatePhq9s(phq9s: unknown): ValidationResult<HistoryPhq9[]> {
  if (phq9s === undefined) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(phq9s)) {
    return { ok: false, error: 'PHQ-9s must be an array' };
  }

  const validated: HistoryPhq9[] = [];
  let prevDate: string | null = null;

  for (let i = 0; i < phq9s.length; i++) {
    const item = phq9s[i];
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `PHQ-9 at index ${i} is not an object` };
    }
    const candidate = item as Record<string, unknown>;
    if (!isValidCalendarDate(candidate.date)) {
      return { ok: false, error: `PHQ-9 at index ${i} has invalid date` };
    }
    const date = candidate.date as string;
    if (prevDate !== null && date <= prevDate) {
      return { ok: false, error: 'PHQ-9 dates must be strictly increasing and not duplicated' };
    }
    prevDate = date;

    const total = candidate.total;
    if (typeof total !== 'number' || !Number.isInteger(total) || total < 0 || total > 27) {
      return { ok: false, error: `PHQ-9 at index ${i} has invalid total score` };
    }

    validated.push({ date, total });
  }

  return { ok: true, value: validated };
}

function validateGad7s(gad7s: unknown): ValidationResult<HistoryGad7[]> {
  if (gad7s === undefined) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(gad7s)) {
    return { ok: false, error: 'GAD-7s must be an array' };
  }

  const validated: HistoryGad7[] = [];
  let prevDate: string | null = null;

  for (let i = 0; i < gad7s.length; i++) {
    const item = gad7s[i];
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `GAD-7 at index ${i} is not an object` };
    }
    const candidate = item as Record<string, unknown>;
    if (!isValidCalendarDate(candidate.date)) {
      return { ok: false, error: `GAD-7 at index ${i} has invalid date` };
    }
    const date = candidate.date as string;
    if (prevDate !== null && date <= prevDate) {
      return { ok: false, error: 'GAD-7 dates must be strictly increasing and not duplicated' };
    }
    prevDate = date;

    const total = candidate.total;
    if (typeof total !== 'number' || !Number.isInteger(total) || total < 0 || total > 21) {
      return { ok: false, error: `GAD-7 at index ${i} has invalid total score` };
    }

    validated.push({ date, total });
  }

  return { ok: true, value: validated };
}

function validateQuestionnaires(questionnaires: unknown): ValidationResult<QuestionnaireType[] | undefined> {
  if (questionnaires === undefined) {
    return { ok: true, value: undefined };
  }
  if (!Array.isArray(questionnaires)) {
    return { ok: false, error: 'Questionnaires must be an array' };
  }
  for (const q of questionnaires) {
    if (q !== 'phq9' && q !== 'gad7') {
      return { ok: false, error: `Unknown questionnaire: ${String(q)}` };
    }
  }
  return { ok: true, value: questionnaires as QuestionnaireType[] };
}

function validateCalls(calls: unknown): ValidationResult<HistoryCall[]> {
  if (calls === undefined) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(calls)) {
    return { ok: false, error: 'Calls must be an array' };
  }

  const validated: HistoryCall[] = [];
  let prevDate: string | null = null;

  for (let i = 0; i < calls.length; i++) {
    const item = calls[i];
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `Call at index ${i} is not an object` };
    }
    const candidate = item as Record<string, unknown>;
    if (!isValidCalendarDate(candidate.date)) {
      return { ok: false, error: `Call at index ${i} has invalid date` };
    }
    const date = candidate.date as string;
    if (prevDate !== null && date < prevDate) {
      return { ok: false, error: 'Calls must be in chronological order by date' };
    }
    prevDate = date;

    if ('orderKey' in candidate) {
      return { ok: false, error: `Call at index ${i} has unrecognized property orderKey` };
    }

    if (candidate.position !== undefined && candidate.position !== 'before' && candidate.position !== 'after') {
      return { ok: false, error: `Call at index ${i} has invalid position: must be "before" or "after"` };
    }

    const position = candidate.position === 'before' ? 'before' : 'after';
    validated.push({ date, position });
  }

  return { ok: true, value: validated };
}

export function validateRuleConfig(config: unknown): ValidationResult<RuleConfig> {
  if (!config || typeof config !== 'object') {
    return { ok: false, error: 'Config must be an object' };
  }
  const c = config as Record<string, unknown>;
  const keys: (keyof RuleConfig)[] = [
    'version',
    'bottomOptionScore',
    'tapDropOne',
    'tapDropBoth',
    'tapBaselineRequiredRounds',
    'phq9NotWellCutoff',
    'phq9WarningCutoff',
    'phq9WarningRise',
    'gad7WarningCutoff',
  ];

  for (const k of keys) {
    if (typeof c[k] !== 'number' || Number.isNaN(c[k])) {
      return { ok: false, error: `Config property ${k} must be a number` };
    }
  }

  return { ok: true, value: config as RuleConfig };
}

export function validatePatientHistory(input: unknown): ValidationResult<PatientHistory> {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Patient history must be an object' };
  }
  const record = input as Record<string, unknown>;

  const roundsRes = validateRounds(record.rounds);
  if (!roundsRes.ok) return roundsRes;

  const phq9sRes = validatePhq9s(record.phq9s);
  if (!phq9sRes.ok) return phq9sRes;

  const gad7sRes = validateGad7s(record.gad7s);
  if (!gad7sRes.ok) return gad7sRes;

  const callsRes = validateCalls(record.calls);
  if (!callsRes.ok) return callsRes;

  const questionnairesRes = validateQuestionnaires(record.questionnaires);
  if (!questionnairesRes.ok) return questionnairesRes;

  if (roundsRes.value.length === 0) {
    if (phq9sRes.value.length > 0) {
      return { ok: false, error: 'PHQ-9 cannot be recorded before the first round' };
    }
    if (gad7sRes.value.length > 0) {
      return { ok: false, error: 'GAD-7 cannot be recorded before the first round' };
    }
    if (callsRes.value.length > 0) {
      return { ok: false, error: 'Call cannot be recorded before the first round' };
    }
  } else {
    const firstRoundDate = roundsRes.value[0].localDate;
    for (let i = 0; i < phq9sRes.value.length; i++) {
      if (phq9sRes.value[i].date < firstRoundDate) {
        return { ok: false, error: `PHQ-9 at index ${i} is dated before the first round's date` };
      }
    }
    for (let i = 0; i < gad7sRes.value.length; i++) {
      if (gad7sRes.value[i].date < firstRoundDate) {
        return { ok: false, error: `GAD-7 at index ${i} is dated before the first round's date` };
      }
    }
    for (let i = 0; i < callsRes.value.length; i++) {
      if (callsRes.value[i].date < firstRoundDate) {
        return { ok: false, error: `Call at index ${i} is dated before the first round's date` };
      }
    }
  }

  return {
    ok: true,
    value: {
      rounds: roundsRes.value,
      phq9s: phq9sRes.value,
      gad7s: gad7sRes.value,
      calls: callsRes.value,
      ...(questionnairesRes.value !== undefined ? { questionnaires: questionnairesRes.value } : {}),
    },
  };
}
