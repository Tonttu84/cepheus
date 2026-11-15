import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/usecases", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/usecases")>();
  return { ...actual, evaluatePatient: vi.fn(actual.evaluatePatient) };
});

import { evaluatePatient } from "@/usecases";
import { GET as getState } from "@/app/api/check-in/route";
import { POST as postTaps } from "@/app/api/check-in/taps/route";
import { POST as postNotToday } from "@/app/api/check-in/not-today/route";
import { POST as postPhq9 } from "@/app/api/check-in/phq9/route";
import { POST as postGad7 } from "@/app/api/check-in/gad7/route";
import { POST as postExtra } from "@/app/api/check-in/extra-answer/route";
import { POST as postCrisis } from "@/app/api/check-in/crisis/route";
import { setRouteDepsForTests } from "@/server/api";
import { DEFAULT_EXTRA_ITEMS_CONFIG } from "@/domain/extra-items";
import {
  apiRequest,
  PATIENT_ID,
  patientCookie,
  patientRecord,
  setUpRoutes,
  staffCookie,
  tearDownRoutes,
} from "@/app/api/__tests__/route-test-kit";

type Fake = ReturnType<typeof setUpRoutes>;

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function expectCrisisPath(body: Record<string, unknown>): void {
  expect(body.showCrisisPath).toBe(true);
  expect(Array.isArray(body.crisisResources)).toBe(true);
  expect((body.crisisResources as unknown[]).length).toBeGreaterThan(0);
}

function tapsRequest(body: unknown = { mood: 3, interest: 2 }, cookie: string | null = patientCookie()) {
  return apiRequest("/api/check-in/taps", { body, cookie });
}

function phq9Request(body: unknown, cookie: string | null = patientCookie()) {
  return apiRequest("/api/check-in/phq9", { body, cookie });
}

function crisisRequest(body: unknown = { screen: "check-in" }, cookie: string | null = patientCookie()) {
  return apiRequest("/api/check-in/crisis", { body, cookie });
}

