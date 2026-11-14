import { describe, it, expect } from 'vitest';
import { decideAccess } from '../index';
import type {
  Actor,
  Action,
  DataKind,
  Purpose,
  AccessRequest,
  StaffRole,
  AccessReasonCode,
  AccessResult,
} from '../types';
import type { ConsentState } from '../../consent';

type SwitchPreset = 'all_off' | 'taking_part_only' | 'ring_only' | 'rule_check_only' | 'all_on';

const SWITCH_PRESETS: Record<SwitchPreset, ConsentState> = {
  all_off: {
    taking_part: false,
    methods: { ring: false, camera: false },
    rule_check: false,
  },
  taking_part_only: {
    taking_part: true,
    methods: { ring: false, camera: false },
    rule_check: false,
  },
  ring_only: {
    taking_part: true,
    methods: { ring: true, camera: false },
    rule_check: false,
  },
  rule_check_only: {
    taking_part: true,
    methods: { ring: false, camera: false },
    rule_check: true,
  },
  all_on: {
    taking_part: true,
    methods: { ring: true, camera: true },
    rule_check: true,
  },
};

type AllowedEntry = {
  actor: 'patient' | 'nurse' | 'admin' | 'system';
  action: Action;
  kind: DataKind;
  purpose: Purpose;
  sameClinicOnly: boolean;
  samePatientOnly: boolean;
  switchCheck: (preset: SwitchPreset) => boolean;
  log: boolean;
};

// Plain handwritten list of all allowed cases according to rules 1-7
const ALLOWED_CASES: AllowedEntry[] = [
  // Rule 1: Patient read own data for self_access
  { actor: 'patient', action: 'read', kind: 'answers', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: false },
  { actor: 'patient', action: 'read', kind: 'rounds', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: false },
  { actor: 'patient', action: 'read', kind: 'readings', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: false },
  { actor: 'patient', action: 'read', kind: 'baselines', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: false },
  { actor: 'patient', action: 'read', kind: 'consent', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: false },
  { actor: 'patient', action: 'read', kind: 'suggestions', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: false },
  { actor: 'patient', action: 'read', kind: 'flags', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: false },
  { actor: 'patient', action: 'read', kind: 'crisis_messages', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: false },
  { actor: 'patient', action: 'read', kind: 'call_outcomes', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: false },
  { actor: 'patient', action: 'read', kind: 'patient_record', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: false },

  // Rule 2: Patient write answers/rounds only while taking_part is on
  { actor: 'patient', action: 'write', kind: 'answers', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: (p) => p !== 'all_off', log: false },
  { actor: 'patient', action: 'write', kind: 'rounds', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: (p) => p !== 'all_off', log: false },

  // Rule 2: Patient write consent always
  { actor: 'patient', action: 'write', kind: 'consent', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: false },

  // Rule 2: Patient write readings for method:ring only while taking_part and ring are on
  { actor: 'patient', action: 'write', kind: 'readings', purpose: 'method:ring', sameClinicOnly: true, samePatientOnly: true, switchCheck: (p) => p === 'ring_only' || p === 'all_on', log: false },

  // Rule 2: Patient delete own data for self_access always (logged per rule 8)
  { actor: 'patient', action: 'delete', kind: 'answers', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: true },
  { actor: 'patient', action: 'delete', kind: 'rounds', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: true },
  { actor: 'patient', action: 'delete', kind: 'readings', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: true },
  { actor: 'patient', action: 'delete', kind: 'baselines', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: true },
  { actor: 'patient', action: 'delete', kind: 'suggestions', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: true },
  { actor: 'patient', action: 'delete', kind: 'consent', purpose: 'self_access', sameClinicOnly: true, samePatientOnly: true, switchCheck: () => true, log: true },

  // Rule 4: Staff (nurse and admin) read flags and call_outcomes for care (needs taking_part)
  { actor: 'nurse', action: 'read', kind: 'flags', purpose: 'care', sameClinicOnly: true, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: true },
  { actor: 'admin', action: 'read', kind: 'flags', purpose: 'care', sameClinicOnly: true, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: true },
  { actor: 'nurse', action: 'read', kind: 'call_outcomes', purpose: 'care', sameClinicOnly: true, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: true },
  { actor: 'admin', action: 'read', kind: 'call_outcomes', purpose: 'care', sameClinicOnly: true, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: true },

  // Rule 4: Staff read crisis_messages and patient_record for care (no taking_part needed)
  { actor: 'nurse', action: 'read', kind: 'crisis_messages', purpose: 'care', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: true },
  { actor: 'admin', action: 'read', kind: 'crisis_messages', purpose: 'care', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: true },
  { actor: 'nurse', action: 'read', kind: 'patient_record', purpose: 'care', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: true },
  { actor: 'admin', action: 'read', kind: 'patient_record', purpose: 'care', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: true },

  // Rule 4: Staff write call_outcomes for care (needs taking_part)
  { actor: 'nurse', action: 'write', kind: 'call_outcomes', purpose: 'care', sameClinicOnly: true, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: true },
  { actor: 'admin', action: 'write', kind: 'call_outcomes', purpose: 'care', sameClinicOnly: true, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: true },

  // Rule 4: Staff write crisis_messages for care (acknowledge, no taking_part needed)
  { actor: 'nurse', action: 'write', kind: 'crisis_messages', purpose: 'care', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: true },
  { actor: 'admin', action: 'write', kind: 'crisis_messages', purpose: 'care', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: true },

  // Rule 4: Staff write patient_record and enrolment_codes for administration
  { actor: 'nurse', action: 'write', kind: 'patient_record', purpose: 'administration', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: true },
  { actor: 'admin', action: 'write', kind: 'patient_record', purpose: 'administration', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: true },
  { actor: 'nurse', action: 'write', kind: 'enrolment_codes', purpose: 'administration', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: true },
  { actor: 'admin', action: 'write', kind: 'enrolment_codes', purpose: 'administration', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: true },

  // Rule 6: Admin read/write staff_accounts and read access_log of own clinic for administration
  { actor: 'admin', action: 'read', kind: 'staff_accounts', purpose: 'administration', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: false },
  { actor: 'admin', action: 'write', kind: 'staff_accounts', purpose: 'administration', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: false },
  { actor: 'admin', action: 'read', kind: 'access_log', purpose: 'administration', sameClinicOnly: true, samePatientOnly: false, switchCheck: () => true, log: false },

  // Rule 7: System read answers, rounds, baselines for care (needs taking_part)
  { actor: 'system', action: 'read', kind: 'answers', purpose: 'care', sameClinicOnly: false, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: false },
  { actor: 'system', action: 'read', kind: 'rounds', purpose: 'care', sameClinicOnly: false, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: false },
  { actor: 'system', action: 'read', kind: 'baselines', purpose: 'care', sameClinicOnly: false, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: false },

  // Rule 7: System write baselines, flags, crisis_messages, suggestions for care (needs taking_part)
  { actor: 'system', action: 'write', kind: 'baselines', purpose: 'care', sameClinicOnly: false, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: false },
  { actor: 'system', action: 'write', kind: 'flags', purpose: 'care', sameClinicOnly: false, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: false },
  { actor: 'system', action: 'write', kind: 'crisis_messages', purpose: 'care', sameClinicOnly: false, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: false },
  { actor: 'system', action: 'write', kind: 'suggestions', purpose: 'care', sameClinicOnly: false, samePatientOnly: false, switchCheck: (p) => p !== 'all_off', log: false },

  // Rule 7: System read readings for method:ring (needs taking_part and ring switch)
  { actor: 'system', action: 'read', kind: 'readings', purpose: 'method:ring', sameClinicOnly: false, samePatientOnly: false, switchCheck: (p) => p === 'ring_only' || p === 'all_on', log: false },

  // Rule 7: System read rule_check_dataset for rule_check (needs taking_part and rule_check switch)
  { actor: 'system', action: 'read', kind: 'rule_check_dataset', purpose: 'rule_check', sameClinicOnly: false, samePatientOnly: false, switchCheck: (p) => p === 'rule_check_only' || p === 'all_on', log: true },
];

