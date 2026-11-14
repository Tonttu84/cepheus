import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  generatePkcePair,
  generateStateToken,
  sealJson,
  timingSafeEqualString,
  unsealJson,
} from "../crypto";
import { extractBearerToken, verifySameOrigin } from "../http";
import { _resetRateLimits, checkRateLimit } from "../rate-limit";

const TEST_SECRET = "0123456789abcdef0123456789abcdef";

describe("Server Security Utilities (src/server/security)", () => {
  it("seals and unseals JSON with AES-256-GCM and rejects tampering or expiry", () => {
    const sealed = sealJson({ accessToken: "secret-tok", scope: "sleep" }, 60_000, TEST_SECRET);
    const unsealed = unsealJson<{ accessToken: string; scope: string }>(
      sealed,
      TEST_SECRET
    );
    expect(unsealed).toEqual({ accessToken: "secret-tok", scope: "sleep" });

    // Tampered ciphertext returns null
    const parts = sealed.split(".");
    const tampered = `${parts[0]}.${parts[1].slice(0, -2)}AA.${parts[2]}`;
    expect(unsealJson(tampered, TEST_SECRET)).toBeNull();

    // Wrong key returns null
    expect(unsealJson(sealed, "wrong-secret-key-wrong-secret-key!")).toBeNull();

    // Expired envelope returns null
    const expired = sealJson({ ok: true }, -10, TEST_SECRET);
    expect(unsealJson(expired, TEST_SECRET)).toBeNull();
  });

  it("generates valid RFC 7636 S256 PKCE code pairs and state tokens", () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const expected = crypto
      .createHash("sha256")
      .update(codeVerifier, "ascii")
      .digest("base64url");
    expect(codeChallenge).toBe(expected);
    expect(generateStateToken().length).toBeGreaterThanOrEqual(32);
  });

  it("compares strings in constant time", () => {
    expect(timingSafeEqualString("abc123", "abc123")).toBe(true);
    expect(timingSafeEqualString("abc123", "abc124")).toBe(false);
    expect(timingSafeEqualString("abc", "abcd")).toBe(false);
  });

  it("verifies same-origin requests and extracts bearer tokens safely", () => {
    const okReq = new Request("http://localhost:3000/api/fitbit/sync", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });
    expect(verifySameOrigin(okReq)).toBe(true);

    const crossOriginReq = new Request("http://localhost:3000/api/fitbit/sync", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil.example.com",
      },
    });
    expect(verifySameOrigin(crossOriginReq)).toBe(false);

    const missingOriginReq = new Request("http://localhost:3000/api/fitbit/sync", {
      method: "POST",
      headers: { host: "localhost:3000" },
    });
    expect(verifySameOrigin(missingOriginReq)).toBe(false);

    const bearerReq = new Request("http://localhost:3000/api/arduino/ingest", {
      headers: { authorization: "Bearer my-unoq-token" },
    });
    expect(extractBearerToken(bearerReq)).toBe("my-unoq-token");
  });

  it("enforces sliding-window rate limits", () => {
    _resetRateLimits();
    const key = "test:ip";
    expect(checkRateLimit(key, 2, 1000, 100).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 1000, 200).allowed).toBe(true);
    const blocked = checkRateLimit(key, 2, 1000, 300);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(checkRateLimit(key, 2, 1000, 1200).allowed).toBe(true);
  });
});
