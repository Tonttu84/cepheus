import type { MeasuringMethod, ConsentState } from '../consent';

export type ActorKind = 'patient' | 'staff' | 'system';

export type StaffRole = 'nurse' | 'admin';

export type PatientActor = {
  kind: 'patient';
  patientId: string;
  clinicId: string;
};

export type StaffActor = {
  kind: 'staff';
  staffId: string;
  clinicId: string;
  role: StaffRole;
};

export type SystemActor = {
  kind: 'system';
};

export type Actor = PatientActor | StaffActor | SystemActor;

export type Action = 'read' | 'write' | 'delete';

export type PatientDataKind =
  | 'answers'
  | 'rounds'
  | 'readings'
  | 'baselines'
  | 'consent'
  | 'suggestions'
  | 'flags'
  | 'crisis_messages'
  | 'call_outcomes'
  | 'patient_record'
  | 'enrolment_codes';

export type ClinicDataKind =
  | 'staff_accounts'
  | 'access_log';

export type DatasetKind =
  | 'rule_check_dataset';

export type DataKind = PatientDataKind | ClinicDataKind | DatasetKind;

export type TargetData = {
  kind: DataKind;
  patientId?: string;
  clinicId?: string;
  method?: MeasuringMethod | string;
};

export type Purpose =
  | 'self_access'
  | 'care'
  | 'rule_check'
  | 'administration'
  | `method:${MeasuringMethod}`
  | string;

export type AccessReasonCode =
  | 'allowed'
  | 'other_clinic'
  | 'not_own_data'
  | 'clinic_staff_forbidden_clinical_data'
  | 'access_log_immutable'
  | 'admin_only'
  | 'consent_required'
  | 'method_mismatch'
  | 'patient_forbidden_data'
  | 'disallowed_action';

export type AccessDecision = {
  allowed: boolean;
  reason: AccessReasonCode;
  log: boolean;
};

export type AccessRequest = {
  actor: Actor;
  action: Action;
  target: TargetData;
  purpose: Purpose;
  consent?: ConsentState;
};

export type AccessCheckSuccess = {
  ok: true;
  value: AccessDecision;
};

export type AccessCheckFailure = {
  ok: false;
  error: string;
};

export type AccessResult = AccessCheckSuccess | AccessCheckFailure;
