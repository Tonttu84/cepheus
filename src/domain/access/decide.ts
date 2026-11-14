import type {
  Actor,
  Action,
  DataKind,
  TargetData,
  Purpose,
  AccessReasonCode,
  AccessDecision,
  AccessResult,
  PatientActor,
  StaffActor,
} from './types';
import { validateAccessRequest } from './validation';
import {
  isPurposeAllowed,
  INITIAL_CONSENT_STATE,
  type ConsentState,
  type ConsentPurpose,
} from '../consent';

const CLINICAL_DATA_KINDS: ReadonlySet<DataKind> = new Set([
  'answers',
  'rounds',
  'readings',
  'baselines',
  'suggestions',
]);

const PATIENT_READ_KINDS: ReadonlySet<DataKind> = new Set([
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
]);

const PATIENT_FORBIDDEN_KINDS: ReadonlySet<DataKind> = new Set([
  'staff_accounts',
  'access_log',
  'enrolment_codes',
  'rule_check_dataset',
]);

const PATIENT_DELETE_KINDS: ReadonlySet<DataKind> = new Set([
  'answers',
  'rounds',
  'readings',
  'baselines',
  'suggestions',
  'consent',
]);

export function isPatientDataKind(kind: DataKind): boolean {
  return (
    kind !== 'staff_accounts' &&
    kind !== 'access_log' &&
    kind !== 'rule_check_dataset'
  );
}

export function shouldLogAccess(
  actor: Actor,
  action: Action,
  target: TargetData,
  purpose: Purpose
): boolean {
  if (action === 'delete') return true;
  if (actor.kind === 'staff' && isPatientDataKind(target.kind)) return true;
  if (actor.kind === 'system' && purpose === 'rule_check' && action === 'read') return true;
  return false;
}

function evaluatePatientRules(
  actor: PatientActor,
  action: Action,
  target: TargetData,
  purpose: Purpose,
  consent: ConsentState
): { allowed: boolean; reason: AccessReasonCode } {
  if (target.patientId !== actor.patientId || target.clinicId !== actor.clinicId) {
    return { allowed: false, reason: 'not_own_data' };
  }
  if (PATIENT_FORBIDDEN_KINDS.has(target.kind)) {
    return { allowed: false, reason: 'patient_forbidden_data' };
  }

  if (action === 'read') {
    if (purpose === 'self_access' && PATIENT_READ_KINDS.has(target.kind)) {
      return { allowed: true, reason: 'allowed' };
    }
    return { allowed: false, reason: 'disallowed_action' };
  }

  if (action === 'write') {
    if (target.kind === 'consent' && purpose === 'self_access') {
      return { allowed: true, reason: 'allowed' };
    }
    if ((target.kind === 'answers' || target.kind === 'rounds') && purpose === 'self_access') {
      const allowed = isPurposeAllowed(consent, 'care');
      return { allowed, reason: allowed ? 'allowed' : 'consent_required' };
    }
    if (target.kind === 'readings') {
      if (purpose === `method:${target.method}`) {
        const allowed = isPurposeAllowed(consent, purpose as ConsentPurpose);
        return { allowed, reason: allowed ? 'allowed' : 'consent_required' };
      }
      return {
        allowed: false,
        reason: purpose.startsWith('method:') ? 'method_mismatch' : 'disallowed_action',
      };
    }
    return { allowed: false, reason: 'disallowed_action' };
  }

  if (action === 'delete') {
    if (purpose === 'self_access' && PATIENT_DELETE_KINDS.has(target.kind)) {
      return { allowed: true, reason: 'allowed' };
    }
    return { allowed: false, reason: 'disallowed_action' };
  }

  return { allowed: false, reason: 'disallowed_action' };
}

function evaluateStaffPatientDataRules(
  action: Action,
  kind: DataKind,
  purpose: Purpose,
  consent: ConsentState
): { allowed: boolean; reason: AccessReasonCode } {
  if (action === 'read' && purpose === 'care') {
    if (kind === 'crisis_messages' || kind === 'patient_record') {
      return { allowed: true, reason: 'allowed' };
    }
    if (kind === 'flags' || kind === 'call_outcomes') {
      const allowed = isPurposeAllowed(consent, 'care');
      return { allowed, reason: allowed ? 'allowed' : 'consent_required' };
    }
  }

  if (action === 'write') {
    if (purpose === 'care') {
      if (kind === 'crisis_messages') return { allowed: true, reason: 'allowed' };
      if (kind === 'call_outcomes') {
        const allowed = isPurposeAllowed(consent, 'care');
        return { allowed, reason: allowed ? 'allowed' : 'consent_required' };
      }
    }
    if (purpose === 'administration') {
      if (kind === 'patient_record' || kind === 'enrolment_codes') {
        return { allowed: true, reason: 'allowed' };
      }
    }
  }

  return { allowed: false, reason: 'disallowed_action' };
}

