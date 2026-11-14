import type { RuleConfig } from '../config';
import { DEFAULT_RULE_CONFIG } from '../config';
import { calculateTapBaselines, type TapBaselinesResult, type Phq9BaselineValue } from '../baseline';
import { classifyRound } from '../classify';
import { foldWarningEvents, type WarningEvent } from '../warning';
import { buildFlag, type ClinicFlag } from '../flags';
import type {
  EvaluateHistoryResult,
  EvaluatedEffect,
  EvaluatedRound,
  HistoryCall,
  HistoryPhq9,
  HistoryGad7,
  HistoryRound,
  TapBaselineSummary,
  WarningCurrentState,
} from './types';
import { validatePatientHistory, validateRuleConfig } from './validation';

interface TaggedEvent {
  date: string;
  subOrder: number;
  index: number;
  event: WarningEvent;
  cause:
    | { readonly type: 'round'; readonly roundNumber: number; readonly date: string }
    | { readonly type: 'phq9'; readonly date: string; readonly total: number }
    | { readonly type: 'gad7'; readonly date: string; readonly total: number }
    | null;
}

function classifyAllRounds(
  rounds: readonly HistoryRound[],
  config: RuleConfig,
  tapBaselines: Extract<TapBaselinesResult, { ok: true }>
): { ok: true; value: EvaluatedRound[] } | { ok: false; error: string } {
  const evaluated: EvaluatedRound[] = [];
  let answeredCountSoFar = 0;

  for (const r of rounds) {
    const hasBaseline = tapBaselines.exists && answeredCountSoFar >= tapBaselines.requiredRounds;
    const baselines = hasBaseline
      ? { mood: tapBaselines.mood, interest: tapBaselines.interest }
      : undefined;

    const answer =
      r.status === 'answered'
        ? { status: 'answered' as const, mood: r.mood ?? 0, interest: r.interest ?? 0 }
        : { status: r.status };

    const classRes = classifyRound(answer, config, baselines);
    if (!classRes.ok) {
      return classRes;
    }

    evaluated.push({
      roundNumber: r.roundNumber,
      localDate: r.localDate,
      status: r.status,
      kind: classRes.value,
      ...(r.status === 'answered' ? { mood: r.mood, interest: r.interest } : {}),
    });

    if (r.status === 'answered') {
      answeredCountSoFar++;
    }
  }

  return { ok: true, value: evaluated };
}

function getCallSubOrder(position: 'before' | 'after' | undefined): number {
  return position === 'before' ? 0 : 3;
}

function buildTaggedEvents(
  rounds: readonly EvaluatedRound[],
  phq9s: readonly HistoryPhq9[],
  calls: readonly HistoryCall[],
  gad7s: readonly HistoryGad7[] = [],
  isGad7On = false
): TaggedEvent[] {
  const list: TaggedEvent[] = [];

  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    list.push({
      date: r.localDate,
      subOrder: 1, // Round closes after before-calls and before questionnaires
      index: i,
      event: { type: 'round_closed', kind: r.kind, date: r.localDate },
      cause: { type: 'round', roundNumber: r.roundNumber, date: r.localDate },
    });
  }

  for (let i = 0; i < phq9s.length; i++) {
    const p = phq9s[i];
    list.push({
      date: p.date,
      subOrder: 2, // PHQ-9 completes after round closes
      index: i,
      event: { type: 'phq9_completed', total: p.total, date: p.date },
      cause: { type: 'phq9', date: p.date, total: p.total },
    });
  }

  if (isGad7On) {
    for (let i = 0; i < gad7s.length; i++) {
      const g = gad7s[i];
      list.push({
        date: g.date,
        subOrder: 2, // GAD-7 completes after round closes
        index: i,
        event: { type: 'gad7_completed', total: g.total, date: g.date },
        cause: { type: 'gad7', date: g.date, total: g.total },
      });
    }
  }

  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    list.push({
      date: c.date,
      subOrder: getCallSubOrder(c.position),
      index: i,
      event: { type: 'call_recorded' },
      cause: null,
    });
  }

  list.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.subOrder !== b.subOrder) return a.subOrder - b.subOrder;
    return a.index - b.index;
  });

  return list;
}

