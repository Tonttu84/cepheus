import type { BrowserContext, Cookie, Page } from "@playwright/test";

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
