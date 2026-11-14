import crypto from "node:crypto";
import { getEnv } from "@/server/env";

const globalForSecret = globalThis as unknown as {
  __cepheusEphemeralSecret?: string;
};

/**
 * Returns the cookie-sealing secret.
 * Uses APP_SESSION_SECRET when configured; in local development/test falls back
 * to a process-scoped CSPRNG secret held only in memory (never hardcoded).
 */
export function getCookieSecret(): string {
  const env = getEnv();
  if (env.APP_SESSION_SECRET.length >= 32) {
    return env.APP_SESSION_SECRET;
  }
  if (env.NODE_ENV === "production") {
    throw new Error(
      "[security] APP_SESSION_SECRET must be at least 32 characters in production."
    );
  }
  if (!globalForSecret.__cepheusEphemeralSecret) {
    globalForSecret.__cepheusEphemeralSecret = crypto
      .randomBytes(32)
      .toString("base64url");
  }
  return globalForSecret.__cepheusEphemeralSecret;
}

function deriveAesKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export interface SealedEnvelope<T> {
  v: 1;
  exp: number;
  data: T;
}

/**
 * Encrypts and authenticates JSON data with AES-256-GCM and a TTL.
 */
export function sealJson<T>(
  data: T,
  ttlMs: number,
  secret: string = getCookieSecret()
): string {
  const key = deriveAesKey(secret);
  const iv = crypto.randomBytes(12);
  const envelope: SealedEnvelope<T> = {
    v: 1,
    exp: Date.now() + ttlMs,
    data,
  };
  const plaintext = Buffer.from(JSON.stringify(envelope), "utf8");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

/**
 * Decrypts, authenticates, and checks expiry on a sealed JSON token.
 * Returns null if invalid, tampered, or expired.
 */
export function unsealJson<T>(
  token: string | undefined | null,
  secret: string = getCookieSecret()
): T | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const [ivB64, ctB64, tagB64] = parts;
    const iv = Buffer.from(ivB64, "base64url");
    const ciphertext = Buffer.from(ctB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;

    const key = deriveAesKey(secret);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    const parsed = JSON.parse(decrypted.toString("utf8")) as SealedEnvelope<T>;
    if (
      !parsed ||
      parsed.v !== 1 ||
      typeof parsed.exp !== "number" ||
      Date.now() > parsed.exp
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function generateStateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generatePkcePair(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = crypto.randomBytes(48).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier, "ascii")
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

/**
 * Constant-time string comparison using SHA-256 digests so comparison timing
 * leaks neither contents nor length.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB) && a.length === b.length;
}
