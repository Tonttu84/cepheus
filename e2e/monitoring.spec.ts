import { expect, test } from "@playwright/test";
import { addDays, getOpenRound, listRounds, type Schedule } from "../src/domain/rounds";
import { getPrisma } from "../src/lib/db";
import { signInAsPatient, signInAsStaff } from "./helpers";

const WEEKDAYS = [1, 4] as const;
const TIME_OF_DAY = "18:00";
const TIME_ZONE = "Europe/Helsinki";
const LOOK_BACK_DAYS = 28;

function localDateIn(timeZone: string, moment: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);
}

function liveScheduleAt(now: Date, openRoundNumber: number) {
  const lookBack: Schedule = {
    weekdays: WEEKDAYS,
    timeOfDay: TIME_OF_DAY,
    timeZone: TIME_ZONE,
    enrolmentDate: addDays(localDateIn(TIME_ZONE, now), -LOOK_BACK_DAYS),
  };
  const open = getOpenRound(lookBack, now);
  if (!open || open.number < openRoundNumber) {
    throw new Error("No round is open at the current moment");
  }
  const rounds = listRounds(lookBack, open.number);
  return {
    enrolmentDate: rounds[open.number - openRoundNumber].localDate,
    scheduleDaysJson: JSON.stringify(WEEKDAYS),
    scheduleTime: TIME_OF_DAY,
    timeZone: TIME_ZONE,
  };
}

async function resetBedsideDemoRound() {
  const prisma = getPrisma();
  const schedule = liveScheduleAt(new Date(), 1);
  const clinic = await prisma.clinic.upsert({
    where: { code: "demo-home-clinic-01" },
    update: {},
    create: {
      code: "demo-home-clinic-01",
      name: "Demo Home Clinic",
    },
  });

  const participant = await prisma.participant.upsert({
    where: { externalId: "demo-home-node-01" },
    update: {
      clinicId: clinic.id,
      scheduleDaysJson: schedule.scheduleDaysJson,
      scheduleTime: schedule.scheduleTime,
      timeZone: schedule.timeZone,
      enrolmentDate: schedule.enrolmentDate,
      takingPart: true,
      ruleCheckConsent: true,
    },
    create: {
      clinicId: clinic.id,
      externalId: "demo-home-node-01",
      label: "Home Demo Node (Arduino UNO Q & Wearable)",
      source: "live",
      isSimulated: false,
      scheduleDaysJson: schedule.scheduleDaysJson,
      scheduleTime: schedule.scheduleTime,
      timeZone: schedule.timeZone,
      enrolmentDate: schedule.enrolmentDate,
      takingPart: true,
      ruleCheckConsent: true,
    },
  });

  await prisma.checkInRound.deleteMany({
    where: { participantId: participant.id },
  });
}

