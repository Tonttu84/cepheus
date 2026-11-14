import type {
  Actor,
  Action,
  DataKind,
  TargetData,
  Purpose,
  AccessRequest,
} from './types';
import type { ConsentState, MeasuringMethod } from '../consent';
import { INITIAL_CONSENT_STATE } from '../consent';

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const VALID_ACTIONS: ReadonlySet<string> = new Set(['read', 'write', 'delete']);

const VALID_DATA_KINDS: ReadonlySet<string> = new Set([
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
]);

const VALID_METHODS: ReadonlySet<string> = new Set(['ring', 'camera']);

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

export function validateActor(input: unknown): ValidationResult<Actor> {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Actor must be an object' };
  }
  const obj = input as Record<string, unknown>;
  const kind = obj.kind ?? obj.type;

  if (kind === 'patient') {
    if (!isNonEmptyString(obj.patientId)) {
      return { ok: false, error: 'Patient actor requires a non-empty patientId' };
    }
    if (!isNonEmptyString(obj.clinicId)) {
      return { ok: false, error: 'Patient actor requires a non-empty clinicId' };
    }
    return {
      ok: true,
      value: { kind: 'patient', patientId: obj.patientId, clinicId: obj.clinicId },
    };
  }

  if (kind === 'staff') {
    if (!isNonEmptyString(obj.staffId)) {
      return { ok: false, error: 'Staff actor requires a non-empty staffId' };
    }
    if (!isNonEmptyString(obj.clinicId)) {
      return { ok: false, error: 'Staff actor requires a non-empty clinicId' };
    }
    if (obj.role !== 'nurse' && obj.role !== 'admin') {
      return { ok: false, error: 'Staff actor role must be nurse or admin' };
    }
    return {
      ok: true,
      value: {
        kind: 'staff',
        staffId: obj.staffId,
        clinicId: obj.clinicId,
        role: obj.role,
      },
    };
  }

  if (kind === 'system') {
    return { ok: true, value: { kind: 'system' } };
  }

  return { ok: false, error: 'Actor kind must be patient, staff, or system' };
}

export function validateTarget(input: unknown): ValidationResult<TargetData> {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Target data must be an object' };
  }
  const obj = input as Record<string, unknown>;

  if (typeof obj.kind !== 'string' || !VALID_DATA_KINDS.has(obj.kind)) {
    return { ok: false, error: `Unknown data kind: ${String(obj.kind)}` };
  }
  const kind = obj.kind as DataKind;

  if (!isNonEmptyString(obj.clinicId)) {
    return { ok: false, error: `Target ${kind} requires a non-empty clinicId` };
  }

  const isClinicOnly = kind === 'staff_accounts' || kind === 'access_log';
  if (!isClinicOnly && !isNonEmptyString(obj.patientId)) {
    return { ok: false, error: `Target ${kind} requires a non-empty patientId` };
  }

  if (kind === 'readings') {
    if (typeof obj.method !== 'string' || !VALID_METHODS.has(obj.method)) {
      return { ok: false, error: 'Target readings requires a known method (ring or camera)' };
    }
  }

  return {
    ok: true,
    value: {
      kind,
      clinicId: obj.clinicId,
      patientId: typeof obj.patientId === 'string' ? obj.patientId : undefined,
      method: typeof obj.method === 'string' ? (obj.method as MeasuringMethod) : undefined,
    },
  };
}

export function validatePurpose(input: unknown): ValidationResult<Purpose> {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Purpose must be a string' };
  }

  if (input === 'self_access' || input === 'care' || input === 'rule_check' || input === 'administration') {
    return { ok: true, value: input };
  }

  if (input.startsWith('method:')) {
    const methodName = input.slice('method:'.length);
    if (VALID_METHODS.has(methodName)) {
      return { ok: true, value: input };
    }
    return { ok: false, error: `Unknown measuring method in purpose: ${methodName}` };
  }

  return { ok: false, error: `Unknown access purpose: ${input}` };
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return (
    typeof val === 'object' &&
    val !== null &&
    !Array.isArray(val) &&
    Object.prototype.toString.call(val) === '[object Object]'
  );
}

export function validateConsent(input: unknown): ValidationResult<ConsentState> {
  if (!isPlainObject(input)) {
    return { ok: false, error: 'Consent must be a plain object' };
  }

  if (typeof input.taking_part !== 'boolean') {
    return { ok: false, error: 'Consent taking_part must be a boolean' };
  }

  if (typeof input.rule_check !== 'boolean') {
    return { ok: false, error: 'Consent rule_check must be a boolean' };
  }

  if (!isPlainObject(input.methods)) {
    return { ok: false, error: 'Consent methods must be a plain object' };
  }

  const methodsKeys = Object.keys(input.methods);
  for (const m of methodsKeys) {
    if (!VALID_METHODS.has(m)) {
      return { ok: false, error: `Unknown measuring method in consent: ${m}` };
    }
  }

  for (const m of VALID_METHODS) {
    if (typeof input.methods[m] !== 'boolean') {
      return { ok: false, error: `Consent method ${m} must be a boolean` };
    }
  }

  return {
    ok: true,
    value: {
      taking_part: input.taking_part,
      methods: {
        ring: input.methods.ring as boolean,
        camera: input.methods.camera as boolean,
      },
      rule_check: input.rule_check,
    },
  };
}

export function validateAccessRequest(
  input: unknown
): ValidationResult<AccessRequest> {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Access request must be an object' };
  }
  const obj = input as Record<string, unknown>;

  const actorRes = validateActor(obj.actor);
  if (!actorRes.ok) return actorRes;

  if (typeof obj.action !== 'string' || !VALID_ACTIONS.has(obj.action)) {
    return { ok: false, error: `Unknown access action: ${String(obj.action)}` };
  }

  const targetRes = validateTarget(obj.target ?? obj.data);
  if (!targetRes.ok) return targetRes;

  const purposeRes = validatePurpose(obj.purpose);
  if (!purposeRes.ok) return purposeRes;

  const rawConsent = obj.consent;
  let consent: ConsentState;
  if (rawConsent === undefined) {
    consent = INITIAL_CONSENT_STATE;
  } else {
    const consentRes = validateConsent(rawConsent);
    if (!consentRes.ok) return consentRes;
    consent = consentRes.value;
  }

  return {
    ok: true,
    value: {
      actor: actorRes.value,
      action: obj.action as Action,
      target: targetRes.value,
      purpose: purposeRes.value,
      consent,
    },
  };
}
