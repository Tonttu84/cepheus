import {
  expect,
  test as base,
  type BrowserContext,
  type Cookie,
  type Page,
} from "@playwright/test";
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
import { addDays, parseLocalWallClockInTimeZone } from "@/domain/rounds";
import { liveScheduleAt } from "../prisma/seed";

const BASE_ORIGIN = "http://127.0.0.1:3100";

/**
 * The browser these tests run in (Playwright's headless shell) has the static
 * `SpeechRecognition.available()` but no on-device speech service behind it,
 * and calling it ends the page ("Target crashed") before any test step runs.
 * The check-in screen asks it on every visit. This takes the unbacked native
 * method away, so the screen sees what is true of this browser: on-device
 * recognition cannot be confirmed. A stand-in a test installs itself is not
 * native and is left alone, whichever script runs first.
 */
function hideUnbackedSpeechProbe(): void {
  const names = ["SpeechRecognition", "webkitSpeechRecognition"] as const;
  const win = window as unknown as Record<string, { available?: unknown } | undefined>;
  for (const name of names) {
    const recognition = win[name];
    const probe = recognition?.available;
    if (!recognition || typeof probe !== "function") continue;
    if (!Function.prototype.toString.call(probe).includes("[native code]")) continue;
    Object.defineProperty(recognition, "available", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  }
}

/** The test object of every spec: Playwright's own, in a browser that survives the check-in screen. */
export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.addInitScript(hideUnbackedSpeechProbe);
    await provide(context);
  },
});

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

const FLAG_PHQ9_ID = "e2e-clinic-flag-phq9";

/**
 * A flag raised by a PHQ-9 always has that questionnaire behind it. This adds
 * the completed questionnaire the helper's flag points at, so that the card
 * has a total to show. It replaces the patient's other PHQ-9 rows (their dates
 * must rise with the round) and sits in round 1, which makes the open round's
 * own PHQ-9 no longer due: call removeClinicFlagNumbers() when the test is over.
 */
export async function ensureClinicFlagNumbers(): Promise<void> {
  const flag = await ensureClinicFlag();
  const prisma = getPrisma();
  const data = {
    participantId: flag.participantId,
    clinicId: flag.clinicId,
    scheduledAt: new Date(),
    completedAt: new Date(),
    date: flag.causeDate ?? flag.sinceDate,
    dayIndex: 1,
    weekNumber: 1,
    roundNumber: 1,
    completedInRoundNumber: 1,
    status: "completed",
    totalScore: 12,
    isSimulated: true,
    source: "synthetic",
  };
  await prisma.phq9Assessment.deleteMany({ where: { participantId: flag.participantId } });
  await prisma.phq9Assessment.create({ data: { id: FLAG_PHQ9_ID, ...data } });
}

