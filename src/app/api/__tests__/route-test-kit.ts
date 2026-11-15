import { sealSession, SESSION_COOKIE_NAME } from "@/server/auth";
import { resetRouteDeps, setRouteDepsForTests } from "@/server/api";
import { _resetEnv } from "@/server/env";
import { _resetRateLimits } from "@/server/security";
import { DEFAULT_EXTRA_ITEMS_CONFIG, type ExtraItemsConfig } from "@/domain/extra-items";
import { createFakePorts } from "@/usecases/testing";
import { createFakeRewardsPorts } from "@/usecases/rewards/testing/fake-ports";
import type { PatientRecord } from "@/usecases/ports";

/** Shared set-up for the route tests: environment, fake storage, sessions sealed by trail 53's module. */

export const CLINIC_ID = "clinic-1";
export const OTHER_CLINIC_ID = "clinic-2";
export const PATIENT_ID = "patient-a";
export const SYSTEM_KEY = "system-key-for-tests-0123456789abcdef";
/** Round 1 of the schedule below is open at this instant. */
export const ROUND_1_OPEN = "2026-11-16T16:00:00.000Z";

const processEnv = process.env as Record<string, string | undefined>;
const ENV_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "APP_SESSION_SECRET",
  "SYSTEM_API_KEY",
  "ARDUINO_INGEST_TOKEN",
] as const;
let savedEnv: Record<string, string | undefined> = {};

export function patientRecord(overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    schedule: { weekdays: [1, 4], timeOfDay: "18:00", timeZone: "Europe/Helsinki", enrolmentDate: "2026-11-16" },
    consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    ...overrides,
  };
}

/** Sets the environment, puts fake storage behind the routes and returns it. */
export function setUpRoutes(now = ROUND_1_OPEN, extraItems: ExtraItemsConfig = DEFAULT_EXTRA_ITEMS_CONFIG) {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, processEnv[k]]));
  processEnv.NODE_ENV = "development";
  processEnv.DATABASE_URL = "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
  processEnv.APP_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  processEnv.SYSTEM_API_KEY = SYSTEM_KEY;
  _resetEnv();
  _resetRateLimits();
  const fake = createFakePorts(now, extraItems);
  const clinicPatients: Record<string, string[]> = {};
  setRouteDepsForTests(() => ({
    ports: fake.ports,
    rewardsPorts: createFakeRewardsPorts(),
    clinicPatientIds: async (clinicId) => clinicPatients[clinicId] ?? [],
    resolveDevicePatient: async () => ({ patientId: PATIENT_ID, clinicId: CLINIC_ID }),
  }));
  return { ...fake, clinicPatients };
}

export function tearDownRoutes(): void {
  resetRouteDeps();
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete processEnv[k];
    else processEnv[k] = savedEnv[k];
  }
  _resetEnv();
  _resetRateLimits();
}

export function patientCookie(patientId = PATIENT_ID, clinicId = CLINIC_ID): string {
  const sealed = sealSession({
    kind: "patient",
    actor: { kind: "patient", patientId, clinicId },
    participantCode: "P-SIM-001",
    label: "Simulated participant",
    avatarInitials: "P1",
    authMethod: "simulated_finnish_eid",
    isSimulated: true,
    signedInAt: ROUND_1_OPEN,
  });
  return `${SESSION_COOKIE_NAME}=${sealed}`;
}

export function staffCookie(clinicId = CLINIC_ID, role: "nurse" | "admin" = "nurse"): string {
  const sealed = sealSession({
    kind: "staff",
    actor: { kind: "staff", staffId: "staff-1", clinicId, role },
    displayName: "Simulated nurse",
    email: "nurse@sim-clinic.local",
    clinicName: "Simulated clinic",
    avatarInitials: "SN",
    isSimulated: true,
    signedInAt: ROUND_1_OPEN,
  });
  return `${SESSION_COOKIE_NAME}=${sealed}`;
}

export interface RequestOptions {
  readonly method?: "GET" | "POST";
  readonly cookie?: string | null;
  readonly body?: unknown;
  readonly rawBody?: string;
  readonly bearer?: string;
}

export function apiRequest(path: string, options: RequestOptions = {}): Request {
  const headers = new Headers({ host: "localhost:3000", "content-type": "application/json" });
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.bearer) headers.set("authorization", `Bearer ${options.bearer}`);
  const body = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  return new Request(`http://localhost:3000${path}`, { method: options.method ?? "POST", headers, body });
}

/** Every key anywhere in a JSON value, lower-cased. */
export function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, inner]) => [key.toLowerCase(), ...allKeys(inner)]);
}
