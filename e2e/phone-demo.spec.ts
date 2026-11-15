import { expect, test, signInAsPatient, signInAsStaff } from "./helpers";

const PHONE_VIEWPORT = { width: 390, height: 844 };

const PATIENT_ROUTES = [
  "/sign-in",
  "/check-in",
  "/patient",
  "/camera",
  "/monitoring",
  "/privacy",
  "/rewards",
];

test.describe("Phone demo paired workflow", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("laptop demo page renders QR code and changes encoded return target", async ({
    page,
  }) => {
    await signInAsStaff(page);

    await page.goto("/demo");
    await expect(page.getByTestId("phone-demo-qr-card")).toBeVisible();
    await expect(page.getByTestId("phone-demo-qr-svg")).toBeVisible();

    const encodedUrl = page.getByTestId("phone-demo-url");
    await expect(encodedUrl).toContainText("/sign-in?returnTo=%2Fcheck-in");

    await page.getByTestId("phone-demo-target-patient").click();
    await expect(encodedUrl).toContainText("/sign-in?returnTo=%2Fpatient");

    await page.getByTestId("phone-demo-custom-origin").fill("http://192.168.1.88:3000");
    await expect(encodedUrl).toContainText(
      "http://192.168.1.88:3000/sign-in?returnTo=%2Fpatient"
    );
  });

  test("patient routes render without horizontal overflow on mobile viewport", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context);

    for (const route of PATIENT_ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");

      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
      );
      expect(
        scrollWidth,
        `Page ${route} overflowed mobile viewport (${scrollWidth} > ${PHONE_VIEWPORT.width})`
      ).toBeLessThanOrEqual(PHONE_VIEWPORT.width + 1);
    }
  });

  test("mobile check-in interactive tap buttons meet 44px touch targets", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page, context);
    await page.goto("/check-in");

    const notTodayBtn = page.getByTestId("not-today-button");
    await expect(notTodayBtn).toBeVisible();
    const box = await notTodayBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(PHONE_VIEWPORT.width);
    }
  });
});
