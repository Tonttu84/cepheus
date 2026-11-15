import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCheckInState,
  submitCheckInGad7,
  submitCheckInNotToday,
  submitCheckInPhq9,
  submitCheckInTaps,
} from "../check-in-client";

describe("check-in client module (check-in-client.ts)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchCheckInState", () => {
    it("returns state when 200 OK", async () => {
      const mockState = {
        ok: true,
        openRound: { number: 2, localDate: "2026-11-16", opensAt: "...", endsAt: "..." },
        taps: "waiting",
        isPhq9Due: true,
        phq9Progress: "not_started",
        hasSuggestionWaiting: false,
        extraItem: null,
      };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockState,
      } as Response);

      const result = await fetchCheckInState();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.taps).toBe("waiting");
        expect(result.isPhq9Due).toBe(true);
      }
    });

    it("returns 401 unauthorized when unauthenticated", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await fetchCheckInState();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
        expect(result.error).toBe("unauthorized");
      }
    });

    it("returns 503 service unavailable with saved: false", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      const result = await fetchCheckInState();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(503);
        expect(result.saved).toBe(false);
      }
    });

    it("handles network failure as 503 saved: false", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network failed"));

      const result = await fetchCheckInState();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(503);
        expect(result.saved).toBe(false);
      }
    });
  });

  describe("submitCheckInTaps", () => {
    it("posts mood and interest and returns saved: true on 200", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, saved: true }),
      } as Response);

      const result = await submitCheckInTaps({ mood: 2, interest: 3 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.saved).toBe(true);
      }
      expect(fetch).toHaveBeenCalledWith("/api/check-in/taps", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ mood: 2, interest: 3 }),
      });
    });

    it("returns 401 on unauthorized response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await submitCheckInTaps({ mood: 2, interest: 3 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
      }
    });

    it("returns 503 with saved: false on server failure", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      const result = await submitCheckInTaps({ mood: 2, interest: 3 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(503);
        expect(result.saved).toBe(false);
      }
    });
  });

  describe("submitCheckInNotToday", () => {
    it("posts not-today and returns saved: true on 200", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, saved: true }),
      } as Response);

      const result = await submitCheckInNotToday();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.saved).toBe(true);
      }
      expect(fetch).toHaveBeenCalledWith("/api/check-in/not-today", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({}),
      });
    });

    it("returns 503 with saved: false when storage fails", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      const result = await submitCheckInNotToday();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(503);
        expect(result.saved).toBe(false);
      }
    });
  });

  describe("submitCheckInPhq9", () => {
    it("submits item answer and returns progress", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ ok: true, saved: true, progress: "unfinished", showCrisisPath: false }),
      } as Response);

      const result = await submitCheckInPhq9({ itemId: "1", value: 2 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.saved).toBe(true);
        expect(result.progress).toBe("unfinished");
        expect(result.showCrisisPath).toBe(false);
      }
    });

    it("flags crisis path immediately when item 9 is answered > 0 regardless of server response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
      } as Response);

      const result = await submitCheckInPhq9({ itemId: "9", value: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.showCrisisPath).toBe(true);
        expect(result.saved).toBe(false);
      }
    });

    it("flags crisis path when item 9 is answered > 0 even on network error", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network drop"));

      const result = await submitCheckInPhq9({ itemId: "9", value: 2 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.showCrisisPath).toBe(true);
      }
    });

    it("flags crisis path when server response carries showCrisisPath: true", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ ok: true, saved: true, progress: "completed", showCrisisPath: true }),
      } as Response);

      const result = await submitCheckInPhq9({ itemId: "8", value: 3 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.showCrisisPath).toBe(true);
      }
    });
  });

  describe("submitCheckInGad7", () => {
    it("posts itemId and value and returns isComplete on 200", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, saved: true, isComplete: false }),
      } as Response);

      const result = await submitCheckInGad7({ itemId: "1", value: 2 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.saved).toBe(true);
        expect(result.isComplete).toBe(false);
      }
      expect(fetch).toHaveBeenCalledWith("/api/check-in/gad7", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ itemId: "1", value: 2 }),
      });
    });

    it("handles 401 unauthorized", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await submitCheckInGad7({ itemId: "1", value: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
      }
    });

    it("handles network error as 503 saved: false", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network failed"));

      const result = await submitCheckInGad7({ itemId: "1", value: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(503);
        expect(result.saved).toBe(false);
      }
    });
  });
});