test.describe("Home Sensors Monitoring & Security Boundaries (/monitoring)", () => {
  test.beforeAll(async () => {
    await resetBedsideDemoRound();
  });

  test.afterAll(async () => {
    await resetBedsideDemoRound();
  });
  test("1. /monitoring loads with security headers, crisis bar, simulated badge, and consent toggles", async ({
    page,
  }) => {
    await signInAsPatient(page);
    const response = await page.goto("/monitoring");
    expect(response?.status()).toBe(200);

    const headers = response?.headers() ?? {};
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");

    const crisisRegion = page.getByRole("region", {
      name: /Immediate support and emergency help/i,
    });
    await expect(crisisRegion).toBeVisible();
    await expect(crisisRegion).toContainText("112");

    await expect(page.getByTestId("simulated-badge").first()).toBeVisible();
    await expect(page.getByTestId("consent-card-ring_rhythm")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("consent-card-camera_expressivity")).toBeVisible();
    await expect(page.getByTestId("consent-card-home_routine")).toBeVisible();

    await expect(page.getByTestId("device-status-ring_rhythm")).toContainText(
      "No device connected"
    );
    await expect(page.getByTestId("device-status-camera_expressivity")).toContainText(
      "No device connected"
    );
    await expect(page.getByTestId("device-status-home_routine")).toContainText(
      "No device connected"
    );
  });

  test("2. Simulated Fitbit sync and Arduino UNO Q push compute rhythm metrics and store derived numbers", async ({
    page,
  }) => {
    await resetBedsideDemoRound();
    await signInAsPatient(page);
    await page.goto("/monitoring");

    await page.getByTestId("fitbit-sync-simulated").click();
    await expect(page.getByTestId("monitoring-feedback")).toContainText(
      "simulated Fitbit days",
      { timeout: 15_000 }
    );
    await expect(page.getByText("Relative Amplitude")).toBeVisible();
    await expect(page.getByText("Sleep Reg. (SRI)")).toBeVisible();

    await page.getByTestId("health-connect-simulate").click();
    await expect(page.getByTestId("monitoring-feedback")).toContainText(
      "simulated Health Connect days",
      { timeout: 15_000 }
    );

    await page.getByTestId("arduino-simulate-push").click();
    await expect(page.getByTestId("monitoring-feedback")).toContainText(
      "0 bytes video",
      { timeout: 15_000 }
    );
    await expect(page.getByTestId("arduino-light-cue")).toContainText(
      "Suggested"
    );
    await expect(page.getByText("home_immobility_bouts").first()).toBeVisible();

    await page.getByTestId("arduino-simulate-voice").click();
    await expect(page.getByTestId("monitoring-feedback")).toContainText(
      "0 bytes audio stored",
      { timeout: 15_000 }
    );
  });

  test("3. Security API boundaries reject raw media payloads, unauthenticated summary reads, and cross-origin POSTs", async ({
    page,
    request,
  }) => {
    const rawMediaRes = await request.post("/api/arduino/ingest", {
      data: {
        deviceId: "unoq-bad",
        date: "2026-11-14",
        isSimulated: true,
        camera: {
          durationSec: 20,
          effectiveFps: 15,
          faceDetectedRatio: 0.9,
          expressivityScore: 0.05,
          angularPathDegPerMin: 100,
          imageBase64: "data:image/jpeg;base64,/9j/4AAQ",
        },
      },
    });
    expect(rawMediaRes.status()).toBe(400);
    const rawJson = await rawMediaRes.json();
    expect(rawJson.error).toMatch(/raw media field/i);

    const crossOriginSync = await request.post("/api/fitbit/sync", {
      headers: {
        origin: "https://attacker.example.com",
      },
      data: { mode: "simulated" },
    });
    expect(crossOriginSync.status()).toBe(403);

    const missingAuthWebhook = await request.post("/api/webhooks/health-connect", {
      data: { test: true },
    });
    expect(missingAuthWebhook.status()).toBe(401);

    const badSigWebhook = await request.post("/api/webhooks/health-connect", {
      headers: {
        "x-signature": "sha256=0000000000000000000000000000000000000000000000000000000000000000",
      },
      data: { test: true },
    });
    expect(badSigWebhook.status()).toBe(401);

    const unsignedStaffRes = await request.get(
      "/api/monitoring/summary?viewer=staff"
    );
    expect(unsignedStaffRes.status()).toBe(401);

    await signInAsStaff(page);
    // Even if staff requests ?viewer=patient, session role enforces D8 redaction
    const staffRes = await page.request.get(
      "/api/monitoring/summary?viewer=patient"
    );
    expect(staffRes.status()).toBe(200);
    const staffJson = await staffRes.json();
    expect(staffJson.demoOnly).toBe(true);
    expect(staffJson.summary.readingsRedactedForStaff).toBe(true);
    expect(staffJson.summary.recentWearableDays).toEqual([]);
    expect(staffJson.summary.recentCameraReadings).toEqual([]);
  });

  test("4. End-user Health Connect QR pairing provisions credentials, verifies phone test ping, and revokes cleanly", async ({
    page,
    request,
  }) => {
    await signInAsPatient(page);
    await page.goto("/monitoring");

    await expect(page.getByTestId("hc-pair-button")).toBeVisible();
    await page.getByTestId("hc-pair-button").click();

    await expect(page.getByTestId("hc-pairing-card")).toBeVisible();
    await expect(page.getByTestId("hc-pairing-qr")).toBeVisible();

    const ldHref = await page
      .getByTestId("hc-lifedashboard-link")
      .getAttribute("href");
    expect(ldHref).toMatch(/^lifedashboard:\/\/pair#v=1&url=/);

    const webhookUrl = (
      await page.getByTestId("hc-webhook-url").textContent()
    )?.trim();
    const apiKeyHeaderLine = (
      await page.getByTestId("hc-webhook-apikey-header").textContent()
    )?.trim();
    expect(webhookUrl).toBeTruthy();
    expect(apiKeyHeaderLine).toMatch(/^X-API-Key:\s+\S+/);
    const apiKey = apiKeyHeaderLine!.replace(/^X-API-Key:\s+/, "");

    const pingRes = await request.post(webhookUrl!, {
      headers: { "x-api-key": apiKey },
      data: { test: true, source: "health_connect" },
    });
    expect(pingRes.status()).toBe(204);

    await page.getByTestId("hc-refresh-status").click();
    await expect(page.getByTestId("hc-status-badge")).toContainText(
      "Phone verified"
    );

    // While P-SIM-001 is paired & verified, switching to P-SIM-ANX-01 shows isolated unpaired & paused state
    const switchToB = await page.request.post("/api/auth/sign-in", {
      headers: { origin: "http://127.0.0.1:3100" },
      data: { mode: "patient_eid", participantCode: "P-SIM-ANX-01" },
    });
    expect(switchToB.status()).toBe(200);
    await page.goto("/monitoring");
    await expect(page.getByTestId("consent-status-ring_rhythm")).toContainText(
      "Paused"
    );
    await expect(page.getByTestId("device-status-ring_rhythm")).toContainText(
      "No device connected"
    );
    await expect(page.getByTestId("hc-pair-button")).toBeDisabled();
    await expect(page.getByTestId("hc-status-badge")).toContainText(
      "Not paired yet"
    );

    // Enabling ring_rhythm consent unlocks pairing while device still shows unpaired
    await page.getByTestId("toggle-consent-ring_rhythm").click();
    await expect(page.getByTestId("consent-status-ring_rhythm")).toContainText(
      "Allowed"
    );
    await expect(page.getByTestId("device-status-ring_rhythm")).toContainText(
      "No device connected"
    );
    await expect(page.getByTestId("hc-pair-button")).toBeEnabled();

    // Re-pause before switching back so repeated E2E runs against persistent DB stay idempotent
    await page.getByTestId("toggle-consent-ring_rhythm").click();
    await expect(page.getByTestId("consent-status-ring_rhythm")).toContainText(
      "Paused"
    );
    await expect(page.getByTestId("hc-pair-button")).toBeDisabled();

    // Switch back to P-SIM-001 -> still Phone verified -> disconnect -> 401
    await signInAsPatient(page);
    await page.goto("/monitoring");
    await expect(page.getByTestId("hc-status-badge")).toContainText(
      "Phone verified"
    );

    await page.getByTestId("hc-disconnect-button").click();
    await expect(page.getByTestId("hc-status-badge")).not.toContainText(
      "Phone verified"
    );

    const revokedRes = await request.post(webhookUrl!, {
      headers: { "x-api-key": apiKey },
      data: { test: true },
    });
    expect(revokedRes.status()).toBe(401);
  });
});