function expectedLogFromSpecification(
  actorKey: 'patient' | 'nurse' | 'admin' | 'system',
  action: Action,
  kind: DataKind,
  purpose: Purpose
): boolean {
  // Plain specification rules:
  // 1. Every delete by anyone
  if (action === 'delete') return true;

  // 2. Every attempt by clinic staff on a patient's data, allowed or refused
  const isPatientData =
    kind !== 'staff_accounts' && kind !== 'access_log' && kind !== 'rule_check_dataset';
  if ((actorKey === 'nurse' || actorKey === 'admin') && isPatientData) {
    return true;
  }

  // 3. Every rule_check read by the system
  if (actorKey === 'system' && action === 'read' && purpose === 'rule_check') {
    return true;
  }

  return false;
}

function expectedReasonFromSpecification(
  actorKey: 'patient' | 'nurse' | 'admin' | 'system',
  action: Action,
  kind: DataKind,
  purpose: Purpose,
  sameClinic: boolean,
  samePatient: boolean,
  preset: SwitchPreset
): AccessReasonCode {
  // Check if allowed
  for (const entry of ALLOWED_CASES) {
    if (entry.actor !== actorKey) continue;
    if (entry.action !== action) continue;
    if (entry.kind !== kind) continue;
    if (entry.purpose !== purpose) continue;
    if (entry.sameClinicOnly && !sameClinic) continue;
    if (entry.samePatientOnly && !samePatient) continue;
    if (!entry.switchCheck(preset)) continue;
    return 'allowed';
  }

  // Refusal reasons per class of request:
  // Universal: access_log is immutable against write and delete
  if (kind === 'access_log' && (action === 'write' || action === 'delete')) {
    return 'access_log_immutable';
  }

  // Patient actor:
  if (actorKey === 'patient') {
    if (!sameClinic || !samePatient) {
      return 'not_own_data';
    }
    if (
      kind === 'staff_accounts' ||
      kind === 'access_log' ||
      kind === 'enrolment_codes' ||
      kind === 'rule_check_dataset'
    ) {
      return 'patient_forbidden_data';
    }
    if (action === 'write') {
      if ((kind === 'answers' || kind === 'rounds') && purpose === 'self_access') {
        return 'consent_required';
      }
      if (kind === 'readings') {
        if (purpose === 'method:ring') {
          return 'consent_required';
        }
        if (purpose.startsWith('method:')) {
          return 'method_mismatch';
        }
        return 'disallowed_action';
      }
      return 'disallowed_action';
    }
    return 'disallowed_action';
  }

  // Clinic staff actor (nurse & admin):
  if (actorKey === 'nurse' || actorKey === 'admin') {
    if (
      kind === 'answers' ||
      kind === 'rounds' ||
      kind === 'readings' ||
      kind === 'baselines' ||
      kind === 'suggestions'
    ) {
      return 'clinic_staff_forbidden_clinical_data';
    }
    if (!sameClinic) {
      return 'other_clinic';
    }
    if (kind === 'access_log' || kind === 'staff_accounts') {
      if (actorKey !== 'admin') {
        return 'admin_only';
      }
      return 'disallowed_action';
    }
    if (action === 'read' && purpose === 'care') {
      if (kind === 'flags' || kind === 'call_outcomes') {
        return 'consent_required';
      }
    }
    if (action === 'write' && purpose === 'care') {
      if (kind === 'call_outcomes') {
        return 'consent_required';
      }
    }
    return 'disallowed_action';
  }

  // System actor:
  if (actorKey === 'system') {
    if (action === 'read') {
      if (
        purpose === 'care' &&
        (kind === 'answers' || kind === 'rounds' || kind === 'baselines')
      ) {
        return 'consent_required';
      }
      if (kind === 'readings') {
        if (purpose === 'method:ring') {
          return 'consent_required';
        }
        if (purpose.startsWith('method:')) {
          return 'method_mismatch';
        }
        return 'disallowed_action';
      }
      if (purpose === 'rule_check' && kind === 'rule_check_dataset') {
        return 'consent_required';
      }
      return 'disallowed_action';
    }
    if (action === 'write' && purpose === 'care') {
      if (
        kind === 'baselines' ||
        kind === 'flags' ||
        kind === 'crisis_messages' ||
        kind === 'suggestions'
      ) {
        return 'consent_required';
      }
    }
    return 'disallowed_action';
  }

  return 'disallowed_action';
}

