import type { PatientActor, StaffActor, StaffRole } from "@/domain/access/types";
import { z } from "zod";

export type SimulatedPatientPresetKey =
  | "P-SIM-001"
  | "P-SIM-DEP-01"
  | "P-SIM-ANX-01"
  | "P-SIM-NEW-01";

export interface PatientAuthSession {
  kind: "patient";
  actor: PatientActor;
  participantCode: SimulatedPatientPresetKey;
  label: string;
  avatarInitials: string;
  authMethod: "simulated_finnish_eid";
  isSimulated: true;
  signedInAt: string;
}

export interface StaffAuthSession {
  kind: "staff";
  actor: StaffActor;
  displayName: string;
  email: string;
  clinicName: string;
  avatarInitials: string;
  isSimulated: true;
  signedInAt: string;
}

export type AuthSession = PatientAuthSession | StaffAuthSession;

export interface SimulatedPatientPreset {
  participantCode: SimulatedPatientPresetKey;
  externalId: string;
  label: string;
  description: string;
  avatarInitials: string;
}

export const SIMULATED_PATIENT_PRESETS: readonly SimulatedPatientPreset[] = [
  {
    participantCode: "P-SIM-001",
    externalId: "sim-post-tms-01",
    label: "Post-TMS follow-up participant",
    description: "8-week simulated trajectory (default)",
    avatarInitials: "P1",
  },
  {
    participantCode: "P-SIM-DEP-01",
    externalId: "sim-sample-depression-01",
    label: "Sample participant (has open suggestion) · Depression",
    description: "PHQ-9 follow-up only (D35)",
    avatarInitials: "PD",
  },
  {
    participantCode: "P-SIM-ANX-01",
    externalId: "sim-sample-anxiety-01",
    label: "Sample participant · Depression & anxiety (gets the GAD-7)",
    description: "PHQ-9 + GAD-7 follow-up (D35)",
    avatarInitials: "PA",
  },
  {
    participantCode: "P-SIM-NEW-01",
    externalId: "sim-sample-new-01",
    label: "Sample participant · new, consent not yet given",
    description: "Consent layer testing",
    avatarInitials: "PN",
  },
] as const;

export interface SimulatedStaffPreset {
  email: string;
  displayName: string;
  role: StaffRole;
  clinicName: string;
  avatarInitials: string;
  fallbackStaffId: string;
}

export const SIMULATED_STAFF_PRESETS: readonly SimulatedStaffPreset[] = [
  {
    email: "nurse@sim-clinic.local",
    displayName: "Clinic Nurse",
    role: "nurse",
    clinicName: "Simulated TMS Clinic",
    avatarInitials: "CN",
    fallbackStaffId: "sim-staff-nurse",
  },
  {
    email: "admin@sim-clinic.local",
    displayName: "Clinic Admin",
    role: "admin",
    clinicName: "Simulated TMS Clinic",
    avatarInitials: "CA",
    fallbackStaffId: "sim-staff-admin",
  },
] as const;

export const SimulatedPatientPresetKeySchema = z.enum([
  "P-SIM-001",
  "P-SIM-DEP-01",
  "P-SIM-ANX-01",
  "P-SIM-NEW-01",
]);

export const PatientSignInRequestSchema = z.object({
  mode: z.literal("patient_eid"),
  participantCode: z.string().trim().min(1).max(64),
});

export const StaffSignInRequestSchema = z.object({
  mode: z.literal("staff"),
  email: z.string().trim().max(254).email(),
  password: z.string().min(1).max(256),
  totpCode: z.string().trim().max(6).regex(/^\d{6}$/),
});

export const SignInRequestSchema = z.discriminatedUnion("mode", [
  PatientSignInRequestSchema,
  StaffSignInRequestSchema,
]);

export type PatientSignInRequest = z.infer<typeof PatientSignInRequestSchema>;
export type StaffSignInRequest = z.infer<typeof StaffSignInRequestSchema>;
export type SignInRequest = z.infer<typeof SignInRequestSchema>;

const PatientActorSchema = z.object({
  kind: z.literal("patient"),
  patientId: z.string().min(1),
  clinicId: z.string().min(1),
});

const StaffActorSchema = z.object({
  kind: z.literal("staff"),
  staffId: z.string().min(1),
  clinicId: z.string().min(1),
  role: z.enum(["nurse", "admin"]),
});

const PatientAuthSessionSchema = z.object({
  kind: z.literal("patient"),
  actor: PatientActorSchema,
  participantCode: SimulatedPatientPresetKeySchema,
  label: z.string().min(1),
  avatarInitials: z.string().min(1),
  authMethod: z.literal("simulated_finnish_eid"),
  isSimulated: z.literal(true),
  signedInAt: z.string().min(1),
});

const StaffAuthSessionSchema = z.object({
  kind: z.literal("staff"),
  actor: StaffActorSchema,
  displayName: z.string().min(1),
  email: z.string().email(),
  clinicName: z.string().min(1),
  avatarInitials: z.string().min(1),
  isSimulated: z.literal(true),
  signedInAt: z.string().min(1),
});

export const AuthSessionSchema = z.discriminatedUnion("kind", [
  PatientAuthSessionSchema,
  StaffAuthSessionSchema,
]);
