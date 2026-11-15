import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitExtraAnswerClient } from "../extra-question";

describe("ExtraQuestion helper and client logic (extra-question.test.ts)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits extra answer via POST /api/check-in/extra-answer", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, saved: true }),
    } as Response);

    const result = await submitExtraAnswerClient({ itemId: "extra_sleep", value: 3 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.saved).toBe(true);
    }

    expect(fetch).toHaveBeenCalledWith("/api/check-in/extra-answer", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ itemId: "extra_sleep", value: 3 }),
    });
  });

  it("returns error on non-ok HTTP status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ ok: false, error: "invalid" }),
    } as Response);

    const result = await submitExtraAnswerClient({ itemId: "extra_sleep", value: 5 });
    expect(result.ok).toBe(false);
  });
});
