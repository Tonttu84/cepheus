import { RuleConfig } from '../config';
import { calculatePhq9Baseline } from '../baseline';

export type WarningEvent = 
  | { type: 'round_closed'; kind: 'normal' | 'low' | 'no_answer'; date: string }
  | { type: 'phq9_completed'; total: number; date: string }
  | { type: 'call_recorded' };

export type WarningEffect = 
  | { type: 'small_dip'; version: number }
  | { type: 'warning'; kind: 'low_answers' | 'silence' | 'mixed' | 'phq9'; since: string; version: number }
  | { type: 'baseline_not_well'; version: number };

export type WarningState = {
  activeWarning: boolean;
  phq9Baseline: number | null;
  hasFirstPhq9: boolean;
  prevRound: { kind: 'low' | 'no_answer'; date: string } | null;
};

export const INITIAL_WARNING_STATE: WarningState = {
  activeWarning: false,
  phq9Baseline: null,
  hasFirstPhq9: false,
  prevRound: null,
};

export function processWarningEvent(
  state: WarningState, 
  event: WarningEvent, 
  config: RuleConfig
): { ok: true; newState: WarningState; effects: WarningEffect[] } | { ok: false; error: string } {
  if (event.type === 'call_recorded') {
    return handleCallRecorded(state);
  }

  if (event.type === 'round_closed') {
    return handleRoundClosed(state, event, config);
  }

  if (event.type === 'phq9_completed') {
    return handlePhq9Completed(state, event, config);
  }

  return { ok: false, error: 'Unknown event type' };
}

export function handleCallRecorded(state: WarningState) {
  return {
    ok: true as const,
    newState: {
      ...state,
      activeWarning: false,
      prevRound: null,
    },
    effects: [],
  };
}

export function handleRoundClosed(
  state: WarningState, 
  event: Extract<WarningEvent, { type: 'round_closed' }>, 
  config: RuleConfig
) {
  const effects: WarningEffect[] = [];

  if (event.kind === 'normal') {
    return {
      ok: true as const,
      newState: {
        ...state,
        prevRound: null,
      },
      effects,
    };
  }
  
  if (!state.prevRound) {
    if (event.kind === 'low' && !state.activeWarning) {
      effects.push({ type: 'small_dip', version: config.version });
    }
    return {
      ok: true as const,
      newState: {
        ...state,
        prevRound: { kind: event.kind, date: event.date },
      },
      effects,
    };
  } else {
    let activeWarning = state.activeWarning;
    if (!state.activeWarning) {
      activeWarning = true;
      const kind = getWarningKind(state.prevRound.kind, event.kind);
      effects.push({ type: 'warning', kind, since: state.prevRound.date, version: config.version });
    }
    return {
      ok: true as const,
      newState: {
        ...state,
        activeWarning,
        prevRound: null,
      },
      effects,
    };
  }
}

function getWarningKind(prev: 'low' | 'no_answer', curr: 'low' | 'no_answer') {
  if (prev === 'low' && curr === 'low') return 'low_answers';
  if (prev === 'no_answer' && curr === 'no_answer') return 'silence';
  return 'mixed';
}

export function handlePhq9Completed(
  state: WarningState, 
  event: Extract<WarningEvent, { type: 'phq9_completed' }>, 
  config: RuleConfig
) {
  if (typeof event.total !== 'number' || !Number.isInteger(event.total) || event.total < 0 || event.total > 27) {
    return { ok: false as const, error: 'invalid phq9 total' };
  }

  const effects: WarningEffect[] = [];

  if (!state.hasFirstPhq9) {
    const result = calculatePhq9Baseline([event.total], config);
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }

    let activeWarning = state.activeWarning;
    let prevRound = state.prevRound;
    let phq9Baseline = state.phq9Baseline;

    if (result.value && result.value.type === 'not_well') {
      effects.push({ type: 'baseline_not_well', version: config.version });
      if (!state.activeWarning) {
        activeWarning = true;
        effects.push({ type: 'warning', kind: 'phq9', since: event.date, version: config.version });
        prevRound = null;
      }
    } else if (result.value && result.value.type === 'baseline') {
      phq9Baseline = result.value.value;
    }

    return {
      ok: true as const,
      newState: {
        ...state,
        hasFirstPhq9: true,
        activeWarning,
        prevRound,
        phq9Baseline,
      },
      effects,
    };
  }

  let activeWarning = state.activeWarning;
  let prevRound = state.prevRound;

  if (!state.activeWarning) {
    const isWarning = event.total >= config.phq9WarningCutoff || 
      (state.phq9Baseline !== null && event.total >= state.phq9Baseline + config.phq9WarningRise);
    
    if (isWarning) {
      activeWarning = true;
      effects.push({ type: 'warning', kind: 'phq9', since: event.date, version: config.version });
      prevRound = null;
    }
  }

  return {
    ok: true as const,
    newState: {
      ...state,
      activeWarning,
      prevRound,
    },
    effects,
  };
}

export type IndexedEffect = { effect: WarningEffect; index: number };

export function foldWarningEvents(
  events: WarningEvent[], 
  config: RuleConfig
): { ok: true; finalState: WarningState; effects: IndexedEffect[] } | { ok: false; error: string; index: number } {
  let state = INITIAL_WARNING_STATE;
  const allEffects: IndexedEffect[] = [];

  for (let i = 0; i < events.length; i++) {
    const result = processWarningEvent(state, events[i], config);
    if (!result.ok) {
      return { ok: false, error: result.error, index: i };
    }
    state = result.newState;
    for (const effect of result.effects) {
      allEffects.push({ effect, index: i });
    }
  }

  return { ok: true, finalState: state, effects: allEffects };
}
