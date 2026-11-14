import type { BrowserContext, Cookie, Page } from "@playwright/test";
import {
  SIMULATED_PATIENT_PRESETS,
  SIMULATED_STAFF_PRESETS,
  type AuthSession,
  type PatientAuthSession,
  type SimulatedPatientPresetKey,
  type StaffAuthSession,
} from "@/lib/auth-types";
import {
  authenticateStaffCredentials,
  sealSession,
  SESSION_COOKIE_NAME,
  simulatedFinnishEidProvider,
} from "@/server/auth";

const BASE_ORIGIN = "http://127.0.0.1:3100";

let cachedPatientCookies: Cookie[] | null = null;
let cachedStaffCookies: Cookie[] | null = null;

async function fetchSessionCookies(
  page: Page,
  payload: Record<string, unknown>
): Promise<Cookie[]> {
  const res = await page.request.post("/api/auth/sign-in", {
    headers: { origin: BASE_ORIGIN },
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`Sign-in failed (${res.status()}): ${await res.text()}`);
  }
  const cookies = await page.context().cookies();
  return cookies.filter((c) => c.name === "cepheus_session");
}

export async function signInAsPatient(
  page: Page,
  context: BrowserContext = page.context()
): Promise<void> {
  if (!cachedPatientCookies) {
    cachedPatientCookies = await fetchSessionCookies(page, {
      mode: "patient_eid",
      participantCode: "P-SIM-001",
    });
  } else {
    await context.addCookies(cachedPatientCookies);
  }
}

export async function signInAsStaff(
  page: Page,
  context: BrowserContext = page.context()
): Promise<void> {
  if (!cachedStaffCookies) {
    cachedStaffCookies = await fetchSessionCookies(page, {
      mode: "staff",
      email: "nurse@sim-clinic.local",
      password: "cepheus-local-only",
      totpCode: "123456",
    });
  } else {
    await context.addCookies(cachedStaffCookies);
  }
}

export async function signOutSession(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}

/**
 * Builds an authentic sealed session object for simulated participants using
 * the exact IDs produced by `src/server/auth/eid-provider.ts`.
 */
export async function createSimulatedPatientSession(
  participantCode: SimulatedPatientPresetKey = "P-SIM-001"
): Promise<PatientAuthSession> {
  const session = await simulatedFinnishEidProvider.authenticateSimulatedPreset(
    participantCode
  );
  if (!session) {
    throw new Error(`Unknown simulated participant preset: ${participantCode}`);
  }
  return session;
}

/**
 * Builds an authentic sealed session object for clinic staff using
 * the exact IDs produced by `src/server/auth/staff-auth.ts`.
 */
export async function createSimulatedStaffSession(
  role: "nurse" | "admin" = "nurse"
): Promise<StaffAuthSession> {
  const preset = SIMULATED_STAFF_PRESETS.find((item) => item.role === role);
  if (!preset) {
    throw new Error(`Unknown simulated staff role: ${role}`);
  }
  const result = await authenticateStaffCredentials({
    email: preset.email,
    password: "cepheus-local-only",
    totpCode: "123456",
  });
  if (!result.ok) {
    throw new Error(`Failed to create simulated staff session: ${result.message}`);
  }
  return result.session;
}

/**
 * Creates a sealed session cookie string (`${SESSION_COOKIE_NAME}=${sealedToken}`)
 * for direct API requests in browser tests.
 */
export function createSessionCookie(session: AuthSession): string {
  return `${SESSION_COOKIE_NAME}=${sealSession(session)}`;
}

/**
 * Convenience helper to create a sealed session cookie for a simulated participant.
 */
export async function createPatientSessionCookie(
  participantCode: SimulatedPatientPresetKey = "P-SIM-001"
): Promise<string> {
  const session = await createSimulatedPatientSession(participantCode);
  return createSessionCookie(session);
}

/**
 * Convenience helper to create a sealed session cookie for clinic staff.
 */
export async function createStaffSessionCookie(
  role: "nurse" | "admin" = "nurse"
): Promise<string> {
  const session = await createSimulatedStaffSession(role);
  return createSessionCookie(session);
}

export { sealSession, SESSION_COOKIE_NAME };