describe('Access Rules Decision Function', () => {
  describe('Comprehensive Table-driven Combinatorial Test', () => {
    const actorDefs: { key: 'patient' | 'nurse' | 'admin' | 'system'; actor: Actor }[] = [
      { key: 'patient', actor: { kind: 'patient', patientId: 'pat_1', clinicId: 'cli_1' } },
      { key: 'nurse', actor: { kind: 'staff', staffId: 'st_1', clinicId: 'cli_1', role: 'nurse' } },
      { key: 'admin', actor: { kind: 'staff', staffId: 'st_2', clinicId: 'cli_1', role: 'admin' } },
      { key: 'system', actor: { kind: 'system' } },
    ];

    const actions: Action[] = ['read', 'write', 'delete'];

    const dataKinds: DataKind[] = [
      'answers',
      'rounds',
      'readings',
      'baselines',
      'consent',
      'suggestions',
      'flags',
      'crisis_messages',
      'call_outcomes',
      'patient_record',
      'enrolment_codes',
      'staff_accounts',
      'access_log',
      'rule_check_dataset',
    ];

    const purposes: Purpose[] = [
      'self_access',
      'care',
      'method:ring',
      'method:camera',
      'rule_check',
      'administration',
    ];

    const targets = [
      { sameClinic: true, samePatient: true, clinicId: 'cli_1', patientId: 'pat_1' },
      { sameClinic: true, samePatient: false, clinicId: 'cli_1', patientId: 'pat_2' },
      { sameClinic: false, samePatient: true, clinicId: 'cli_2', patientId: 'pat_1' },
      { sameClinic: false, samePatient: false, clinicId: 'cli_2', patientId: 'pat_2' },
    ];

    const switchPresets: SwitchPreset[] = [
      'all_off',
      'taking_part_only',
      'ring_only',
      'rule_check_only',
      'all_on',
    ];

    for (const actorDef of actorDefs) {
      it(`asserts every combination for actor ${actorDef.key} matches the plain allowed cases list`, () => {
        let combinationsChecked = 0;

        for (const action of actions) {
          for (const kind of dataKinds) {
            for (const purpose of purposes) {
              for (const tgt of targets) {
                for (const preset of switchPresets) {
                  const consent = SWITCH_PRESETS[preset];
                  const request: AccessRequest = {
                    actor: actorDef.actor,
                    action,
                    target: {
                      kind,
                      clinicId: tgt.clinicId,
                      patientId: tgt.patientId,
                      method: kind === 'readings' ? 'ring' : undefined,
                    },
                    purpose,
                    consent,
                  };

                  const result = decideAccess(request);
                  expect(result.ok).toBe(true);
                  if (!result.ok) continue;

                  const expectedReason = expectedReasonFromSpecification(
                    actorDef.key,
                    action,
                    kind,
                    purpose,
                    tgt.sameClinic,
                    tgt.samePatient,
                    preset
                  );
                  const expectedLog = expectedLogFromSpecification(
                    actorDef.key,
                    action,
                    kind,
                    purpose
                  );

                  expect(result.value.allowed).toBe(expectedReason === 'allowed');
                  expect(result.value.reason).toBe(expectedReason);
                  expect(result.value.log).toBe(expectedLog);

                  combinationsChecked++;
                }
              }
            }
          }
        }

        // 3 actions * 14 kinds * 6 purposes * 4 target relationships * 5 switch states = 5,040
        expect(combinationsChecked).toBe(5040);
      });
    }
  });

  describe('Named Tests for Specific Rules', () => {
    const defaultConsent: ConsentState = {
      taking_part: true,
      methods: { ring: true, camera: true },
      rule_check: true,
    };
    const offConsent: ConsentState = {
      taking_part: false,
      methods: { ring: false, camera: false },
      rule_check: false,
    };

    describe('Rule 1: Patient reading own data whatever switches say', () => {
      const patientActor: Actor = { kind: 'patient', patientId: 'p1', clinicId: 'c1' };

      const allowedKinds: DataKind[] = [
        'answers',
        'rounds',
        'readings',
        'baselines',
        'consent',
        'suggestions',
        'flags',
        'crisis_messages',
        'call_outcomes',
        'patient_record',
      ];

      it.each(allowedKinds)('patient may read own %s for self_access even when taking_part is off', (kind) => {
        const res = decideAccess({
          actor: patientActor,
          action: 'read',
          target: { kind, patientId: 'p1', clinicId: 'c1', method: kind === 'readings' ? 'ring' : undefined },
          purpose: 'self_access',
          consent: offConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(true);
          expect(res.value.reason).toBe('allowed');
          expect(res.value.log).toBe(false);
        }
      });

      it('patient cannot read another patient data', () => {
        const res = decideAccess({
          actor: patientActor,
          action: 'read',
          target: { kind: 'answers', patientId: 'p2', clinicId: 'c1' },
          purpose: 'self_access',
          consent: defaultConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(false);
          expect(res.value.reason).toBe('not_own_data');
        }
      });

      it('patient reading own data with invalid purpose is refused with disallowed_action', () => {
        const res = decideAccess({
          actor: patientActor,
          action: 'read',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: defaultConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(false);
          expect(res.value.reason).toBe('disallowed_action');
        }
      });

      const forbiddenPatientKinds: DataKind[] = [
        'staff_accounts',
        'access_log',
        'enrolment_codes',
        'rule_check_dataset',
      ];

      it.each(forbiddenPatientKinds)('patient can never read %s', (kind) => {
        const res = decideAccess({
          actor: patientActor,
          action: 'read',
          target: { kind, patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access',
          consent: defaultConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(false);
          expect(res.value.reason).toBe('patient_forbidden_data');
        }
      });
    });

    describe('Rule 2: Patient writes and deletes', () => {
      const patientActor: Actor = { kind: 'patient', patientId: 'p1', clinicId: 'c1' };

      it('patient may write answers only while taking_part is on', () => {
        const resAllowed = decideAccess({
          actor: patientActor,
          action: 'write',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access',
          consent: defaultConsent,
        });
        expect(resAllowed.ok).toBe(true);
        if (resAllowed.ok) {
          expect(resAllowed.value.allowed).toBe(true);
          expect(resAllowed.value.reason).toBe('allowed');
          expect(resAllowed.value.log).toBe(false);
        }

        const resRefused = decideAccess({
          actor: patientActor,
          action: 'write',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access',
          consent: offConsent,
        });
        expect(resRefused.ok).toBe(true);
        if (resRefused.ok) {
          expect(resRefused.value.allowed).toBe(false);
          expect(resRefused.value.reason).toBe('consent_required');
          expect(resRefused.value.log).toBe(false);
        }
      });

      it('patient may write consent always', () => {
        const res = decideAccess({
          actor: patientActor,
          action: 'write',
          target: { kind: 'consent', patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access',
          consent: offConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(true);
          expect(res.value.reason).toBe('allowed');
          expect(res.value.log).toBe(false);
        }
      });

      it('patient may write readings for method:<name> only while taking_part and method switch are on', () => {
        const resOn = decideAccess({
          actor: patientActor,
          action: 'write',
          target: { kind: 'readings', patientId: 'p1', clinicId: 'c1', method: 'ring' },
          purpose: 'method:ring',
          consent: { taking_part: true, methods: { ring: true, camera: false }, rule_check: false },
        });
        expect(resOn.ok).toBe(true);
        if (resOn.ok) {
          expect(resOn.value.allowed).toBe(true);
          expect(resOn.value.reason).toBe('allowed');
        }

        const resOff = decideAccess({
          actor: patientActor,
          action: 'write',
          target: { kind: 'readings', patientId: 'p1', clinicId: 'c1', method: 'ring' },
          purpose: 'method:ring',
          consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: false },
        });
        expect(resOff.ok).toBe(true);
        if (resOff.ok) {
          expect(resOff.value.allowed).toBe(false);
          expect(resOff.value.reason).toBe('consent_required');
        }
      });

      it('patient writing readings with mismatched method is refused with method_mismatch', () => {
        const res = decideAccess({
          actor: patientActor,
          action: 'write',
          target: { kind: 'readings', patientId: 'p1', clinicId: 'c1', method: 'ring' },
          purpose: 'method:camera',
          consent: defaultConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(false);
          expect(res.value.reason).toBe('method_mismatch');
        }
      });

      const deletableKinds: DataKind[] = [
        'answers',
        'rounds',
        'readings',
        'baselines',
        'suggestions',
        'consent',
      ];

      it.each(deletableKinds)('patient may delete own %s for self_access always, logged', (kind) => {
        const res = decideAccess({
          actor: patientActor,
          action: 'delete',
          target: { kind, patientId: 'p1', clinicId: 'c1', method: kind === 'readings' ? 'ring' : undefined },
          purpose: 'self_access',
          consent: offConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(true);
          expect(res.value.reason).toBe('allowed');
          expect(res.value.log).toBe(true); // deletion must be logged
        }
      });

      it('patient cannot delete flags or crisis_messages', () => {
        const resFlags = decideAccess({
          actor: patientActor,
          action: 'delete',
          target: { kind: 'flags', patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access',
          consent: defaultConsent,
        });
        expect(resFlags.ok).toBe(true);
        if (resFlags.ok) {
          expect(resFlags.value.allowed).toBe(false);
          expect(resFlags.value.reason).toBe('disallowed_action');
          expect(resFlags.value.log).toBe(true); // delete attempt is logged
        }
      });
    });

    describe('Rule 3: Clinic staff data boundaries', () => {
      it('clinic staff acting on another clinic data is refused with other_clinic reason code', () => {
        const nurse: Actor = { kind: 'staff', staffId: 's1', clinicId: 'c1', role: 'nurse' };
        const res = decideAccess({
          actor: nurse,
          action: 'read',
          target: { kind: 'flags', patientId: 'p1', clinicId: 'c2' },
          purpose: 'care',
          consent: defaultConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(false);
          expect(res.value.reason).toBe('other_clinic');
          expect(res.value.log).toBe(true); // staff on patient data must be logged
        }
      });
    });

    describe('Rule 4: Nurse or admin care and administration actions', () => {
      const nurse: Actor = { kind: 'staff', staffId: 's1', clinicId: 'c1', role: 'nurse' };

      it('reading flags requires taking_part to be on', () => {
        const resOn = decideAccess({
          actor: nurse,
          action: 'read',
          target: { kind: 'flags', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: defaultConsent,
        });
        expect(resOn.ok).toBe(true);
        if (resOn.ok) {
          expect(resOn.value.allowed).toBe(true);
          expect(resOn.value.log).toBe(true);
        }

        const resOff = decideAccess({
          actor: nurse,
          action: 'read',
          target: { kind: 'flags', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: offConsent,
        });
        expect(resOff.ok).toBe(true);
        if (resOff.ok) {
          expect(resOff.value.allowed).toBe(false);
          expect(resOff.value.reason).toBe('consent_required');
          expect(resOff.value.log).toBe(true);
        }
      });

      it('reading crisis_messages and patient_record does not depend on taking_part', () => {
        const resCrisis = decideAccess({
          actor: nurse,
          action: 'read',
          target: { kind: 'crisis_messages', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: offConsent,
        });
        expect(resCrisis.ok).toBe(true);
        if (resCrisis.ok) {
          expect(resCrisis.value.allowed).toBe(true);
          expect(resCrisis.value.log).toBe(true);
        }

        const resRecord = decideAccess({
          actor: nurse,
          action: 'read',
          target: { kind: 'patient_record', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: offConsent,
        });
        expect(resRecord.ok).toBe(true);
        if (resRecord.ok) {
          expect(resRecord.value.allowed).toBe(true);
          expect(resRecord.value.log).toBe(true);
        }
      });

      it('writing call_outcomes requires taking_part', () => {
        const res = decideAccess({
          actor: nurse,
          action: 'write',
          target: { kind: 'call_outcomes', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: offConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(false);
          expect(res.value.reason).toBe('consent_required');
          expect(res.value.log).toBe(true);
        }
      });

      it('writing crisis_messages does not depend on taking_part', () => {
        const res = decideAccess({
          actor: nurse,
          action: 'write',
          target: { kind: 'crisis_messages', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: offConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(true);
          expect(res.value.log).toBe(true);
        }
      });

      it('writing patient_record and enrolment_codes for administration does not depend on taking_part', () => {
        const resRec = decideAccess({
          actor: nurse,
          action: 'write',
          target: { kind: 'patient_record', patientId: 'p1', clinicId: 'c1' },
          purpose: 'administration',
          consent: offConsent,
        });
        expect(resRec.ok).toBe(true);
        if (resRec.ok) {
          expect(resRec.value.allowed).toBe(true);
          expect(resRec.value.log).toBe(true);
        }

        const resEnrol = decideAccess({
          actor: nurse,
          action: 'write',
          target: { kind: 'enrolment_codes', patientId: 'p1', clinicId: 'c1' },
          purpose: 'administration',
          consent: offConsent,
        });
        expect(resEnrol.ok).toBe(true);
        if (resEnrol.ok) {
          expect(resEnrol.value.allowed).toBe(true);
          expect(resEnrol.value.log).toBe(true);
        }
      });
    });

    describe('Rule 5: Clinic staff NEVER access answers, rounds, readings, baselines, suggestions', () => {
      const sensitiveKinds: DataKind[] = [
        'answers',
        'rounds',
        'readings',
        'baselines',
        'suggestions',
      ];
      const roles: StaffRole[] = ['nurse', 'admin'];
      const actions: Action[] = ['read', 'write', 'delete'];

      for (const role of roles) {
        for (const kind of sensitiveKinds) {
          for (const action of actions) {
            it(`clinic ${role} may NEVER ${action} ${kind} under any switch or purpose`, () => {
              const res = decideAccess({
                actor: { kind: 'staff', staffId: 's1', clinicId: 'c1', role },
                action,
                target: { kind, patientId: 'p1', clinicId: 'c1', method: kind === 'readings' ? 'ring' : undefined },
                purpose: 'care',
                consent: defaultConsent,
              });
              expect(res.ok).toBe(true);
              if (res.ok) {
                expect(res.value.allowed).toBe(false);
                expect(res.value.reason).toBe('clinic_staff_forbidden_clinical_data');
                expect(res.value.log).toBe(true);
              }
            });
          }
        }
      }
    });

    describe('Rule 6: Staff accounts and access log access', () => {
      const nurse: Actor = { kind: 'staff', staffId: 's1', clinicId: 'c1', role: 'nurse' };
      const admin: Actor = { kind: 'staff', staffId: 's2', clinicId: 'c1', role: 'admin' };

      it('admin may read and write staff_accounts for administration', () => {
        const resRead = decideAccess({
          actor: admin,
          action: 'read',
          target: { kind: 'staff_accounts', clinicId: 'c1' },
          purpose: 'administration',
        });
        expect(resRead.ok).toBe(true);
        if (resRead.ok) {
          expect(resRead.value.allowed).toBe(true);
          expect(resRead.value.log).toBe(false);
        }

        const resWrite = decideAccess({
          actor: admin,
          action: 'write',
          target: { kind: 'staff_accounts', clinicId: 'c1' },
          purpose: 'administration',
        });
        expect(resWrite.ok).toBe(true);
        if (resWrite.ok) {
          expect(resWrite.value.allowed).toBe(true);
          expect(resWrite.value.log).toBe(false);
        }
      });

      it('nurse cannot read or write staff_accounts', () => {
        const res = decideAccess({
          actor: nurse,
          action: 'read',
          target: { kind: 'staff_accounts', clinicId: 'c1' },
          purpose: 'administration',
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(false);
          expect(res.value.reason).toBe('admin_only');
        }
      });

      it('admin may read access_log of own clinic for administration', () => {
        const res = decideAccess({
          actor: admin,
          action: 'read',
          target: { kind: 'access_log', clinicId: 'c1' },
          purpose: 'administration',
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(true);
          expect(res.value.log).toBe(false);
        }
      });

      it('nobody may write or delete access_log for every actor', () => {
        const allActors: Actor[] = [
          { kind: 'patient', patientId: 'p1', clinicId: 'c1' },
          { kind: 'staff', staffId: 's1', clinicId: 'c1', role: 'nurse' },
          { kind: 'staff', staffId: 's2', clinicId: 'c1', role: 'admin' },
          { kind: 'system' },
        ];
        const writeDeleteActions: Action[] = ['write', 'delete'];

        for (const actor of allActors) {
          for (const action of writeDeleteActions) {
            const res = decideAccess({
              actor,
              action,
              target: { kind: 'access_log', clinicId: 'c1', patientId: 'p1' },
              purpose: actor.kind === 'patient' ? 'self_access' : 'administration',
              consent: defaultConsent,
            });
            expect(res.ok).toBe(true);
            if (res.ok) {
              expect(res.value.allowed).toBe(false);
              expect(res.value.reason).toBe('access_log_immutable');
              if (action === 'delete') {
                expect(res.value.log).toBe(true); // deletion is logged
              }
            }
          }
        }
      });
    });

    describe('Rule 7: System actions', () => {
      const systemActor: Actor = { kind: 'system' };

      it('system reads answers, rounds, baselines for care while taking_part is on', () => {
        const res = decideAccess({
          actor: systemActor,
          action: 'read',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: defaultConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(true);
          expect(res.value.log).toBe(false);
        }
      });

      it('system cannot read answers for care while taking_part is off', () => {
        const res = decideAccess({
          actor: systemActor,
          action: 'read',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: offConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(false);
          expect(res.value.reason).toBe('consent_required');
          expect(res.value.log).toBe(false);
        }
      });

      it('system writes baselines, flags, crisis_messages, suggestions for care while taking_part is on', () => {
        const kinds: DataKind[] = ['baselines', 'flags', 'crisis_messages', 'suggestions'];
        for (const kind of kinds) {
          const res = decideAccess({
            actor: systemActor,
            action: 'write',
            target: { kind, patientId: 'p1', clinicId: 'c1' },
            purpose: 'care',
            consent: defaultConsent,
          });
          expect(res.ok).toBe(true);
          if (res.ok) {
            expect(res.value.allowed).toBe(true);
            expect(res.value.log).toBe(false);
          }
        }
      });

      it('system reads readings of a method only when taking_part and that method switch are on', () => {
        const resAllowed = decideAccess({
          actor: systemActor,
          action: 'read',
          target: { kind: 'readings', patientId: 'p1', clinicId: 'c1', method: 'camera' },
          purpose: 'method:camera',
          consent: { taking_part: true, methods: { ring: false, camera: true }, rule_check: false },
        });
        expect(resAllowed.ok).toBe(true);
        if (resAllowed.ok) {
          expect(resAllowed.value.allowed).toBe(true);
          expect(resAllowed.value.log).toBe(false);
        }

        const resRefused = decideAccess({
          actor: systemActor,
          action: 'read',
          target: { kind: 'readings', patientId: 'p1', clinicId: 'c1', method: 'camera' },
          purpose: 'method:camera',
          consent: { taking_part: true, methods: { ring: true, camera: false }, rule_check: false },
        });
        expect(resRefused.ok).toBe(true);
        if (resRefused.ok) {
          expect(resRefused.value.allowed).toBe(false);
          expect(resRefused.value.reason).toBe('consent_required');
        }
      });

      it('system reading readings with mismatched method is refused with method_mismatch', () => {
        const res = decideAccess({
          actor: systemActor,
          action: 'read',
          target: { kind: 'readings', patientId: 'p1', clinicId: 'c1', method: 'ring' },
          purpose: 'method:camera',
          consent: defaultConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.allowed).toBe(false);
          expect(res.value.reason).toBe('method_mismatch');
        }
      });

      it('system reads rule_check_dataset for rule_check only while taking_part and rule_check are on', () => {
        const resAllowed = decideAccess({
          actor: systemActor,
          action: 'read',
          target: { kind: 'rule_check_dataset', patientId: 'p1', clinicId: 'c1' },
          purpose: 'rule_check',
          consent: defaultConsent,
        });
        expect(resAllowed.ok).toBe(true);
        if (resAllowed.ok) {
          expect(resAllowed.value.allowed).toBe(true);
          expect(resAllowed.value.log).toBe(true); // rule_check read must be logged
        }

        const resRefused = decideAccess({
          actor: systemActor,
          action: 'read',
          target: { kind: 'rule_check_dataset', patientId: 'p1', clinicId: 'c1' },
          purpose: 'rule_check',
          consent: { taking_part: true, methods: { ring: true, camera: true }, rule_check: false },
        });
        expect(resRefused.ok).toBe(true);
        if (resRefused.ok) {
          expect(resRefused.value.allowed).toBe(false);
          expect(resRefused.value.reason).toBe('consent_required');
          expect(resRefused.value.log).toBe(true); // attempted rule_check read must be logged
        }
      });
    });

    describe('Rule 8: Access Logging rules', () => {
      it('logs all clinic staff attempts on patient data (allowed or refused)', () => {
        const nurse: Actor = { kind: 'staff', staffId: 's1', clinicId: 'c1', role: 'nurse' };

        // Allowed staff access on patient data
        const resAllowed = decideAccess({
          actor: nurse,
          action: 'read',
          target: { kind: 'flags', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: defaultConsent,
        });
        expect(resAllowed.ok).toBe(true);
        if (resAllowed.ok) expect(resAllowed.value.log).toBe(true);

        // Refused staff access on patient data (e.g. answers)
        const resRefused = decideAccess({
          actor: nurse,
          action: 'read',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: defaultConsent,
        });
        expect(resRefused.ok).toBe(true);
        if (resRefused.ok) expect(resRefused.value.log).toBe(true);
      });

      it('does not log ordinary patient reads and writes of their own data', () => {
        const patient: Actor = { kind: 'patient', patientId: 'p1', clinicId: 'c1' };

        const resRead = decideAccess({
          actor: patient,
          action: 'read',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access',
          consent: defaultConsent,
        });
        expect(resRead.ok).toBe(true);
        if (resRead.ok) expect(resRead.value.log).toBe(false);

        const resWrite = decideAccess({
          actor: patient,
          action: 'write',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access',
          consent: defaultConsent,
        });
        expect(resWrite.ok).toBe(true);
        if (resWrite.ok) expect(resWrite.value.log).toBe(false);
      });

      it('does not log system care work', () => {
        const res = decideAccess({
          actor: { kind: 'system' },
          action: 'read',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: defaultConsent,
        });
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.value.log).toBe(false);
      });

      it('logs every delete by anyone', () => {
        const patient: Actor = { kind: 'patient', patientId: 'p1', clinicId: 'c1' };
        const resPatientDelete = decideAccess({
          actor: patient,
          action: 'delete',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access',
          consent: defaultConsent,
        });
        expect(resPatientDelete.ok).toBe(true);
        if (resPatientDelete.ok) expect(resPatientDelete.value.log).toBe(true);

        const resSystemDelete = decideAccess({
          actor: { kind: 'system' },
          action: 'delete',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
          consent: defaultConsent,
        });
        expect(resSystemDelete.ok).toBe(true);
        if (resSystemDelete.ok) expect(resSystemDelete.value.log).toBe(true);
      });
    });

    describe('One way in, one answer out', () => {
      const validActor: Actor = { kind: 'patient', patientId: 'p1', clinicId: 'c1' };
      const validConsent: ConsentState = {
        taking_part: true,
        methods: { ring: true, camera: true },
        rule_check: true,
      };

      it('returns exactly one result shape: { ok: true, value: { allowed, reason, log } } without redundant top-level properties', () => {
        const res = decideAccess({
          actor: validActor,
          action: 'read',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access',
          consent: validConsent,
        });

        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(Object.keys(res).sort()).toEqual(['ok', 'value']);
          expect(Object.keys(res.value).sort()).toEqual(['allowed', 'log', 'reason']);
          const resRecord: Record<string, unknown> = res;
          expect(resRecord.decision).toBeUndefined();
          expect(resRecord.allowed).toBeUndefined();
          expect(resRecord.reason).toBeUndefined();
          expect(resRecord.log).toBeUndefined();
        }
      });

      it('only accepts a single request object, rejecting positional argument calls', () => {
        const fn: (...args: unknown[]) => unknown = decideAccess;
        const res = fn(
          validActor,
          'read',
          { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          'self_access',
          validConsent
        ) as AccessResult;
        expect(res.ok).toBe(false);
      });
    });

    describe('Rule 9: Input Validation', () => {
      const validActor: Actor = { kind: 'patient', patientId: 'p1', clinicId: 'c1' };

      it('refuses unknown data kind with an error result', () => {
        const res = decideAccess({
          actor: validActor,
          action: 'read',
          target: { kind: 'unknown_kind' as unknown as DataKind, patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access',
        });
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(typeof res.error).toBe('string');
        }
      });

      it('refuses unknown action with an error result', () => {
        const res = decideAccess({
          actor: validActor,
          action: 'update' as unknown as Action,
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access',
        });
        expect(res.ok).toBe(false);
      });

      it('refuses unknown staff role with an error result', () => {
        const res = decideAccess({
          actor: { kind: 'staff', staffId: 's1', clinicId: 'c1', role: 'doctor' as unknown as StaffRole },
          action: 'read',
          target: { kind: 'flags', patientId: 'p1', clinicId: 'c1' },
          purpose: 'care',
        });
        expect(res.ok).toBe(false);
      });

      it('refuses unknown purpose with an error result', () => {
        const res = decideAccess({
          actor: validActor,
          action: 'read',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'commercial_use' as Purpose,
        });
        expect(res.ok).toBe(false);
      });

      it('refuses method: purpose without a known method', () => {
        const res = decideAccess({
          actor: validActor,
          action: 'read',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'method:gps' as Purpose,
        });
        expect(res.ok).toBe(false);
      });

      it('refuses readings request without a method', () => {
        const res = decideAccess({
          actor: validActor,
          action: 'read',
          target: { kind: 'readings', patientId: 'p1', clinicId: 'c1' }, // method missing!
          purpose: 'self_access',
        });
        expect(res.ok).toBe(false);
      });

      it('refuses missing actor IDs with an error result', () => {
        const res = decideAccess({
          actor: { kind: 'patient', patientId: '', clinicId: 'c1' },
          action: 'read',
          target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access',
        });
        expect(res.ok).toBe(false);
      });

      it('refuses missing target IDs with an error result', () => {
        const res = decideAccess({
          actor: validActor,
          action: 'read',
          target: { kind: 'answers', patientId: 'p1' }, // missing clinicId
          purpose: 'self_access',
        });
        expect(res.ok).toBe(false);
      });

      describe('Strict Consent Validation', () => {
        const baseRequest = {
          actor: validActor,
          action: 'read' as Action,
          target: { kind: 'answers' as DataKind, patientId: 'p1', clinicId: 'c1' },
          purpose: 'self_access' as Purpose,
        };

        const validConsent: ConsentState = {
          taking_part: true,
          methods: { ring: true, camera: true },
          rule_check: true,
        };

        it('refuses whole consent given as null', () => {
          const res = decideAccess({ ...baseRequest, consent: null as unknown as ConsentState });
          expect(res.ok).toBe(false);
        });

        it('refuses whole consent given as a string', () => {
          const res = decideAccess({ ...baseRequest, consent: 'consent_state' as unknown as ConsentState });
          expect(res.ok).toBe(false);
        });

        it('refuses whole consent given as an array', () => {
          const res = decideAccess({ ...baseRequest, consent: [] as unknown as ConsentState });
          expect(res.ok).toBe(false);
        });

        it('refuses methods given as an array', () => {
          const consent = { ...validConsent, methods: ['ring', 'camera'] as unknown as Record<string, boolean> };
          const res = decideAccess({ ...baseRequest, consent: consent as unknown as ConsentState });
          expect(res.ok).toBe(false);
        });

        it('refuses methods with an extra unknown method', () => {
          const consent = {
            ...validConsent,
            methods: { ring: true, camera: true, microphone: true } as unknown as Record<string, boolean>,
          };
          const res = decideAccess({ ...baseRequest, consent: consent as unknown as ConsentState });
          expect(res.ok).toBe(false);
        });

        const invalidValues: { name: string; value: unknown }[] = [
          { name: 'the text "false"', value: 'false' },
          { name: 'the text "true"', value: 'true' },
          { name: '1', value: 1 },
          { name: '0', value: 0 },
          { name: 'null', value: null },
          { name: 'undefined', value: undefined },
        ];

        const switches = ['taking_part', 'rule_check', 'ring', 'camera'] as const;

        for (const sw of switches) {
          for (const inv of invalidValues) {
            it(`refuses ${sw} switch when set to ${inv.name}`, () => {
              let consent: Record<string, unknown>;
              if (sw === 'taking_part') {
                consent = { ...validConsent, taking_part: inv.value };
              } else if (sw === 'rule_check') {
                consent = { ...validConsent, rule_check: inv.value };
              } else {
                consent = {
                  ...validConsent,
                  methods: { ...validConsent.methods, [sw]: inv.value },
                };
              }
              const res = decideAccess({ ...baseRequest, consent: consent as unknown as ConsentState });
              expect(res.ok).toBe(false);
            });
          }

          it(`refuses ${sw} switch when key is missing`, () => {
            const consent: Record<string, unknown> = {
              taking_part: validConsent.taking_part,
              methods: { ...validConsent.methods },
              rule_check: validConsent.rule_check,
            };
            if (sw === 'taking_part') {
              delete consent.taking_part;
            } else if (sw === 'rule_check') {
              delete consent.rule_check;
            } else {
              const methodsObj = { ...validConsent.methods };
              delete (methodsObj as Record<string, unknown>)[sw];
              consent.methods = methodsObj;
            }
            const res = decideAccess({ ...baseRequest, consent: consent as unknown as ConsentState });
            expect(res.ok).toBe(false);
          });
        }

        it('property check: for thousands of requests where any consent switch is not boolean, result is never allowed', () => {
          const lcg = (seed = 99991) => {
            let s = seed >>> 0;
            return () => {
              s = (Math.imul(1664525, s) + 1013904223) >>> 0;
              return s / 4294967296;
            };
          };
          const rand = lcg();

          const nonBooleanValues = [
            'false',
            'true',
            'yes',
            'no',
            0,
            1,
            -1,
            null,
            undefined,
            {},
            [],
            NaN,
            Infinity,
          ];

          for (let i = 0; i < 3000; i++) {
            const badSwitch = switches[Math.floor(rand() * switches.length)];
            const badVal = nonBooleanValues[Math.floor(rand() * nonBooleanValues.length)];

            const consent: Record<string, unknown> = {
              taking_part: true,
              methods: { ring: true, camera: true },
              rule_check: true,
            };

            if (badSwitch === 'taking_part') {
              consent.taking_part = badVal;
            } else if (badSwitch === 'rule_check') {
              consent.rule_check = badVal;
            } else {
              const methodsRecord = consent.methods as Record<string, unknown>;
              methodsRecord[badSwitch] = badVal;
            }

            const res = decideAccess({
              actor: validActor,
              action: 'read',
              target: { kind: 'answers', patientId: 'p1', clinicId: 'c1' },
              purpose: 'self_access',
              consent: consent as unknown as ConsentState,
            });

            // Must never be an allowed decision
            expect(res.ok).toBe(false);
          }
        });
      });
    });
  });

  describe('Property-style Invariant Checks (Seeded Pseudo-Random Loop)', () => {
    function makeLcg(seed = 424242) {
      let s = seed >>> 0;
      return () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 4294967296;
      };
    }

    const prng = makeLcg();

    function pickRandom<T>(items: readonly T[]): T {
      const idx = Math.floor(prng() * items.length);
      return items[idx];
    }

    const actions: Action[] = ['read', 'write', 'delete'];
    const dataKinds: DataKind[] = [
      'answers',
      'rounds',
      'readings',
      'baselines',
      'consent',
      'suggestions',
      'flags',
      'crisis_messages',
      'call_outcomes',
      'patient_record',
      'enrolment_codes',
      'staff_accounts',
      'access_log',
      'rule_check_dataset',
    ];
    const purposes: Purpose[] = [
      'self_access',
      'care',
      'method:ring',
      'method:camera',
      'rule_check',
      'administration',
    ];

    it('asserts 4 invariants hold across 5000 generated requests', () => {
      const iterations = 5000;

      for (let i = 0; i < iterations; i++) {
        const actorKind = pickRandom(['patient', 'staff', 'system'] as const);
        const action = pickRandom(actions);
        const kind = pickRandom(dataKinds);
        const purpose = pickRandom(purposes);

        const sameClinic = prng() > 0.5;
        const samePatient = prng() > 0.5;

        const actorClinicId = 'cli_A';
        const targetClinicId = sameClinic ? 'cli_A' : 'cli_B';
        const actorPatientId = 'pat_1';
        const targetPatientId = samePatient ? 'pat_1' : 'pat_2';

        let actor: Actor;
        if (actorKind === 'patient') {
          actor = { kind: 'patient', patientId: actorPatientId, clinicId: actorClinicId };
        } else if (actorKind === 'staff') {
          const role: StaffRole = prng() > 0.5 ? 'nurse' : 'admin';
          actor = { kind: 'staff', staffId: 'st_1', clinicId: actorClinicId, role };
        } else {
          actor = { kind: 'system' };
        }

        const consent: ConsentState = {
          taking_part: prng() > 0.5,
          methods: {
            ring: prng() > 0.5,
            camera: prng() > 0.5,
          },
          rule_check: prng() > 0.5,
        };

        const targetMethod = kind === 'readings' ? (prng() > 0.5 ? 'ring' : 'camera') : undefined;

        const request: AccessRequest = {
          actor,
          action,
          target: {
            kind,
            clinicId: targetClinicId,
            patientId: targetPatientId,
            method: targetMethod,
          },
          purpose,
          consent,
        };

        const result = decideAccess(request);
        expect(result.ok).toBe(true);
        if (!result.ok) continue;

        // Invariant 1: clinic staff are never allowed on answers, rounds, readings, baselines or suggestions
        const clinicalKinds: DataKind[] = ['answers', 'rounds', 'readings', 'baselines', 'suggestions'];
        if (actor.kind === 'staff' && clinicalKinds.includes(kind)) {
          expect(result.value.allowed).toBe(false);
          expect(result.value.reason).toBe('clinic_staff_forbidden_clinical_data');
        }

        // Invariant 2: a request for another clinic's or another patient's data is never allowed
        // (For patient actor: must match own clinic and patient; for staff actor: must match own clinic)
        if (actor.kind === 'patient' && (!sameClinic || !samePatient)) {
          expect(result.value.allowed).toBe(false);
        }
        if (actor.kind === 'staff' && !sameClinic) {
          expect(result.value.allowed).toBe(false);
          const isAccessLogWriteOrDelete =
            kind === 'access_log' && (action === 'write' || action === 'delete');
          if (!clinicalKinds.includes(kind) && !isAccessLogWriteOrDelete) {
            expect(result.value.reason).toBe('other_clinic');
          }
        }

        // Invariant 3: nobody is allowed to write or delete the access_log
        if (kind === 'access_log' && (action === 'write' || action === 'delete')) {
          expect(result.value.allowed).toBe(false);
          expect(result.value.reason).toBe('access_log_immutable');
        }

        // Invariant 4: every decision for clinic staff on patient data has log true
        const isPatientData =
          kind !== 'staff_accounts' && kind !== 'access_log' && kind !== 'rule_check_dataset';
        if (actor.kind === 'staff' && isPatientData) {
          expect(result.value.log).toBe(true);
        }
      }
    });
  });
});
