import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getSuggestion, POST as postSuggestionChoice } from "@/app/api/patient/suggestion/route";
import { GET as getConsent, POST as postConsent } from "@/app/api/patient/consent/route";
import {
  apiRequest,
  PATIENT_ID,
  patientCookie,
  patientRecord,
  setUpRoutes,
  staffCookie,
  tearDownRoutes,
} from "@/app/api/__tests__/route-test-kit";
import type { StoredSuggestion } from "@/usecases/ports";

type Fake = ReturnType<typeof setUpRoutes>;

const OTHER_PATIENT_ID = "patient-b";

function suggestionRecord(id: string, patientId: string = PATIENT_ID, overrides: Partial<StoredSuggestion> = {}): StoredSuggestion {
  return {
    id,
    patientId,
    clinicId: "clinic-1",
    createdAt: "2026-11-16T10:00:00.000Z",
    date: "2026-11-16",
    dayIndex: 1,
    reason: "practice",
    actionKey: "short_walk",
    actionTitle: "Take a 10-minute walk outside",
    actionDetail: "Step outside for ten minutes at an easy pace.",
    effortTier: "low",
    status: "shown",
    respondedAt: null,
    isSimulated: true,
    ...overrides,
  };
}

describe("patient API routes", () => {
  let fake: Fake;

  beforeEach(async () => {
    fake = setUpRoutes();
    await fake.ports.patients.savePatient(patientRecord());
    await fake.ports.patients.savePatient(patientRecord({ patientId: OTHER_PATIENT_ID }));
  });

  afterEach(() => {
    tearDownRoutes();
  });

  describe("authentication and role guards", () => {
    it("returns 401 for unauthenticated calls", async () => {
      const getSugRes = await getSuggestion(apiRequest("/api/patient/suggestion", { method: "GET" }));
      expect(getSugRes.status).toBe(401);

      const postSugRes = await postSuggestionChoice(
        apiRequest("/api/patient/suggestion", { method: "POST", body: { suggestionId: "sug-1", choice: "accepted" } })
      );
      expect(postSugRes.status).toBe(401);

      const getConsentRes = await getConsent(apiRequest("/api/patient/consent", { method: "GET" }));
      expect(getConsentRes.status).toBe(401);

      const postConsentRes = await postConsent(
        apiRequest("/api/patient/consent", { method: "POST", body: { method: "ring", enabled: false } })
      );
      expect(postConsentRes.status).toBe(401);
    });

    it("returns 403 for staff sessions", async () => {
      const cookie = staffCookie();

      const getSugRes = await getSuggestion(apiRequest("/api/patient/suggestion", { method: "GET", cookie }));
      expect(getSugRes.status).toBe(403);

      const postSugRes = await postSuggestionChoice(
        apiRequest("/api/patient/suggestion", {
          method: "POST",
          body: { suggestionId: "sug-1", choice: "accepted" },
          cookie,
        })
      );
      expect(postSugRes.status).toBe(403);

      const getConsentRes = await getConsent(apiRequest("/api/patient/consent", { method: "GET", cookie }));
      expect(getConsentRes.status).toBe(403);

      const postConsentRes = await postConsent(
        apiRequest("/api/patient/consent", {
          method: "POST",
          body: { method: "ring", enabled: false },
          cookie,
        })
      );
      expect(postConsentRes.status).toBe(403);
    });
  });

  describe("suggestion routes", () => {
    it("returns null when no suggestion is stored", async () => {
      const res = await getSuggestion(apiRequest("/api/patient/suggestion", { method: "GET", cookie: patientCookie() }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.suggestion).toBeNull();
    });

    it("returns the patient's current suggestion from storage", async () => {
      const sug = suggestionRecord("sug-1", PATIENT_ID);
      await fake.ports.suggestions.saveSuggestion(sug);

      const res = await getSuggestion(apiRequest("/api/patient/suggestion", { method: "GET", cookie: patientCookie() }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.suggestion).toEqual(sug);
    });

    it("records choice accepted and updates status", async () => {
      const sug = suggestionRecord("sug-1", PATIENT_ID);
      await fake.ports.suggestions.saveSuggestion(sug);

      const res = await postSuggestionChoice(
        apiRequest("/api/patient/suggestion", {
          method: "POST",
          body: { suggestionId: "sug-1", choice: "accepted" },
          cookie: patientCookie(),
        })
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.recorded).toBe(true);
      expect(json.status).toBe("accepted");

      const stored = await fake.ports.suggestions.getSuggestion("sug-1");
      expect(stored?.status).toBe("accepted");
    });

    it("records choice skipped and updates status", async () => {
      const sug = suggestionRecord("sug-1", PATIENT_ID);
      await fake.ports.suggestions.saveSuggestion(sug);

      const res = await postSuggestionChoice(
        apiRequest("/api/patient/suggestion", {
          method: "POST",
          body: { suggestionId: "sug-1", choice: "skipped" },
          cookie: patientCookie(),
        })
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.recorded).toBe(true);
      expect(json.status).toBe("skipped");

      const stored = await fake.ports.suggestions.getSuggestion("sug-1");
      expect(stored?.status).toBe("skipped");
    });

    it("refuses a second choice on the same suggestion with 409", async () => {
      const sug = suggestionRecord("sug-1", PATIENT_ID);
      await fake.ports.suggestions.saveSuggestion(sug);

      const first = await postSuggestionChoice(
        apiRequest("/api/patient/suggestion", {
          method: "POST",
          body: { suggestionId: "sug-1", choice: "accepted" },
          cookie: patientCookie(),
        })
      );
      expect(first.status).toBe(200);

      const second = await postSuggestionChoice(
        apiRequest("/api/patient/suggestion", {
          method: "POST",
          body: { suggestionId: "sug-1", choice: "skipped" },
          cookie: patientCookie(),
        })
      );
      expect(second.status).toBe(409);
      const json = await second.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe("already_answered");
    });

    it("refuses when a patient tries to answer another patient's suggestion with 403", async () => {
      const sugOther = suggestionRecord("sug-other", OTHER_PATIENT_ID);
      await fake.ports.suggestions.saveSuggestion(sugOther);

      const res = await postSuggestionChoice(
        apiRequest("/api/patient/suggestion", {
          method: "POST",
          body: { suggestionId: "sug-other", choice: "accepted" },
          cookie: patientCookie(PATIENT_ID),
        })
      );
      expect(res.status).toBe(403);
    });

    it("returns 400 on malformed body payload", async () => {
      const res = await postSuggestionChoice(
        apiRequest("/api/patient/suggestion", {
          method: "POST",
          body: { suggestionId: "", choice: "invalid" },
          cookie: patientCookie(),
        })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("consent routes", () => {
    it("returns the patient consent switches", async () => {
      const res = await getConsent(apiRequest("/api/patient/consent", { method: "GET", cookie: patientCookie() }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.consent).toBeDefined();
      expect(json.consent.taking_part).toBe(true);
    });

    it("updates a method switch and returns the updated state", async () => {
      const res = await postConsent(
        apiRequest("/api/patient/consent", {
          method: "POST",
          body: { method: "ring", enabled: false },
          cookie: patientCookie(),
        })
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.method).toBe("ring");
      expect(json.enabled).toBe(false);

      const patient = await fake.ports.patients.getPatient(PATIENT_ID);
      expect(patient?.consent.methods.ring).toBe(false);
    });

    it("returns 400 for unknown method name", async () => {
      const res = await postConsent(
        apiRequest("/api/patient/consent", {
          method: "POST",
          body: { method: "unknown_sensor", enabled: false },
          cookie: patientCookie(),
        })
      );
      expect(res.status).toBe(400);
    });
  });
});
