import crypto from "node:crypto";
import { z } from "zod";
import { getEnv } from "@/server/env";
import { timingSafeEqualString } from "./crypto";

const deviceKeyRegistrySchema = z.record(
  z.string().min(1),
  z.object({
    tokenHash: z.string().regex(/^[a-f0-9]{64}$/i),
    revoked: z.boolean().optional().default(false),
  })
);

const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const seenNonces = new Map<string, number>();

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Verifies a hardware device bearer token against either:
 *  1) Per-device SHA-256 hashed, revocable registry (`ARDUINO_DEVICE_KEYS_JSON`), or
 *  2) Legacy fallback `ARDUINO_INGEST_TOKEN` (hashed before comparison).
 */
export function verifyArduinoDeviceCredential(
  deviceId: string,
  bearerToken: string | null
): { ok: true } | { ok: false; reason: string } {
  const env = getEnv();

  if (env.ARDUINO_DEVICE_KEYS_JSON.length > 0) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(env.ARDUINO_DEVICE_KEYS_JSON);
    } catch {
      return { ok: false, reason: "Invalid server device key registry." };
    }
    const registry = deviceKeyRegistrySchema.safeParse(parsedJson);
    if (!registry.success) {
      return { ok: false, reason: "Malformed server device key registry." };
    }
    const entry = registry.data[deviceId];
    if (entry) {
      if (entry.revoked) {
        return { ok: false, reason: "Device credential has been revoked." };
      }
      if (!bearerToken) {
        return { ok: false, reason: "Missing hardware bearer token." };
      }
      const presentedHash = sha256Hex(bearerToken).toLowerCase();
      if (!timingSafeEqualString(presentedHash, entry.tokenHash.toLowerCase())) {
        return { ok: false, reason: "Invalid hardware bearer token." };
      }
      return { ok: true };
    }
  }

  if (env.ARDUINO_INGEST_TOKEN.length > 0) {
    if (!bearerToken) {
      return { ok: false, reason: "Missing hardware bearer token." };
    }
    const expectedHash = sha256Hex(env.ARDUINO_INGEST_TOKEN);
    const presentedHash = sha256Hex(bearerToken);
    if (!timingSafeEqualString(presentedHash, expectedHash)) {
      return { ok: false, reason: "Invalid hardware bearer token." };
    }
    return { ok: true };
  }

  return { ok: false, reason: "No hardware ingest credentials configured." };
}

/**
 * Enforces timestamp freshness (±5 min) and single-use nonce replay protection
 * per deviceId.
 */
export function checkAndRecordDeviceReplay(
  deviceId: string,
  timestampMs: number | undefined,
  nonce: string | undefined,
  nowMs: number = Date.now()
): { ok: true } | { ok: false; status: 401 | 409; reason: string } {
  if (typeof timestampMs !== "number" || !Number.isFinite(timestampMs)) {
    return {
      ok: false,
      status: 401,
      reason: "Hardware ingest requires timestampMs within +/- 5 minutes.",
    };
  }
  if (Math.abs(nowMs - timestampMs) > MAX_CLOCK_SKEW_MS) {
    return {
      ok: false,
      status: 401,
      reason: "Hardware timestampMs is expired or outside allowed clock skew.",
    };
  }
  if (!nonce || nonce.trim().length < 8) {
    return {
      ok: false,
      status: 401,
      reason: "Hardware ingest requires a unique nonce (min 8 chars).",
    };
  }

  const cutoff = nowMs - MAX_CLOCK_SKEW_MS;
  for (const [key, seenAt] of seenNonces.entries()) {
    if (seenAt < cutoff) {
      seenNonces.delete(key);
    }
  }

  const replayKey = `${deviceId}:${nonce.trim()}`;
  if (seenNonces.has(replayKey)) {
    return {
      ok: false,
      status: 409,
      reason: "Replayed hardware nonce rejected.",
    };
  }

  seenNonces.set(replayKey, nowMs);
  return { ok: true };
}

export function _resetDeviceReplays(): void {
  seenNonces.clear();
}
