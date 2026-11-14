import { expect, test } from "@playwright/test";

const BASE_ORIGIN = "http://127.0.0.1:3100";

test.describe("Cepheus Auth, Logged-Out Privacy & Role-Scoped Navigation", () => {
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

    await page.getByTestId("auth-preset-P-SIM-ANX-01").click();
    await page.getByTestId("auth-submit-patient").click();

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

  test("3. Clinic staff sign-in scopes nav to clinic, blocks /patient, and handles credential errors", async ({
    page,
  }) => {
    const response = await page.goto("/sign-in");
    expect(response?.status()).toBe(200);

    await expect(page.getByTestId("simulated-badge").first()).toBeVisible();
    await expect(
      page.getByRole("region", { name: /Immediate support and emergency help/i })
    ).toBeVisible();

    await page.getByTestId("auth-staff-password").fill("wrong-password-123");
    await page.getByTestId("auth-staff-totp").fill("123456");
    await page.getByTestId("auth-submit-staff").click();

    await expect(page.getByTestId("auth-error-message")).toBeVisible();
    await expect(page.getByTestId("header-sign-in-button")).toBeVisible();

    await page.getByTestId("auth-fill-demo-staff").click();
    await page.getByTestId("auth-submit-staff").click();

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
});
