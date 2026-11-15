import { expect, test } from "@playwright/test";
import { signInAsPatient, signInAsStaff, signOutSession } from "./helpers";

test.describe("Cepheus Foundation Shell & Safety Invariants", () => {
  test("1. Overview (/) loads, labels simulated data, shows crisis path, and switches demo moments when signed in", async ({
    page,
  }) => {
    await signInAsPatient(page);
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Security headers (task P2.3)
    const headers = response?.headers() ?? {};
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["permissions-policy"]).toContain("camera=(self)");
    expect(headers["permissions-policy"]).toContain("microphone=(self)");
    const csp = headers["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    // The browser tests run against the development server, whose policy
    // allows 'unsafe-eval' for Fast Refresh. That production forbids it is
    // asserted in src/server/security/__tests__/headers.test.ts.
    expect(csp).toContain("'wasm-unsafe-eval'");

    // Simulated data badge is clearly displayed
    const badges = page.getByTestId("simulated-badge");
    await expect(badges.first()).toBeVisible();
    await expect(badges.first()).toContainText("Simulated data");

    // Always-visible crisis path with 112 and MIELI 09 2525 0111
    const crisisRegion = page.getByRole("region", {
      name: /Immediate support and emergency help/i,
    });
    await expect(crisisRegion).toBeVisible();
    await expect(crisisRegion).toContainText("112");
    await expect(crisisRegion).toContainText("09 2525 0111");
    await expect(crisisRegion).toContainText(
      "Direct connection to a person — nothing automated in between."
    );

    // Switch between the 3 demo moments: well, small_dip, sustained_drift
    const wellTab = page.getByTestId("moment-well");
    const smallDipTab = page.getByTestId("moment-small_dip");
    const sustainedDriftTab = page.getByTestId("moment-sustained_drift");

    await wellTab.click();
    await expect(page.getByTestId("moment-panel-well")).toBeVisible();
    await expect(page.getByTestId("moment-panel-well")).toContainText("Day 18");

    await smallDipTab.click();
    await expect(page.getByTestId("moment-panel-small_dip")).toBeVisible();
    await expect(page.getByTestId("moment-panel-small_dip")).toContainText(
      "Take a 10-minute walk outside"
    );

    await sustainedDriftTab.click();
    await expect(
      page.getByTestId("moment-panel-sustained_drift")
    ).toBeVisible();
    await expect(
      page.getByTestId("moment-panel-sustained_drift")
    ).toContainText("Day 56");
  });

  test("2. /check-in, /camera, /patient, and /clinic return 200 for authorized roles and keep the crisis path visible", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context);
    for (const route of ["/check-in", "/camera", "/patient"]) {
      const response = await page.goto(route);
      expect(response?.status(), `Expected 200 on ${route}`).toBe(200);

      const crisisRegion = page.getByRole("region", {
        name: /Immediate support and emergency help/i,
      });
      await expect(crisisRegion).toBeVisible();
      await expect(crisisRegion).toContainText("112");
      await expect(crisisRegion).toContainText("09 2525 0111");

      const badge = page.getByTestId("simulated-badge").first();
      await expect(badge).toBeVisible();
      await expect(badge).toContainText("Simulated data");
    }

    await signOutSession(context);
    await signInAsStaff(page, context);
    const clinicResp = await page.goto("/clinic");
    expect(clinicResp?.status(), "Expected 200 on /clinic").toBe(200);
    await expect(
      page.getByRole("region", { name: /Immediate support and emergency help/i })
    ).toBeVisible();
    await expect(page.getByTestId("simulated-badge").first()).toContainText(
      "Simulated data"
    );
  });

  test("3. /patient shows a single low-effort suggestion and contains no streak counters", async ({
    page,
  }) => {
    await signInAsPatient(page);
    const response = await page.goto("/patient");
    expect(response?.status()).toBe(200);

    await expect(page.getByTestId("patient-suggestion-card")).toBeVisible();
    await expect(page.getByTestId("patient-suggestion-title")).toContainText(
      "Take a 10-minute walk outside"
    );

    const mainText = await page.locator("main").innerText();
    expect(mainText.toLowerCase()).not.toContain("streak");
  });

  test("4. /api/health is public and /api/demo?moment=small_dip requires auth then returns valid 200 JSON", async ({
    page,
    request,
  }) => {
    const healthRes = await request.get("/api/health");
    expect(healthRes.status()).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.ok).toBe(true);
    expect(healthJson.database).toBe("postgresql");
    expect(typeof healthJson.participantCount).toBe("number");
    expect(healthJson.isSimulated).toBe(true);

    const unsignedDemoRes = await request.get("/api/demo?moment=small_dip");
    expect(unsignedDemoRes.status()).toBe(401);

    await signInAsPatient(page);
    const demoRes = await page.request.get("/api/demo?moment=small_dip");
    expect(demoRes.status()).toBe(200);
    const demoJson = await demoRes.json();
    expect(demoJson.ok).toBe(true);
    expect(demoJson.isSimulated).toBe(true);
    expect(demoJson.moment.key).toBe("small_dip");
    expect(demoJson.moment.dayIndex).toBe(29);
  });
});
