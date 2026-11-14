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
});
