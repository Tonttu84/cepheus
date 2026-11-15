import { describe, it, expect } from 'vitest';
import { isPurposeAllowed, INITIAL_CONSENT_STATE } from '../index';
import type { ConsentState } from '../index';

describe('Consent', () => {
  it('Everything is off by default', () => {
    expect(INITIAL_CONSENT_STATE.taking_part).toBe(false);
    expect(INITIAL_CONSENT_STATE.rule_check).toBe(false);
    expect(INITIAL_CONSENT_STATE.methods.ring).toBe(false);
    expect(INITIAL_CONSENT_STATE.methods.camera).toBe(false);
    expect(INITIAL_CONSENT_STATE.detailed_answers).toBe(false);
  });

  it('Nothing is allowed when taking_part is off', () => {
    const state: ConsentState = { ...INITIAL_CONSENT_STATE, rule_check: true, methods: { ring: true, camera: true } };
    expect(isPurposeAllowed(state, 'care')).toBe(false);
    expect(isPurposeAllowed(state, 'rule_check')).toBe(false);
    expect(isPurposeAllowed(state, 'method:ring')).toBe(false);
    expect(isPurposeAllowed(state, 'method:camera')).toBe(false);
  });

  it('care needs taking_part', () => {
    const state = { ...INITIAL_CONSENT_STATE, taking_part: true };
    expect(isPurposeAllowed(state, 'care')).toBe(true);
  });

  it('method:<name> needs taking_part and that method\'s switch', () => {
    const state1 = { ...INITIAL_CONSENT_STATE, taking_part: true, methods: { ring: true, camera: false } };
    expect(isPurposeAllowed(state1, 'method:ring')).toBe(true);
    expect(isPurposeAllowed(state1, 'method:camera')).toBe(false);

    const state2 = { ...INITIAL_CONSENT_STATE, taking_part: true, methods: { ring: false, camera: true } };
    expect(isPurposeAllowed(state2, 'method:ring')).toBe(false);
    expect(isPurposeAllowed(state2, 'method:camera')).toBe(true);
  });

  it('rule_check needs taking_part and rule_check', () => {
    const stateOff = { ...INITIAL_CONSENT_STATE, taking_part: true, rule_check: false };
    expect(isPurposeAllowed(stateOff, 'rule_check')).toBe(false);

    const stateOn = { ...INITIAL_CONSENT_STATE, taking_part: true, rule_check: true };
    expect(isPurposeAllowed(stateOn, 'rule_check')).toBe(true);
  });

  it('detailed_answers needs taking_part and detailed_answers switch', () => {
    const stateOff = { ...INITIAL_CONSENT_STATE, taking_part: true, detailed_answers: false };
    expect(isPurposeAllowed(stateOff, 'detailed_answers')).toBe(false);
    expect(isPurposeAllowed(stateOff, 'personalisation')).toBe(false);

    const stateOn = { ...INITIAL_CONSENT_STATE, taking_part: true, detailed_answers: true };
    expect(isPurposeAllowed(stateOn, 'detailed_answers')).toBe(true);
    expect(isPurposeAllowed(stateOn, 'personalisation')).toBe(true);

    const stateNoTakingPart = { ...INITIAL_CONSENT_STATE, taking_part: false, detailed_answers: true };
    expect(isPurposeAllowed(stateNoTakingPart, 'detailed_answers')).toBe(false);
  });

  it('an unknown method must be refused', () => {
    const state = { ...INITIAL_CONSENT_STATE, taking_part: true, methods: { ring: true, camera: true } };
    // We cast to test the runtime behavior against unknown strings
    expect(isPurposeAllowed(state, 'method:unknown' as 'care')).toBe(false);
    expect(isPurposeAllowed(state, 'unknown' as 'care')).toBe(false);
  });
});