describe("check-in routes", () => {
  let fake: Fake;

  beforeEach(async () => {
    fake = setUpRoutes();
    await fake.ports.patients.savePatient(patientRecord());
  });

  afterEach(() => {
    tearDownRoutes();
    vi.restoreAllMocks();
  });

  describe("who may call", () => {
    it("answers 401 without a session and 401 for a tampered cookie", async () => {
      expect((await getState(apiRequest("/api/check-in", { method: "GET" }))).status).toBe(401);
      const tampered = `${patientCookie().slice(0, -4)}AAAA`;
      expect((await getState(apiRequest("/api/check-in", { method: "GET", cookie: tampered }))).status).toBe(401);
    });

    it("refuses staff sessions on every patient route", async () => {
      const cookie = staffCookie();
      expect((await getState(apiRequest("/api/check-in", { method: "GET", cookie }))).status).toBe(403);
      expect((await postTaps(tapsRequest(undefined, cookie))).status).toBe(403);
      expect((await postNotToday(apiRequest("/api/check-in/not-today", { cookie }))).status).toBe(403);
      expect((await postGad7(apiRequest("/api/check-in/gad7", { body: { itemId: "1", value: 1 }, cookie }))).status).toBe(403);
    });

    it("lets a patient act only for themself: a body naming another patient is refused", async () => {
      await fake.ports.patients.savePatient(patientRecord({ patientId: "patient-b" }));
      const res = await postTaps(tapsRequest({ mood: 3, interest: 2, patientId: "patient-b" }));
      expect(res.status).toBe(400);
      expect(await fake.ports.rounds.getRounds("patient-b")).toHaveLength(0);
      expect(await fake.ports.rounds.getRounds(PATIENT_ID)).toHaveLength(0);
    });

    it("refuses a session whose clinic is not the patient's own", async () => {
      const res = await postTaps(tapsRequest(undefined, patientCookie(PATIENT_ID, "clinic-2")));
      expect(res.status).toBe(403);
      expect(await fake.ports.rounds.getRounds(PATIENT_ID)).toHaveLength(0);
    });
  });

  describe("input", () => {
    it("answers anything that is not the schema with a 400 that does not echo it", async () => {
      const marker = "echo-marker-77";
      const cases = [
        tapsRequest({ mood: 9, interest: 2 }),
        tapsRequest({ mood: 3, interest: 2, note: marker }),
        apiRequest("/api/check-in/taps", { rawBody: `{"mood": "${marker}"`, cookie: patientCookie() }),
        phq9Request({ itemId: "10", value: 1, text: marker }),
        apiRequest("/api/check-in/not-today", { body: { reason: marker }, cookie: patientCookie() }),
        apiRequest("/api/check-in/gad7", { body: { itemId: "8", value: 1 }, cookie: patientCookie() }),
        apiRequest("/api/check-in/extra-answer", { body: { itemId: marker, value: 9 }, cookie: patientCookie() }),
      ];
      const handlers = [postTaps, postTaps, postTaps, postPhq9, postNotToday, postGad7, postExtra];
      for (const [i, request] of cases.entries()) {
        const res = await handlers[i](request);
        expect(res.status).toBe(400);
        expect(await res.text()).not.toContain(marker);
      }
    });

    it("refuses a body larger than 8 KB", async () => {
      const res = await postTaps(tapsRequest({ mood: 3, interest: 2, pad: "x".repeat(9000) }));
      expect(res.status).toBe(400);
    });
  });

  describe("state, taps and not today", () => {
    it("reports the open round's state for the signed-in patient", async () => {
      const res = await getState(apiRequest("/api/check-in", { method: "GET", cookie: patientCookie() }));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(Object.keys(body).sort()).toEqual(
        ["extraItem", "hasSuggestionWaiting", "isPhq9Due", "ok", "openRound", "phq9Progress", "taps"].sort()
      );
      expect(body.taps).toBe("waiting");
      expect(body.isPhq9Due).toBe(true);
    });

    it("saves the taps, returns no answer values, and runs the rule as the system", async () => {
      vi.mocked(evaluatePatient).mockClear();
      const res = await postTaps(tapsRequest());
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body).toEqual({ ok: true, saved: true });
      const [round] = await fake.ports.rounds.getRounds(PATIENT_ID);
      expect(round.status).toBe("answered");
      expect(round.mood).toBe(3);
      expect(evaluatePatient).toHaveBeenCalledWith({ kind: "system" }, { patientId: PATIENT_ID }, fake.ports);
    });

    it('records "Not today" with no body, after which no PHQ-9 is due in that round', async () => {
      const res = await postNotToday(apiRequest("/api/check-in/not-today", { cookie: patientCookie() }));
      expect(res.status).toBe(200);
      const state = await json(await getState(apiRequest("/api/check-in", { method: "GET", cookie: patientCookie() })));
      expect(state.taps).toBe("not_today");
      expect(state.isPhq9Due).toBe(false);
    });

    it("answers 409 when no round is open", async () => {
      fake.clock.setNow("2026-11-15T10:00:00.000Z");
      const res = await postTaps(tapsRequest());
      expect(res.status).toBe(409);
    });
  });

  describe("PHQ-9 and the crisis path", () => {
    it("saves an item answer and reports the progress", async () => {
      await postTaps(tapsRequest());
      const res = await postPhq9(phq9Request({ itemId: "1", value: 2 }));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body).toEqual({ ok: true, saved: true, progress: "unfinished", showCrisisPath: false });
    });

    it("returns the crisis path for a self-harm answer above 0", async () => {
      await postTaps(tapsRequest());
      const res = await postPhq9(phq9Request({ itemId: "9", value: 1 }));
      expect(res.status).toBe(200);
      expectCrisisPath(await json(res));
      expect(await fake.ports.crisis.getCrisisEvents(PATIENT_ID)).toHaveLength(1);
    });

    it("returns the crisis path even when the request is refused or invalid", async () => {
      const refusals = [
        await postPhq9(phq9Request({ itemId: "9", value: 2 }, null)),
        await postPhq9(phq9Request({ itemId: "9", value: 2 }, staffCookie())),
        await postPhq9(phq9Request({ itemId: "9", value: 2 })), // before the taps: 409
        await postPhq9(phq9Request({ itemId: "9", value: 2, extra: true })),
        await postPhq9(phq9Request({ itemId: 9, value: 3 })),
      ];
      expect(refusals.map((r) => r.status)).toEqual([401, 403, 409, 400, 400]);
      for (const res of refusals) expectCrisisPath(await json(res));
    });

    it("answers a storage failure with 503 not saved, the crisis path, and a log without values", async () => {
      await postTaps(tapsRequest());
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      fake.unitOfWork.failNext = true;
      const res = await postPhq9(phq9Request({ itemId: "9", value: 3 }));
      expect(res.status).toBe(503);
      const body = await json(res);
      expect(body.ok).toBe(false);
      expect(body.saved).toBe(false);
      expectCrisisPath(body);
      expect(errors).toHaveBeenCalled();
      const logged = errors.mock.calls.flat();
      const context = logged.find((arg) => typeof arg === "object") as Record<string, unknown>;
      expect(context).toMatchObject({ route: "check-in:phq9", actorKind: "patient", itemId: "9" });
      expect(Object.keys(context)).not.toContain("value");
    });

    it("answers 503 not saved when storage cannot even be reached", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      setRouteDepsForTests(() => {
        throw new Error("connection refused");
      });
      const taps = await postTaps(tapsRequest());
      expect(taps.status).toBe(503);
      expect(await json(taps)).toMatchObject({ ok: false, saved: false });
      const crisis = await postPhq9(phq9Request({ itemId: "9", value: 1 }));
      expect(crisis.status).toBe(503);
      expectCrisisPath(await json(crisis));
    });
  });

  describe("GAD-7 and the extra question", () => {
    it("saves a GAD-7 item for a patient who has it, and refuses one who does not", async () => {
      await fake.ports.patients.savePatient(patientRecord({ questionnaires: ["phq9", "gad7"] }));
      await postTaps(tapsRequest());
      const res = await postGad7(apiRequest("/api/check-in/gad7", { body: { itemId: "1", value: 2 }, cookie: patientCookie() }));
      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({ ok: true, saved: true, isComplete: false });

      await fake.ports.patients.savePatient(patientRecord({ questionnaires: ["phq9"] }));
      const refused = await postGad7(apiRequest("/api/check-in/gad7", { body: { itemId: "2", value: 2 }, cookie: patientCookie() }));
      expect(refused.status).toBe(409);
    });

    it("refuses the extra answer while the experimental question is switched off", async () => {
      await postTaps(tapsRequest());
      const res = await postExtra(apiRequest("/api/check-in/extra-answer", { body: { itemId: "extra_sleep", value: 2 }, cookie: patientCookie() }));
      expect(res.status).toBe(409);
    });

    it("saves the offered extra answer when the question is switched on", async () => {
      tearDownRoutes();
      // Round 2: round 1 is a PHQ-9 round and offers no extra question.
      fake = setUpRoutes("2026-11-19T16:00:00.000Z", { ...DEFAULT_EXTRA_ITEMS_CONFIG, enabled: true });
      await fake.ports.patients.savePatient(patientRecord());
      await postTaps(tapsRequest());
      const state = await json(await getState(apiRequest("/api/check-in", { method: "GET", cookie: patientCookie() })));
      const offered = state.extraItem as { id: string };
      const res = await postExtra(apiRequest("/api/check-in/extra-answer", { body: { itemId: offered.id, value: 2 }, cookie: patientCookie() }));
      expect(res.status).toBe(200);
      expect(await fake.ports.extraAnswers.getExtraAnswers(PATIENT_ID)).toHaveLength(1);
    });
  });

  describe("crisis alert from check-in screen (POST /api/check-in/crisis)", () => {
    it("refuses callers without a patient session with 401 and includes the crisis path", async () => {
      const unauth = await postCrisis(crisisRequest({ screen: "check-in" }, null));
      expect(unauth.status).toBe(401);
      expectCrisisPath(await json(unauth));

      const tampered = `${patientCookie().slice(0, -4)}AAAA`;
      const badCookie = await postCrisis(crisisRequest({ screen: "check-in" }, tampered));
      expect(badCookie.status).toBe(401);
      expectCrisisPath(await json(badCookie));
    });

    it("refuses staff callers and patient sessions from another clinic with 403 and includes the crisis path", async () => {
      const staffRes = await postCrisis(crisisRequest({ screen: "check-in" }, staffCookie()));
      expect(staffRes.status).toBe(403);
      expectCrisisPath(await json(staffRes));

      const wrongClinic = await postCrisis(crisisRequest({ screen: "check-in" }, patientCookie(PATIENT_ID, "clinic-2")));
      expect(wrongClinic.status).toBe(403);
      expectCrisisPath(await json(wrongClinic));
    });

    it("refuses requests carrying any typed/spoken words or invalid schemas with 400 without echoing words", async () => {
      const marker = "private-patient-text-marker";
      const badCases = [
        crisisRequest({ screen: "check-in", text: marker }),
        crisisRequest({ screen: "check-in", transcript: marker }),
        crisisRequest({ screen: "check-in", words: marker }),
        crisisRequest({ screen: "unknown-screen" }),
        crisisRequest({}),
      ];

      for (const req of badCases) {
        const res = await postCrisis(req);
        expect(res.status).toBe(400);
        const text = await res.text();
        const body = JSON.parse(text) as Record<string, unknown>;
        expectCrisisPath(body);
        expect(text).not.toContain(marker);
      }
    });

    it("saves a crisis event, returns the crisis path and resources, and marks duplicate: false on first call", async () => {
      const res = await postCrisis(crisisRequest());
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body).toMatchObject({
        ok: true,
        saved: true,
        duplicate: false,
      });
      expectCrisisPath(body);

      const events = await fake.ports.crisis.getCrisisEvents(PATIENT_ID);
      expect(events).toHaveLength(1);
      expect(events[0].itemId).toBe("crisis_button");
      expect(events[0].value).toBe(1);
    });

    it("merges duplicate crisis alerts while the first is unacknowledged without creating a pile of alerts", async () => {
      const first = await postCrisis(crisisRequest());
      expect(first.status).toBe(200);
      const firstBody = await json(first);
      expect(firstBody.duplicate).toBe(false);

      // Second press/request while unacknowledged
      const second = await postCrisis(crisisRequest());
      expect(second.status).toBe(200);
      const secondBody = await json(second);
      expect(secondBody).toMatchObject({
        ok: true,
        saved: true,
        duplicate: true,
      });
      expectCrisisPath(secondBody);

      // Storage still holds exactly one event
      const events = await fake.ports.crisis.getCrisisEvents(PATIENT_ID);
      expect(events).toHaveLength(1);
    });
  });

  it("sets no cookie and allows no caching on any answer", async () => {
    await fake.ports.patients.savePatient(patientRecord({ questionnaires: ["phq9", "gad7"] }));
    const responses = [
      await getState(apiRequest("/api/check-in", { method: "GET", cookie: patientCookie() })),
      await postTaps(tapsRequest()),
      await postPhq9(phq9Request({ itemId: "9", value: 2 })),
      await postGad7(apiRequest("/api/check-in/gad7", { body: { itemId: "1", value: 3 }, cookie: patientCookie() })),
      await postNotToday(apiRequest("/api/check-in/not-today", { cookie: patientCookie() })),
      await postTaps(tapsRequest({ mood: 1 })),
    ];
    for (const res of responses) {
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });
});