function evaluateStaffRules(
  actor: StaffActor,
  action: Action,
  target: TargetData,
  purpose: Purpose,
  consent: ConsentState
): { allowed: boolean; reason: AccessReasonCode } {
  if (CLINICAL_DATA_KINDS.has(target.kind)) {
    return { allowed: false, reason: 'clinic_staff_forbidden_clinical_data' };
  }
  if (target.clinicId !== actor.clinicId) {
    return { allowed: false, reason: 'other_clinic' };
  }
  if (target.kind === 'access_log') {
    if (actor.role !== 'admin') return { allowed: false, reason: 'admin_only' };
    if (purpose === 'administration') return { allowed: true, reason: 'allowed' };
    return { allowed: false, reason: 'disallowed_action' };
  }
  if (target.kind === 'staff_accounts') {
    if (actor.role !== 'admin') return { allowed: false, reason: 'admin_only' };
    if ((action === 'read' || action === 'write') && purpose === 'administration') {
      return { allowed: true, reason: 'allowed' };
    }
    return { allowed: false, reason: 'disallowed_action' };
  }

  return evaluateStaffPatientDataRules(action, target.kind, purpose, consent);
}

function evaluateSystemRules(
  action: Action,
  target: TargetData,
  purpose: Purpose,
  consent: ConsentState
): { allowed: boolean; reason: AccessReasonCode } {
  if (action === 'read') {
    if (purpose === 'care' && (target.kind === 'answers' || target.kind === 'rounds' || target.kind === 'baselines')) {
      const allowed = isPurposeAllowed(consent, 'care');
      return { allowed, reason: allowed ? 'allowed' : 'consent_required' };
    }
    if (target.kind === 'readings') {
      if (purpose === `method:${target.method}`) {
        const allowed = isPurposeAllowed(consent, purpose as ConsentPurpose);
        return { allowed, reason: allowed ? 'allowed' : 'consent_required' };
      }
      return {
        allowed: false,
        reason: purpose.startsWith('method:') ? 'method_mismatch' : 'disallowed_action',
      };
    }
    if (purpose === 'rule_check' && target.kind === 'rule_check_dataset') {
      const allowed = isPurposeAllowed(consent, 'rule_check');
      return { allowed, reason: allowed ? 'allowed' : 'consent_required' };
    }
    return { allowed: false, reason: 'disallowed_action' };
  }

  if (action === 'write' && purpose === 'care') {
    if (target.kind === 'baselines' || target.kind === 'flags' || target.kind === 'crisis_messages' || target.kind === 'suggestions') {
      const allowed = isPurposeAllowed(consent, 'care');
      return { allowed, reason: allowed ? 'allowed' : 'consent_required' };
    }
  }

  return { allowed: false, reason: 'disallowed_action' };
}

export function decideAccess(request: unknown): AccessResult {
  const validRes = validateAccessRequest(request);
  if (!validRes.ok) {
    return { ok: false, error: validRes.error };
  }

  const { actor, action, target: validTarget, purpose: validPurpose, consent: reqConsent } = validRes.value;
  const consent = reqConsent ?? INITIAL_CONSENT_STATE;

  let decisionResult: { allowed: boolean; reason: AccessReasonCode };

  // Rule 6: Nobody may write or delete the access_log
  if (validTarget.kind === 'access_log' && (action === 'write' || action === 'delete')) {
    decisionResult = { allowed: false, reason: 'access_log_immutable' };
  } else if (actor.kind === 'patient') {
    decisionResult = evaluatePatientRules(actor, action, validTarget, validPurpose, consent);
  } else if (actor.kind === 'staff') {
    decisionResult = evaluateStaffRules(actor, action, validTarget, validPurpose, consent);
  } else {
    decisionResult = evaluateSystemRules(action, validTarget, validPurpose, consent);
  }

  const log = shouldLogAccess(actor, action, validTarget, validPurpose);
  const decision: AccessDecision = {
    allowed: decisionResult.allowed,
    reason: decisionResult.reason,
    log,
  };

  return {
    ok: true,
    value: decision,
  };
}
