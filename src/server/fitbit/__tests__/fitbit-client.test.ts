import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetEnv } from "@/server/env";
import {
  exchangeFitbitCode,
  fetchFitbitWindowDays,
  fitbitApiGet,
  isFitbitConfigured,
  resolveFitbitRedirectUri,
  type FitbitSealedSession,
} from "../client";

describe("Fitbit OAuth Redirect Configuration (src/server/fitbit/client.ts)", () => {
  it("refuses to start Fitbit OAuth when FITBIT_REDIRECT_URI is empty", () => {
    const savedDb = process.env.DATABASE_URL;
    const savedId = process.env.FITBIT_CLIENT_ID;
    const savedSecret = process.env.FITBIT_CLIENT_SECRET;
    const savedUri = process.env.FITBIT_REDIRECT_URI;

    process.env.DATABASE_URL =
      "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
    process.env.FITBIT_CLIENT_ID = "fitbit-id";
    process.env.FITBIT_CLIENT_SECRET = "fitbit-secret";
    delete process.env.FITBIT_REDIRECT_URI;
    _resetEnv();

    try {
      expect(isFitbitConfigured()).toBe(false);
      expect(() => resolveFitbitRedirectUri()).toThrowError(/FITBIT_REDIRECT_URI/);

      process.env.FITBIT_REDIRECT_URI = "http://localhost:3000/api/fitbit/callback";
      _resetEnv();
      expect(isFitbitConfigured()).toBe(true);
      expect(resolveFitbitRedirectUri()).toBe(
        "http://localhost:3000/api/fitbit/callback"
      );
    } finally {
      if (savedDb !== undefined) process.env.DATABASE_URL = savedDb;
      if (savedId !== undefined) process.env.FITBIT_CLIENT_ID = savedId;
      else delete process.env.FITBIT_CLIENT_ID;
      if (savedSecret !== undefined) process.env.FITBIT_CLIENT_SECRET = savedSecret;
      else delete process.env.FITBIT_CLIENT_SECRET;
      if (savedUri !== undefined) process.env.FITBIT_REDIRECT_URI = savedUri;
      else delete process.env.FITBIT_REDIRECT_URI;
      _resetEnv();
    }
  });
});

describe("Fitbit Client Timeouts, Retries, and Error Handling", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort(
          new DOMException("The operation was aborted due to timeout", "TimeoutError")
        );
      }, ms);
      return controller.signal;
    });

    process.env.DATABASE_URL =
      "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
    process.env.FITBIT_CLIENT_ID = "test-client-id";
    process.env.FITBIT_CLIENT_SECRET = "test-client-secret";
    process.env.FITBIT_REDIRECT_URI = "https://example.com/callback";
    _resetEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    process.env = { ...savedEnv };
    _resetEnv();
  });

  function createHangingFetchHandler() {
    return (_url: unknown, options?: RequestInit) => {
      const signal = options?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        if (!signal) {
          reject(new Error("fetch called without AbortSignal timeout"));
          return;
        }
        if (signal.aborted) {
          reject(
            signal.reason ??
              new DOMException("The operation was aborted due to timeout", "TimeoutError")
          );
          return;
        }
        signal.addEventListener("abort", () => {
          reject(
            signal.reason ??
              new DOMException("The operation was aborted due to timeout", "TimeoutError")
          );
        });
      });
    };
  }

  it("a 429 then success", async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("Too Many Requests", { status: 429 });
      }
      return new Response(JSON.stringify({ value: "success-after-429" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const promise = fitbitApiGet("/1/user/-/profile.json", "test-token");
    promise.catch(() => {});
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ value: "success-after-429" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("a 500 three times ends in the error result after exactly 3 attempts", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response("Internal Server Error", { status: 500 });
    });

    const promise = fitbitApiGet("/1/user/-/profile.json", "test-token");
    promise.catch(() => {});
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(/status 500/i);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("a timeout on the GET is retried", async () => {
    let callCount = 0;
    const hangingHandler = createHangingFetchHandler();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
      callCount++;
      if (callCount === 1) {
        return hangingHandler(url, options);
      }
      return new Response(JSON.stringify({ value: "recovered-after-timeout" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const promise = fitbitApiGet("/1/user/-/profile.json", "test-token");
    promise.catch(() => {});
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ value: "recovered-after-timeout" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("a 400 is not retried", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response("Bad Request", { status: 400 });
    });

    const promise = fitbitApiGet("/1/user/-/profile.json", "test-token");
    promise.catch(() => {});
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(/status 400/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("a timeout on a token POST returns the error result after exactly 1 attempt", async () => {
    const hangingHandler = createHangingFetchHandler();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(hangingHandler);

    const promise = exchangeFitbitCode({
      code: "sample-auth-code",
      codeVerifier: "sample-code-verifier",
      redirectUri: "https://example.com/callback",
    });
    promise.catch(() => {});
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(/timed out/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("Retry-After: 2 is honoured", async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("Rate limit exceeded", {
          status: 429,
          headers: { "Retry-After": "2" },
        });
      }
      return new Response(JSON.stringify({ rateLimited: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const promise = fitbitApiGet("/1/user/-/profile.json", "test-token");
    promise.catch(() => {});

    // Before 2000ms: retry has not been fired yet
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // At 2000ms: retry fires
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const result = await promise;
    expect(result).toEqual({ rateLimited: false });
  });

  it("logs failures once with route, status/error kind, attempt count and no secrets", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response("Server Error", { status: 500 });
    });

    const promise = fitbitApiGet("/1/user/-/activities/steps.json", "sensitive-access-token-12345");
    promise.catch(() => {});
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow(/status 500/i);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logMessage = consoleErrorSpy.mock.calls[0].join(" ");
    expect(logMessage).toContain("/1/user/-/activities/steps.json");
    expect(logMessage).toContain("500");
    expect(logMessage).toContain("3");
    expect(logMessage).not.toContain("sensitive-access-token-12345");
  });

  it("preserves patientId across token refresh in fetchFitbitWindowDays", async () => {
    const expiredSession: FitbitSealedSession = {
      accessToken: "old-access-token",
      refreshToken: "old-refresh-token",
      expiresAtMs: Date.now() - 1000,
      scope: "activity heartrate sleep",
      patientId: "patient-123",
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/oauth2/token")) {
        return new Response(
          JSON.stringify({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
            scope: "activity heartrate sleep",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/sleep/date/")) {
        return new Response(JSON.stringify({ sleep: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/activities/steps/date/")) {
        return new Response(JSON.stringify({ "activities-steps": [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/activities/heart/date/")) {
        return new Response(JSON.stringify({ "activities-heart": [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const result = await fetchFitbitWindowDays(expiredSession, "2026-11-15", 1);
    expect(result.updatedSession.patientId).toBe("patient-123");
    expect(result.updatedSession.accessToken).toBe("new-access-token");
  });
});