export async function removeClinicFlagNumbers(): Promise<void> {
  await getPrisma().phq9Assessment.deleteMany({ where: { id: FLAG_PHQ9_ID } });
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

interface StoredScheduleColumns {
  readonly id: string;
  readonly scheduleDaysJson: string | null;
  readonly timeZone: string;
}

/**
 * Small tasks are offered only on a day that is not a check-in day. When today
 * is one of the patient's two weekdays, the schedule moves to the two days
 * before today: round 1 has then elapsed and round 2, opened yesterday, is the
 * open one, as in the seed. A schedule always holds exactly two ISO weekdays
 * (1 to 7); storage refuses anything else.
 */
async function moveCheckInDaysOffToday(patient: StoredScheduleColumns): Promise<void> {
  const { localDate, weekday } = parseLocalWallClockInTimeZone(new Date(), patient.timeZone);
  const stored: unknown = JSON.parse(patient.scheduleDaysJson ?? "[]");
  if (Array.isArray(stored) && stored.length === 2 && !stored.includes(weekday)) return;

  const twoDaysAgo = ((weekday + 4) % 7) + 1;
  const yesterday = ((weekday + 5) % 7) + 1;
  await getPrisma().participant.update({
    where: { id: patient.id },
    data: {
      enrolmentDate: addDays(localDate, -2),
      scheduleDaysJson: JSON.stringify([twoDaysAgo, yesterday]),
    },
  });
}

/** Puts back what the rewards tests changed: the seeded schedule, an empty ledger, no tasks, no answered round. */
export async function restoreRewardsState(
  participantCode: SimulatedPatientPresetKey = "P-SIM-001"
): Promise<void> {
  await resetRewardsState(participantCode);
  const prisma = getPrisma();
  const patient = await prisma.participant.findFirst({ where: { participantCode } });
  if (!patient) return;
  const seeded = liveScheduleAt(new Date(), participantCode === "P-SIM-001" ? 2 : 1);
  if (patient.scheduleDaysJson === seeded.scheduleDaysJson) return;
  await prisma.participant.update({ where: { id: patient.id }, data: seeded });
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
    await moveCheckInDaysOffToday(patient);
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

/** Restores consent for the given participant so subsequent tests see an agreed-to state. */
export async function restorePatientConsent(
  participantCode: SimulatedPatientPresetKey = "P-SIM-001"
): Promise<void> {
  const prisma = getPrisma();
  const patient = await prisma.participant.findFirst({ where: { participantCode } });
  if (!patient) return;
  await prisma.participant.update({
    where: { id: patient.id },
    data: { takingPart: true, ruleCheckConsent: true },
  });
  await prisma.consentEvent.deleteMany({
    where: { participantId: patient.id, layer: "detailed_answers" },
  });
  await prisma.measurementConsent.deleteMany({
    where: { participantId: patient.id, method: "detailed_answers" },
  });
}

/**
 * Removes what answering on /check-in stores for these sample patients: the
 * rounds after the seeded one, questionnaires, extra answers, open crisis
 * alerts and the flags the rule raised. Specs that answer a round call it in
 * afterAll, so that the next spec finds the open round unanswered.
 */
export async function clearCheckInAnswers(
  participantCodes: readonly SimulatedPatientPresetKey[]
): Promise<void> {
  const prisma = getPrisma();
  for (const participantCode of participantCodes) {
    const patient = await prisma.participant.findFirst({ where: { participantCode } });
    if (!patient) continue;
    const ofPatient = { participantId: patient.id };
    const seededRounds = participantCode === "P-SIM-001" ? 1 : 0;
    await prisma.checkInRound.deleteMany({
      where: { ...ofPatient, roundNumber: { gt: seededRounds } },
    });
    await prisma.phq9Assessment.deleteMany({ where: ofPatient });
    await prisma.gad7Assessment.deleteMany({ where: ofPatient });
    await prisma.extraAnswer.deleteMany({ where: ofPatient });
    await prisma.crisisEvent.deleteMany({ where: { ...ofPatient, acknowledgedAt: null } });
    await prisma.clinicFlag.deleteMany({ where: { ...ofPatient, causeType: { not: null } } });
  }
}

/**
 * Switches one optional measuring method on or off for a patient, as the
 * switch on /patient does, and returns what it was before. The seed leaves
 * optional methods off and the demo reset switches them on, so a test that
 * needs one of the two says which.
 */
export async function setMeasuringMethodConsent(
  participantCode: SimulatedPatientPresetKey,
  method: "ring_rhythm" | "camera_expressivity",
  enabled: boolean
): Promise<boolean> {
  const prisma = getPrisma();
  const patient = await prisma.participant.findFirstOrThrow({ where: { participantCode } });
  const key = { participantId_method: { participantId: patient.id, method } };
  const before = await prisma.measurementConsent.findUniqueOrThrow({ where: key });
  if (before.enabled === enabled) return before.enabled;
  await prisma.measurementConsent.update({
    where: key,
    data: {
      enabled,
      consentedAt: enabled ? new Date() : before.consentedAt,
      revokedAt: enabled ? null : new Date(),
    },
  });
  await prisma.consentEvent.create({
    data: {
      participantId: patient.id,
      clinicId: patient.clinicId,
      layer: "method",
      method,
      enabled,
      noticeVersion: "v1",
    },
  });
  return before.enabled;
}

/** Offers again every suggestion of this patient that was answered at or after `since`. */
export async function reofferSuggestionsAnsweredSince(
  participantCode: SimulatedPatientPresetKey,
  since: Date
): Promise<void> {
  const prisma = getPrisma();
  const patient = await prisma.participant.findFirst({ where: { participantCode } });
  if (!patient) return;
  await prisma.patientSuggestion.updateMany({
    where: {
      participantId: patient.id,
      status: { in: ["accepted", "completed", "skipped"] },
      respondedAt: { gte: since },
    },
    data: { status: "shown", respondedAt: null },
  });
}

/**
 * A reset gives every simulated patient a new id, and a patient's session
 * holds the id it was signed in with: a session from before a reset is sent
 * on to /consent and its check-in calls are refused. So after a reset the
 * kept patient sessions are dropped and the next signInAsPatient signs in anew.
 */
function forgetPatientSessions(): void {
  cachedPatientCookies.clear();
}

/** Sets the demo back to its seeded state and its clock to now, as the Reset button on /demo does. */
export async function resetDemo(page: Page, context: BrowserContext): Promise<void> {
  await signInAsStaff(page, context);
  const res = await page.request.post("/api/demo/reset", {
    headers: { origin: BASE_ORIGIN },
  });
  if (!res.ok()) {
    throw new Error(`Demo reset failed (${res.status()}): ${await res.text()}`);
  }
  forgetPatientSessions();
}

/**
 * Presses Reset on /demo and waits until the server has answered. The page
 * shows "+0 days" before as well as after a reset, so that text does not say
 * the reset is over.
 */
export async function pressDemoReset(page: Page): Promise<void> {
  const answered = page.waitForResponse(
    (res) => res.request().method() === "POST" && res.url().endsWith("/api/demo/reset")
  );
  await page.getByTestId("btn-reset-demo").click();
  const res = await answered;
  if (!res.ok()) {
    throw new Error(`Demo reset failed (${res.status()})`);
  }
  forgetPatientSessions();
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

export { expect, sealSession, SESSION_COOKIE_NAME };