function getPhq9BaselineFromFoldState(state: {
  hasFirstPhq9: boolean;
  phq9Baseline: number | null;
}): Phq9BaselineValue {
  if (!state.hasFirstPhq9) {
    return null;
  }
  if (state.phq9Baseline !== null) {
    return { type: 'baseline', value: state.phq9Baseline };
  }
  return { type: 'not_well' };
}

function mapEffects(
  indexedEffects: readonly { effect: EvaluatedEffect['effect']; index: number }[],
  taggedEvents: readonly TaggedEvent[]
): EvaluatedEffect[] {
  return indexedEffects.map(({ effect, index }) => {
    const cause = taggedEvents[index]?.cause;
    const isRound = cause?.type === 'round';
    const isPhq9 = cause?.type === 'phq9';
    const isGad7 = cause?.type === 'gad7';

    return {
      effect,
      type: effect.type,
      ...(effect.type === 'warning' ? { kind: effect.kind, since: effect.since } : {}),
      version: effect.version,
      causedBy: cause ?? { type: 'round', roundNumber: 0, date: '' },
      ...(isRound ? { roundNumber: cause.roundNumber, roundDate: cause.date } : {}),
      ...(isPhq9 ? { phq9Date: cause.date, phq9Total: cause.total } : {}),
      ...(isGad7 ? { gad7Date: cause.date, gad7Total: cause.total } : {}),
    };
  });
}

export function evaluateHistory(
  rawHistory: unknown,
  rawConfig: RuleConfig = DEFAULT_RULE_CONFIG
): EvaluateHistoryResult {
  const historyRes = validatePatientHistory(rawHistory);
  if (!historyRes.ok) return historyRes;

  const configRes = validateRuleConfig(rawConfig);
  if (!configRes.ok) return configRes;

  const history = historyRes.value;
  const config = configRes.value;

  const answers = history.rounds.map((r) => ({ mood: r.mood, interest: r.interest }));
  const tapBaselinesRes = calculateTapBaselines(answers, config);
  if (!tapBaselinesRes.ok) return { ok: false, error: tapBaselinesRes.error };

  const tapBaseline: TapBaselineSummary = tapBaselinesRes.exists
    ? {
        exists: true,
        hasBaseline: true,
        mood: tapBaselinesRes.mood,
        interest: tapBaselinesRes.interest,
        roundsNeeded: 0,
        answeredRoundsCount: tapBaselinesRes.answeredRoundsCount,
      }
    : {
        exists: false,
        hasBaseline: false,
        mood: null,
        interest: null,
        roundsNeeded: tapBaselinesRes.roundsNeeded,
        answeredRoundsCount: tapBaselinesRes.answeredRoundsCount,
      };

  const roundsRes = classifyAllRounds(history.rounds, config, tapBaselinesRes);
  if (!roundsRes.ok) return roundsRes;
  const evaluatedRounds = roundsRes.value;

  const isGad7On = Array.isArray(history.questionnaires) && history.questionnaires.includes('gad7');
  const taggedEvents = buildTaggedEvents(
    evaluatedRounds,
    history.phq9s ?? [],
    history.calls ?? [],
    history.gad7s ?? [],
    isGad7On
  );
  const rawEvents = taggedEvents.map((t) => t.event);

  const foldRes = foldWarningEvents(rawEvents, config);
  if (!foldRes.ok) return { ok: false, error: foldRes.error };

  const effects = mapEffects(foldRes.effects, taggedEvents);
  const flags = effects
    .map((e) => buildFlag(e.effect))
    .filter((f): f is ClinicFlag => f !== null);

  const isWaiting = foldRes.finalState.activeWarning;
  const lastWarning = isWaiting ? [...effects].reverse().find((e) => e.type === 'warning') : undefined;
  const currentState: WarningCurrentState = {
    isWarningWaitingForCall: isWaiting,
    waitingForCall: isWaiting,
    since: isWaiting && lastWarning && lastWarning.since ? lastWarning.since : null,
  };

  const phq9Baseline = getPhq9BaselineFromFoldState(foldRes.finalState);

  return {
    ok: true,
    value: {
      configVersion: config.version,
      rounds: evaluatedRounds,
      tapBaseline,
      phq9Baseline,
      effects,
      currentState,
      flags,
    },
  };
}
