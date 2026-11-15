import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  _resetDeviceReplays,
  checkAndRecordDeviceReplay,
  generatePkcePair,
  generateStateToken,
  getClientKey,
  sealJson,
  sha256Hex,
  timingSafeEqualString,
  unsealJson,
  verifyArduinoDeviceCredential,
  verifyHmacSha256Signature,
} from "../index";
import { extractBearerToken, verifySameOrigin } from "../http";
import { _resetRateLimits, checkRateLimit } from "../rate-limit";
import { _resetEnv } from "@/server/env";

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

  it("verifies HMAC-SHA256 webhook signatures in constant time and rejects tampering", () => {
    const body = JSON.stringify({ test: false, steps: [{ count: 120 }] });
    const sigHex = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(body, "utf8")
      .digest("hex");

    expect(verifyHmacSha256Signature(body, `sha256=${sigHex}`, TEST_SECRET)).toBe(true);
    expect(verifyHmacSha256Signature(body, sigHex, TEST_SECRET)).toBe(true);
    expect(verifyHmacSha256Signature(`${body} `, `sha256=${sigHex}`, TEST_SECRET)).toBe(
      false
    );
    expect(verifyHmacSha256Signature(body, "sha256=deadbeef", TEST_SECRET)).toBe(false);
    expect(verifyHmacSha256Signature(body, null, TEST_SECRET)).toBe(false);
  });

  it("ignores spoofed x-forwarded-for unless TRUST_PROXY_HEADERS is true, and hashes identity hints", () => {
    const savedDb = process.env.DATABASE_URL;
    const savedTrust = process.env.TRUST_PROXY_HEADERS;
    process.env.DATABASE_URL = "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
    delete process.env.TRUST_PROXY_HEADERS;
    _resetEnv();

    try {
      const req1 = new Request("http://localhost:3000/api/fitbit/auth", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      const req2 = new Request("http://localhost:3000/api/fitbit/auth", {
        headers: { "x-forwarded-for": "5.6.7.8" },
      });
      expect(getClientKey(req1, "fitbit")).toBe("fitbit:direct");
      expect(getClientKey(req2, "fitbit")).toBe("fitbit:direct");

      const hinted = getClientKey(req1, "arduino", "unoq-desk-01");
      expect(hinted).toMatch(/^arduino:id:[a-f0-9]{16}$/);
      expect(hinted).not.toContain("unoq-desk-01");

      process.env.TRUST_PROXY_HEADERS = "true";
      _resetEnv();
      expect(getClientKey(req1, "fitbit")).toBe("fitbit:ip:1.2.3.4");
    } finally {
      if (savedDb !== undefined) process.env.DATABASE_URL = savedDb;
      if (savedTrust !== undefined) process.env.TRUST_PROXY_HEADERS = savedTrust;
      else delete process.env.TRUST_PROXY_HEADERS;
      _resetEnv();
    }
  });

  it("verifies per-device SHA-256 hashed revocable credentials and rejects replay/stale timestamps", () => {
    const savedDb = process.env.DATABASE_URL;
    const savedKeys = process.env.ARDUINO_DEVICE_KEYS_JSON;
    process.env.DATABASE_URL = "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
    const secretA = "device-secret-alpha-1234";
    const secretB = "device-secret-beta-5678";
    process.env.ARDUINO_DEVICE_KEYS_JSON = JSON.stringify({
      "unoq-active": { tokenHash: sha256Hex(secretA), revoked: false },
      "unoq-revoked": { tokenHash: sha256Hex(secretB), revoked: true },
    });
    _resetEnv();
    _resetDeviceReplays();

    try {
      expect(verifyArduinoDeviceCredential("unoq-active", secretA).ok).toBe(true);
      expect(verifyArduinoDeviceCredential("unoq-active", "wrong-secret").ok).toBe(false);
      const rev = verifyArduinoDeviceCredential("unoq-revoked", secretB);
      expect(rev.ok).toBe(false);
      if (!rev.ok) expect(rev.reason).toMatch(/revoked/i);

      const now = 1_794_650_000_000;
      expect(checkAndRecordDeviceReplay("unoq-active", now, "nonce-abcdef12", now).ok).toBe(true);
      const replay = checkAndRecordDeviceReplay("unoq-active", now, "nonce-abcdef12", now + 1000);
      expect(replay.ok).toBe(false);
      if (!replay.ok) expect(replay.status).toBe(409);

      const stale = checkAndRecordDeviceReplay("unoq-active", now - 400_000, "nonce-fresh-999", now);
      expect(stale.ok).toBe(false);
      if (!stale.ok) expect(stale.status).toBe(401);
    } finally {
      if (savedDb !== undefined) process.env.DATABASE_URL = savedDb;
      if (savedKeys !== undefined) process.env.ARDUINO_DEVICE_KEYS_JSON = savedKeys;
      else delete process.env.ARDUINO_DEVICE_KEYS_JSON;
      _resetEnv();
    }
  });

  it("enforces device replay protection: clock skew boundaries (+/-5m), 1ms beyond skew, missing nonce, and duplicate nonce", () => {
    _resetDeviceReplays();
    const now = 1_794_650_000_000;
    const deviceId = "unoq-desk-01";
    const CLOCK_SKEW_MS = 5 * 60_000; // 300,000 ms

    // Exactly at allowed clock skew: past boundary (now - 300_000)
    const exactPast = checkAndRecordDeviceReplay(deviceId, now - CLOCK_SKEW_MS, "nonce-exact-past-1", now);
    expect(exactPast.ok).toBe(true);

    // Exactly at allowed clock skew: future boundary (now + 300_000)
    const exactFuture = checkAndRecordDeviceReplay(deviceId, now + CLOCK_SKEW_MS, "nonce-exact-fut-1", now);
    expect(exactFuture.ok).toBe(true);

    // One millisecond past allowed clock skew: past (now - 300_001) -> stale refusal
    const pastSkew = checkAndRecordDeviceReplay(deviceId, now - CLOCK_SKEW_MS - 1, "nonce-past-skew-1", now);
    expect(pastSkew.ok).toBe(false);
    if (!pastSkew.ok) {
      expect(pastSkew.status).toBe(401);
      expect(pastSkew.reason).toMatch(/expired or outside allowed clock skew/i);
    }

    // One millisecond past allowed clock skew: future (now + 300_001) -> future refused like stale
    const futureSkew = checkAndRecordDeviceReplay(deviceId, now + CLOCK_SKEW_MS + 1, "nonce-future-skew-1", now);
    expect(futureSkew.ok).toBe(false);
    if (!futureSkew.ok) {
      expect(futureSkew.status).toBe(401);
      expect(futureSkew.reason).toMatch(/expired or outside allowed clock skew/i);
    }

    // Missing nonce: undefined, empty, or too short
    const missingNonce = checkAndRecordDeviceReplay(deviceId, now, undefined, now);
    expect(missingNonce.ok).toBe(false);
    if (!missingNonce.ok) {
      expect(missingNonce.status).toBe(401);
      expect(missingNonce.reason).toMatch(/unique nonce/i);
    }

    const shortNonce = checkAndRecordDeviceReplay(deviceId, now, "short", now);
    expect(shortNonce.ok).toBe(false);
    if (!shortNonce.ok) {
      expect(shortNonce.status).toBe(401);
    }

    // Nonce used twice: first succeeds, second rejected with 409
    const nonce = "nonce-replayed-12345";
    const firstUse = checkAndRecordDeviceReplay(deviceId, now, nonce, now);
    expect(firstUse.ok).toBe(true);

    const secondUse = checkAndRecordDeviceReplay(deviceId, now + 10, nonce, now + 10);
    expect(secondUse.ok).toBe(false);
    if (!secondUse.ok) {
      expect(secondUse.status).toBe(409);
      expect(secondUse.reason).toMatch(/replayed hardware nonce/i);
    }
  });

  describe("verifySameOrigin host validation and normalization (Fix A)", () => {
    it("allows example.test:80 with origin http://example.test", () => {
      const req = new Request("http://example.test/api/auth/sign-in", {
        method: "POST",
        headers: {
          host: "example.test:80",
          origin: "http://example.test",
        },
      });
      expect(verifySameOrigin(req)).toBe(true);
    });

    it("allows same-origin LAN IPv4 requests with explicit ports", () => {
      const req = new Request("http://192.168.1.42:3000/api/auth/sign-in", {
        method: "POST",
        headers: {
          host: "192.168.1.42:3000",
          origin: "http://192.168.1.42:3000",
        },
      });
      expect(verifySameOrigin(req)).toBe(true);
    });

    it("rejects host with userinfo (192.168.1.5@evil.example) even if origin matches evil.example", () => {
      const req = new Request("http://evil.example/api/auth/sign-in", {
        method: "POST",
        headers: {
          host: "192.168.1.5@evil.example",
          origin: "http://evil.example",
        },
      });
      expect(verifySameOrigin(req)).toBe(false);
    });

    it("rejects host with path or backslash before normalising", () => {
      const forwardSlashReq = new Request("http://evil.example/api/auth/sign-in", {
        method: "POST",
        headers: {
          host: "evil.example/path",
          origin: "http://evil.example",
        },
      });
      expect(verifySameOrigin(forwardSlashReq)).toBe(false);

      const backslashReq = new Request("http://evil.example/api/auth/sign-in", {
        method: "POST",
        headers: {
          host: "evil.example\\path",
          origin: "http://evil.example",
        },
      });
      expect(verifySameOrigin(backslashReq)).toBe(false);
    });

    it("rejects host containing whitespace, query or fragment characters", () => {
      for (const badHost of [
        "evil.example?query",
        "evil.example#fragment",
        "evil bad.example",
      ]) {
        const req = new Request("http://evil.example/api/auth/sign-in", {
          method: "POST",
          headers: {
            host: badHost,
            origin: "http://evil.example",
          },
        });
        expect(verifySameOrigin(req)).toBe(false);
      }

      const mockReq = {
        headers: {
          get: (header: string) => {
            if (header.toLowerCase() === "host") return "evil\nexample";
            if (header.toLowerCase() === "origin") return "http://evil.example";
            return null;
          },
        },
      } as unknown as Request;
      expect(verifySameOrigin(mockReq)).toBe(false);
    });
  });
});
