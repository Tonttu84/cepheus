import { expect, test } from "@playwright/test";

test.describe("Cepheus Simulated Auth & Header Integration", () => {
  test("1. Header geometry & placement on desktop (1280x720)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    const brand = page.locator('header a[href="/"]').filter({ hasText: "Cepheus" });
    const signInBtn = page.getByTestId("header-sign-in-button");
    const nav = page.locator('nav[aria-label="Primary navigation"]');

    await expect(brand).toBeVisible();
    await expect(signInBtn).toBeVisible();
    await expect(nav).toBeVisible();

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
  });

  test("2. Participant e-ID sign-in, circular avatar, zero cookie/storage leakage, /patient pill, reload persistence, and sign-out", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

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

    // Verify circular styling (border-radius >= 999px or width === height === 44)
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

    // Verify avatar is still positioned horizontally between Brand and Primary nav
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

    // Verify zero localStorage, sessionStorage, or document.cookie leakage
    const storageCheck = await page.evaluate(() => ({
      localLength: window.localStorage.length,
      sessionLength: window.sessionStorage.length,
      cookie: document.cookie,
    }));
    expect(storageCheck.localLength).toBe(0);
    expect(storageCheck.sessionLength).toBe(0);
    expect(storageCheck.cookie).not.toContain("cepheus_session");

    // Navigate to /patient and verify active-session-pill
    await page.goto("/patient");
    const pill = page.getByTestId("active-session-pill");
    await expect(pill).toBeVisible();
    await expect(pill).toContainText("Participant P-SIM-ANX-01");

    await expect(
      page.getByRole("region", { name: /Immediate support and emergency help/i })
    ).toBeVisible();
    await expect(page.getByTestId("simulated-badge").first()).toBeVisible();

    // Reload page -> session persists
    await page.reload();
    await expect(page.getByTestId("header-user-avatar-button")).toBeVisible();
    await expect(page.getByTestId("header-user-avatar-button")).toContainText(
      "PA"
    );

    // Sign out
    await page.getByTestId("header-user-avatar-button").click();
    await expect(page.getByTestId("header-user-menu")).toBeVisible();
    await page.getByTestId("header-sign-out-button").click();

    await expect(page.getByTestId("header-sign-in-button")).toBeVisible();
    await expect(page.getByTestId("header-user-avatar-button")).toHaveCount(0);
  });

  test("3. Clinic staff sign-in & error handling on /sign-in and /clinic", async ({
    page,
  }) => {
    const response = await page.goto("/sign-in");
    expect(response?.status()).toBe(200);

    await expect(page.getByTestId("simulated-badge").first()).toBeVisible();
    await expect(
      page.getByRole("region", { name: /Immediate support and emergency help/i })
    ).toBeVisible();

    // Wrong password + 123456 TOTP -> error shown, user stays unsigned
    await page.getByTestId("auth-staff-password").fill("wrong-password-123");
    await page.getByTestId("auth-staff-totp").fill("123456");
    await page.getByTestId("auth-submit-staff").click();

    await expect(page.getByTestId("auth-error-message")).toBeVisible();
    await expect(page.getByTestId("header-sign-in-button")).toBeVisible();

    // Fill demo staff credentials -> signs in as Clinic Nurse ("CN")
    await page.getByTestId("auth-fill-demo-staff").click();
    await page.getByTestId("auth-submit-staff").click();

    const avatarBtn = page.getByTestId("header-user-avatar-button");
    await expect(avatarBtn).toBeVisible();
    await expect(avatarBtn).toContainText("CN");

    // Navigate to /clinic and verify active-session-pill
    await page.goto("/clinic");
    const pill = page.getByTestId("active-session-pill");
    await expect(pill).toBeVisible();
    await expect(pill).toContainText("Clinic Nurse");
  });
});
