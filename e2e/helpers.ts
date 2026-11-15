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
import { getPrisma } from "@/lib/db";

const BASE_ORIGIN = "http://127.0.0.1:3100";

const cachedPatientCookies = new Map<string, Cookie[]>();
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
  return cookies.filter((c) => c.name === SESSION_COOKIE_NAME);
}

export async function ensureClinicFlag() {
  const prisma = getPrisma();
  const existing = await prisma.clinicFlag.findFirst({
    where: { clinicId: "sim-clinic-01", causeType: { not: null } },
  });
  if (existing) return existing;
  const patient = await prisma.participant.findFirstOrThrow({
    where: { participantCode: "P-SIM-001" },
  });
  return prisma.clinicFlag.create({
    data: {
      participantId: patient.id,
      clinicId: "sim-clinic-01",
      sinceDate: "2026-11-16",
      triggerKind: "phq9",
      ruleVersion: 1,
      primaryArea: "check_in",
      broadAreasJson: JSON.stringify(["check_in"]),
      status: "open",
      causeType: "phq9",
      causeDate: "2026-11-16",
      isSimulated: true,
    },
  });
}

export async function ensureCrisisEvent() {
  const prisma = getPrisma();
  const patient = await prisma.participant.findFirstOrThrow({
    where: { participantCode: "P-SIM-001" },
  });
  const existing = await prisma.crisisEvent.findFirst({
    where: { participantId: patient.id, acknowledgedAt: null },
  });
  if (existing) return existing;
  return prisma.crisisEvent.create({
    data: {
      participantId: patient.id,
      clinicId: "sim-clinic-01",
      roundNumber: 1,
      itemId: "phq9_item9",
      value: 1,
      occurredAt: new Date().toISOString(),
      isSimulated: true,
    },
  });
}

export async function resetRewardsState(
  participantCode: SimulatedPatientPresetKey = "P-SIM-001",
  options: { nonCheckInDay?: boolean; balanceCents?: number } = {}
): Promise<void> {
  const prisma = getPrisma();
  const patient = await prisma.participant.findFirst({
    where: { participantCode },
  });
  if (!patient) return;

  await prisma.rewardLedgerEntry.deleteMany({ where: { participantId: patient.id } });
  await prisma.taskRecord.deleteMany({ where: { participantId: patient.id } });
  await prisma.checkInRound.deleteMany({
    where: { participantId: patient.id, roundNumber: { gt: 1 } },
  });

  if (options.nonCheckInDay) {
    const todayWeekday = new Date().getDay();
    const nonTodayWeekday = (todayWeekday + 2) % 7;
    await prisma.participant.update({
      where: { id: patient.id },
      data: {
        scheduleDaysJson: JSON.stringify([nonTodayWeekday]),
      },
    });
  }

  if (options.balanceCents && options.balanceCents > 0) {
    const rounds = Math.floor(options.balanceCents / 100);
    for (let r = 1; r <= rounds; r++) {
      await prisma.rewardLedgerEntry.create({
        data: {
          id: `seed-rewards-${patient.id}-${r}`,
          participantId: patient.id,
          clinicId: patient.clinicId,
          kind: "answered_round",
          amountCents: 100,
          roundNumber: r + 10,
          createdAt: new Date(),
          isSimulated: true,
        },
      });
    }
  }
}

export async function resetPatientConsentForTest(
  participantCode: SimulatedPatientPresetKey = "P-SIM-001"
): Promise<void> {
  const prisma = getPrisma();
  const patient = await prisma.participant.findFirstOrThrow({
    where: { participantCode },
  });
  await prisma.participant.update({
    where: { id: patient.id },
    data: { takingPart: false },
  });
  await prisma.consentEvent.create({
    data: {
      participantId: patient.id,
      clinicId: patient.clinicId,
      layer: "taking_part",
      enabled: false,
      noticeVersion: "v1",
    },
  });
}

export async function signInAsPatient(
  page: Page,
  contextOrCode?: BrowserContext | SimulatedPatientPresetKey,
  participantCode?: SimulatedPatientPresetKey
): Promise<void> {
  let context: BrowserContext;
  let code: SimulatedPatientPresetKey = "P-SIM-001";

  if (typeof contextOrCode === "string") {
    context = page.context();
    code = contextOrCode;
  } else if (contextOrCode) {
    context = contextOrCode;
    if (participantCode) {
      code = participantCode;
    }
  } else {
    context = page.context();
  }

  let cookies = cachedPatientCookies.get(code);
  if (!cookies) {
    cookies = await fetchSessionCookies(page, {
      mode: "patient_eid",
      participantCode: code,
    });
    cachedPatientCookies.set(code, cookies);
  }
  await context.addCookies(cookies);
}

export interface SignInStaffOptions {
  readonly otherClinic?: boolean;
  readonly ensureFlag?: boolean;
  readonly ensureCrisisEvent?: boolean;
}

export async function signInAsStaff(
  page: Page,
  contextOrOptions?: BrowserContext | SignInStaffOptions,
  options?: SignInStaffOptions
): Promise<void> {
  let context: BrowserContext;
  let opts: SignInStaffOptions | undefined;

  if (contextOrOptions && "addCookies" in contextOrOptions) {
    context = contextOrOptions;
    opts = options;
  } else {
    context = page.context();
    opts = contextOrOptions;
  }

  if (opts?.ensureFlag) {
    await ensureClinicFlag();
  }

  if (opts?.ensureCrisisEvent) {
    await ensureCrisisEvent();
  }

  if (opts?.otherClinic) {
    const session: AuthSession = {
      kind: "staff",
      actor: {
        kind: "staff",
        staffId: "other-staff-nurse",
        clinicId: "other-clinic-99",
        role: "nurse",
      },
      displayName: "Other Clinic Nurse",
      email: "nurse@other-clinic.local",
      clinicName: "Other Clinic",
      avatarInitials: "ON",
      isSimulated: true,
      signedInAt: new Date().toISOString(),
    };
    const token = sealSession(session);
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: token,
        url: BASE_ORIGIN,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    return;
  }

  if (!cachedStaffCookies) {
    cachedStaffCookies = await fetchSessionCookies(page, {
      mode: "staff",
      email: "nurse@sim-clinic.local",
      password: "cepheus-local-only",
      totpCode: "123456",
    });
  }
  await context.addCookies(cachedStaffCookies);
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
