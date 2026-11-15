import { expect } from "@playwright/test";
import { getPrisma } from "../src/lib/db";
import { test } from "./helpers";

const BASE_ORIGIN = "http://127.0.0.1:3100";

async function resetSimulatedPatientCheckIn() {
  const prisma = getPrisma();
  const patient = await prisma.participant.findFirst({
    where: { participantCode: "P-SIM-001" },
  });
  if (patient) {
    await prisma.checkInRound.deleteMany({
      where: { participantId: patient.id, roundNumber: { gt: 1 } },
    });
    await prisma.phq9Assessment.deleteMany({
      where: { participantId: patient.id },
    });
    await prisma.clinicFlag.deleteMany({
      where: { participantId: patient.id, causeType: { not: null } },
    });
  }
}

test.describe("Cepheus Auth, Logged-Out Privacy & Role-Scoped Navigation", () => {
  test.beforeAll(async () => {
    await resetSimulatedPatientCheckIn();
  });

  test.afterAll(async () => {
    await resetSimulatedPatientCheckIn();
  });
  test("1. Logged-out / hides patient & clinic nav/data, keeps crisis path, and redirects protected pages", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    const brand = page.locator('header a[href="/"]').filter({ hasText: "Cepheus" });
    const signInBtn = page.getByTestId("header-sign-in-button");
    const nav = page.locator('nav[aria-label="Primary navigation"]');

    await expect(brand).toBeVisible();
    await expect(signInBtn).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(page.getByTestId("nav-overview")).toBeVisible();

    // Zero patient or clinic nav links or cards when logged out
    for (const testId of [
      "nav-check-in",
      "nav-camera",
      "nav-monitoring",
      "nav-patient",
      "nav-clinic",
      "card-check-in",
      "card-patient",
      "card-camera",
      "card-monitoring",
      "card-clinic",
    ]) {
      await expect(page.getByTestId(testId)).toHaveCount(0);
    }

    await expect(page.getByTestId("logged-out-overview-card")).toBeVisible();

    const brandBox = await brand.boundingBox();
    const authBox = await signInBtn.boundingBox();
    const navBox = await nav.boundingBox();
    expect(brandBox).not.toBeNull();
    expect(authBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    if (brandBox && authBox && navBox) {
      expect(brandBox.x).toBeLessThan(authBox.x);
      expect(authBox.x + authBox.width).toBeLessThanOrEqual(navBox.x);
    }

    const crisisRegion = page.getByRole("region", {
      name: /Immediate support and emergency help/i,
    });
    await expect(crisisRegion).toBeVisible();

    // Protected pages redirect logged-out visitors to /sign-in
    for (const protectedPath of [
      "/patient",
      "/check-in",
      "/camera",
      "/monitoring",
      "/clinic",
    ]) {
      await page.goto(protectedPath);
      await expect(page).toHaveURL(/\/sign-in$/);
    }

    // Protected APIs return 401 when unauthenticated
    const getEndpoints = [
      "/api/demo",
      "/api/monitoring/summary",
      "/api/fitbit/status",
    ];
    for (const endpoint of getEndpoints) {
      const res = await request.get(endpoint);
      expect(res.status(), `Expected 401 on GET ${endpoint}`).toBe(401);
    }
    const postEndpoints = [
      "/api/monitoring/consent",
      "/api/ai/nurse-brief",
      "/api/ai/patient-step",
      "/api/fitbit/sync",
      "/api/fitbit/disconnect",
    ];
    for (const endpoint of postEndpoints) {
      const res = await request.post(endpoint, {
        headers: { origin: BASE_ORIGIN },
        data: {},
      });
      expect(res.status(), `Expected 401 on POST ${endpoint}`).toBe(401);
    }
  });

  test("2. Participant e-ID sign-in scopes nav to patient, blocks /clinic, persists reload, and hides nav on sign-out", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "networkidle" });

    const signInBtn = page.getByTestId("header-sign-in-button");
    await signInBtn.click();

    const popover = page.getByTestId("header-auth-popover");
    await expect(popover).toBeVisible();

    // One-click simulated participant sign-in
    await page.getByTestId("auth-preset-P-SIM-ANX-01").click();

    const avatarBtn = page.getByTestId("header-user-avatar-button");
    await expect(avatarBtn).toBeVisible();
    await expect(signInBtn).toHaveCount(0);
    await expect(avatarBtn).toContainText("PA");

    // Patient nav visible; clinic nav hidden
    await expect(page.getByTestId("nav-check-in")).toBeVisible();
    await expect(page.getByTestId("nav-patient")).toBeVisible();
    await expect(page.getByTestId("nav-clinic")).toHaveCount(0);

    // Circular avatar geometry between Brand and Primary nav
    const avatarStyle = await avatarBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        borderRadius: parseFloat(cs.borderRadius),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });
    expect(
      avatarStyle.borderRadius >= 999 ||
        (avatarStyle.width === 44 && avatarStyle.height === 44)
    ).toBe(true);

    const brand = page.locator('header a[href="/"]').filter({ hasText: "Cepheus" });
    const nav = page.locator('nav[aria-label="Primary navigation"]');
    const brandBox = await brand.boundingBox();
    const avatarBox = await avatarBtn.boundingBox();
    const navBox = await nav.boundingBox();
    expect(brandBox).not.toBeNull();
    expect(avatarBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    if (brandBox && avatarBox && navBox) {
      expect(brandBox.x).toBeLessThan(avatarBox.x);
      expect(avatarBox.x + avatarBox.width).toBeLessThanOrEqual(navBox.x);
    }

    // Zero localStorage, sessionStorage, or document.cookie leakage
    const storageCheck = await page.evaluate(() => ({
      localLength: window.localStorage.length,
      sessionLength: window.sessionStorage.length,
      cookie: document.cookie,
    }));
    expect(storageCheck.localLength).toBe(0);
    expect(storageCheck.sessionLength).toBe(0);
    expect(storageCheck.cookie).not.toContain("cepheus_session");

    // Wrong role (/clinic) redirects patient away to /patient
    await page.goto("/clinic");
    await expect(page).toHaveURL(/\/patient$/);
    const pill = page.getByTestId("active-session-pill");
    await expect(pill).toBeVisible();
    await expect(pill).toContainText("Participant P-SIM-ANX-01");

    await expect(
      page.getByRole("region", { name: /Immediate support and emergency help/i })
    ).toBeVisible();
    await expect(page.getByTestId("simulated-badge").first()).toBeVisible();

    // Reload persists session
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("header-user-avatar-button")).toBeVisible();
    await expect(page.getByTestId("header-user-avatar-button")).toContainText(
      "PA"
    );

    // Sign out redirects off /patient and hides patient links again
    await page.getByTestId("header-user-avatar-button").click();
    await expect(page.getByTestId("header-user-menu")).toBeVisible();
    await page.getByTestId("header-sign-out-button").click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("header-sign-in-button")).toBeVisible();
    await expect(page.getByTestId("header-user-avatar-button")).toHaveCount(0);
    await expect(page.getByTestId("nav-patient")).toHaveCount(0);
    await expect(page.getByTestId("logged-out-overview-card")).toBeVisible();
  });

  test("3. Clinic staff sign-in scopes nav to clinic, blocks /patient, and redirects to /clinic", async ({
    page,
  }) => {
    const response = await page.goto("/sign-in");
    expect(response?.status()).toBe(200);

    await expect(page.getByTestId("simulated-badge").first()).toBeVisible();
    await expect(
      page.getByRole("region", { name: /Immediate support and emergency help/i })
    ).toBeVisible();

    // One-click simulated clinic staff sign-in
    const staffBtn = page.getByTestId("auth-staff-nurse");
    await expect(staffBtn).toBeVisible();
    await staffBtn.click();

    // Lands on staff start page (/clinic)
    await page.waitForURL(/\/clinic$/);

    const avatarBtn = page.getByTestId("header-user-avatar-button");
    await expect(avatarBtn).toBeVisible();
    await expect(avatarBtn).toContainText("CN");

    // Staff sees Clinic view only (no patient links)
    await expect(page.getByTestId("nav-clinic")).toBeVisible();
    await expect(page.getByTestId("nav-patient")).toHaveCount(0);
    await expect(page.getByTestId("nav-check-in")).toHaveCount(0);

    // Wrong role (/patient) redirects staff away to /clinic
    await page.goto("/patient");
    await expect(page).toHaveURL(/\/clinic$/);
    const pill = page.getByTestId("active-session-pill");
    await expect(pill).toBeVisible();
    await expect(pill).toContainText("Clinic Nurse");
  });

  test("4. Touch targets are at least 44px tall for header auth, staff presets, and clinic nurse brief button", async ({
    page,
  }) => {
    // Ensure the clinic has an active flag through the product by answering a check-in as P-SIM-001
    const patientReq = await page.context().request.post("/api/auth/sign-in", {
      headers: { origin: BASE_ORIGIN },
      data: { mode: "patient_eid", participantCode: "P-SIM-001" },
    });
    expect(patientReq.ok()).toBe(true);
    await page.context().request.post("/api/check-in/taps", {
      headers: { origin: BASE_ORIGIN },
      data: { mood: 1, interest: 1 },
    });
    for (let item = 1; item <= 9; item++) {
      await page.context().request.post("/api/check-in/phq9", {
        headers: { origin: BASE_ORIGIN },
        data: { itemId: String(item), value: item === 9 ? 1 : 2 },
      });
    }
    await page.context().clearCookies();

    await page.setViewportSize({ width: 1280, height: 720 });

    // 1. Controls in header-auth-control (unsigned state)
    await page.goto("/");
    const signInBtn = page.getByTestId("header-sign-in-button");
    await expect(signInBtn).toBeVisible();
    const signInBox = await signInBtn.boundingBox();
    expect(signInBox).not.toBeNull();
    expect(signInBox!.height).toBeGreaterThanOrEqual(44);

    // Open popover
    await signInBtn.click();
    const popover = page.getByTestId("header-auth-popover");
    await expect(popover).toBeVisible();

    const patientTab = page.getByTestId("auth-tab-patient");
    const staffTab = page.getByTestId("auth-tab-staff");
    const fullSignInLink = page.getByTestId("auth-open-signin-page");

    for (const [name, loc] of [
      ["auth-tab-patient", patientTab],
      ["auth-tab-staff", staffTab],
      ["auth-open-signin-page", fullSignInLink],
    ] as const) {
      const box = await loc.boundingBox();
      expect(box, `Bounding box for ${name}`).not.toBeNull();
      expect(
        box!.height,
        `Height for ${name} (${box!.height}px)`
      ).toBeGreaterThanOrEqual(44);
    }

    // 2. Staff presets in auth-forms.tsx (on /sign-in)
    await page.goto("/sign-in");
    for (const role of ["nurse", "admin"]) {
      const staffPreset = page.getByTestId(`auth-staff-${role}`);
      await expect(staffPreset).toBeVisible();
      const box = await staffPreset.boundingBox();
      expect(box, `Bounding box for auth-staff-${role}`).not.toBeNull();
      expect(
        box!.height,
        `Height for auth-staff-${role} (${box!.height}px)`
      ).toBeGreaterThanOrEqual(44);
    }

    // 3. Nurse brief button in clinic-nurse-brief-panel.tsx (on /clinic)
    await page.getByTestId("auth-staff-nurse").click();
    await page.waitForURL(/\/clinic$/);

    const nurseBriefBtn = page.getByTestId("verda-nurse-brief-btn");
    await expect(nurseBriefBtn).toBeVisible();
    const briefBox = await nurseBriefBtn.boundingBox();
    expect(briefBox, "Bounding box for verda-nurse-brief-btn").not.toBeNull();
    expect(
      briefBox!.height,
      `Height for verda-nurse-brief-btn (${briefBox!.height}px)`
    ).toBeGreaterThanOrEqual(44);

    // 4. Header controls when signed in (avatar button and menu items)
    const avatarBtn = page.getByTestId("header-user-avatar-button");
    await expect(avatarBtn).toBeVisible();
    const avatarBox = await avatarBtn.boundingBox();
    expect(avatarBox).not.toBeNull();
    expect(avatarBox!.height).toBeGreaterThanOrEqual(44);
    expect(avatarBox!.width).toBeGreaterThanOrEqual(44);

    await avatarBtn.click();
    const menu = page.getByTestId("header-user-menu");
    await expect(menu).toBeVisible();

    const signOutBtn = page.getByTestId("header-sign-out-button");
    const signOutBox = await signOutBtn.boundingBox();
    expect(signOutBox).not.toBeNull();
    expect(signOutBox!.height).toBeGreaterThanOrEqual(44);
  });

  test("5. Mobile user login visibility & zero overflow across portrait and landscape viewports", async ({
    page,
  }) => {
    const viewports = [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 667, height: 375 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto("/", { waitUntil: "networkidle" });

      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
      );
      expect(
        scrollWidth,
        `scrollWidth on / at ${vp.width}x${vp.height}`
      ).toBeLessThanOrEqual(vp.width);

      await page.getByTestId("header-sign-in-button").click();
      const popover = page.getByTestId("header-auth-popover");
      await expect(popover).toBeVisible();

      const popoverBox = await popover.boundingBox();
      expect(popoverBox).not.toBeNull();
      expect(popoverBox!.x).toBeGreaterThanOrEqual(0);
      expect(popoverBox!.x + popoverBox!.width).toBeLessThanOrEqual(vp.width);
      expect(popoverBox!.y).toBeGreaterThanOrEqual(0);
      expect(popoverBox!.y + popoverBox!.height).toBeLessThanOrEqual(vp.height);

      const popoverScrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
      );
      expect(popoverScrollWidth).toBeLessThanOrEqual(vp.width);

      await page.getByTestId("auth-tab-staff").click();
      const staffPopoverBox = await popover.boundingBox();
      expect(staffPopoverBox).not.toBeNull();
      expect(staffPopoverBox!.x).toBeGreaterThanOrEqual(0);
      expect(staffPopoverBox!.x + staffPopoverBox!.width).toBeLessThanOrEqual(
        vp.width
      );
      expect(staffPopoverBox!.y).toBeGreaterThanOrEqual(0);
      expect(staffPopoverBox!.y + staffPopoverBox!.height).toBeLessThanOrEqual(
        vp.height
      );

      await page.getByTestId("auth-tab-patient").click();
      await page.getByTestId("auth-preset-P-SIM-ANX-01").click();

      const avatarBtn = page.getByTestId("header-user-avatar-button");
      await expect(avatarBtn).toBeVisible();
      await avatarBtn.click();

      const userMenu = page.getByTestId("header-user-menu");
      await expect(userMenu).toBeVisible();
      const menuBox = await userMenu.boundingBox();
      expect(menuBox).not.toBeNull();
      expect(menuBox!.x).toBeGreaterThanOrEqual(0);
      expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(vp.width);
      expect(menuBox!.y).toBeGreaterThanOrEqual(0);
      expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(vp.height);

      const signOutBtn = page.getByTestId("header-sign-out-button");
      await signOutBtn.scrollIntoViewIfNeeded();
      await expect(signOutBtn).toBeVisible();
      await signOutBtn.click();
      await expect(page.getByTestId("header-sign-in-button")).toBeVisible();
    }

    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/sign-in", { waitUntil: "networkidle" });

    const signInScrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    expect(signInScrollWidth).toBeLessThanOrEqual(320);

    for (const testId of ["auth-preset-P-SIM-001", "auth-staff-nurse"]) {
      const btn = page.getByTestId(testId);
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box, `Bounding box for ${testId}`).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    }
  });

  test("6. Logged-out landing page showcase supports sandbox preview, hardware CAD toggle, and demo sign-in", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "networkidle" });

    const sandbox = page.getByTestId("landing-checkin-sandbox");
    await expect(sandbox).toBeVisible();

    await sandbox.getByRole("button", { name: "Not today" }).click();
    await expect(sandbox).toContainText("Skipped without penalty");

    const storageCheck = await page.evaluate(() => ({
      localLength: window.localStorage.length,
      sessionLength: window.sessionStorage.length,
    }));
    expect(storageCheck.localLength).toBe(0);
    expect(storageCheck.sessionLength).toBe(0);

    await page.getByRole("button", { name: "Inside hardware" }).click();
    await expect(
      page.getByAltText(/Exploded CAD view of Cepheus Desk Buddy/i)
    ).toBeVisible();
    await expect(
      page.getByText(/Arduino UNO Q runs local voice check-ins/i)
    ).toBeVisible();

    await page.getByTestId("landing-demo-patient").click();
    await expect(page.getByTestId("demo-timeline-preview")).toBeVisible();
  });
});
