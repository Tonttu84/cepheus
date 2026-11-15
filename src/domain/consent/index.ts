export type MeasuringMethod = 'ring' | 'camera';

export type ConsentState = {
  taking_part: boolean;
  methods: Record<MeasuringMethod, boolean>;
  rule_check: boolean;
  detailed_answers?: boolean;
};

export const INITIAL_CONSENT_STATE: ConsentState = {
  taking_part: false,
  methods: {
    ring: false,
    camera: false,
  },
  rule_check: false,
  detailed_answers: false,
};

export type ConsentPurpose =
  | 'care'
  | 'rule_check'
  | 'method:ring'
  | 'method:camera'
  | 'detailed_answers'
  | 'personalisation';

export function isPurposeAllowed(state: ConsentState, purpose: ConsentPurpose): boolean {
  if (!state.taking_part) return false;

  if (purpose === 'care') return true;
  if (purpose === 'rule_check') return state.rule_check;
  if (purpose === 'method:ring') return state.methods.ring;
  if (purpose === 'method:camera') return state.methods.camera;
  if (purpose === 'detailed_answers' || purpose === 'personalisation') {
    return Boolean(state.detailed_answers);
  }

  return false;
}
