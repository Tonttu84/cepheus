import crypto from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Constant-time string comparison using SHA-256 digests so comparison timing
 * leaks neither contents nor length.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB) && a.length === b.length;
}

/**
 * Decodes an RFC 4648 Base32 encoded string into a Buffer.
 * Ignores whitespace, hyphens, and trailing padding '=' characters.
 * Throws an Error if invalid characters or length are encountered.
 */
export function decodeBase32(input: string): Buffer {
  if (typeof input !== "string") {
    throw new Error("Base32 input must be a string");
  }

  const cleaned = input.toUpperCase().replace(/[\s-]/g, "");
  const unpadded = cleaned.replace(/=+$/, "");
  if (unpadded.length === 0) {
    throw new Error("Invalid Base32: empty input");
  }

  for (let i = 0; i < unpadded.length; i++) {
    if (!BASE32_ALPHABET.includes(unpadded[i])) {
      throw new Error(`Invalid Base32: illegal character "${unpadded[i]}"`);
    }
  }

  const rem = unpadded.length % 8;
  if (rem === 1 || rem === 3 || rem === 6) {
    throw new Error(`Invalid Base32: invalid length modulo 8 (${rem})`);
  }

  let bits = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (let i = 0; i < unpadded.length; i++) {
    const val = BASE32_ALPHABET.indexOf(unpadded[i]);
    bits = (bits << 5) | val;
    bitCount += 5;

    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >> bitCount) & 0xff);
    }
  }

  if (bitCount > 0) {
    const mask = (1 << bitCount) - 1;
    if ((bits & mask) !== 0) {
      throw new Error("Invalid Base32: non-zero padding bits");
    }
  }

  return Buffer.from(bytes);
}

/**
 * Returns true if the input is valid Base32 and decodes to at least minBytes.
 */
export function isValidBase32Secret(input: string, minBytes = 16): boolean {
  try {
    const buf = decodeBase32(input);
    return buf.length >= minBytes;
  } catch {
    return false;
  }
}

function resolveSecretBytes(secret: string | Buffer): Buffer {
  if (Buffer.isBuffer(secret)) {
    return secret;
  }
  if (isValidBase32Secret(secret, 1)) {
    return decodeBase32(secret);
  }
  return Buffer.from(secret, "ascii");
}

export interface TotpOptions {
  stepSeconds?: number;
  digits?: number;
}

/**
 * Generates an RFC 6238 TOTP (HMAC-SHA1) code for a given timestamp.
 */
export function generateTotp(
  secret: string | Buffer,
  timeInSeconds: number = Math.floor(Date.now() / 1000),
  options: TotpOptions = {}
): string {
  const stepSeconds = options.stepSeconds ?? 30;
  const digits = options.digits ?? 6;
  const keyBytes = resolveSecretBytes(secret);

  const step = Math.floor(timeInSeconds / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(step), 0);

  const hmac = crypto
    .createHmac("sha1", keyBytes)
    .update(counterBuffer)
    .digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const modulo = 10 ** digits;
  const otp = binary % modulo;
  return String(otp).padStart(digits, "0");
}

export interface VerifyTotpOptions extends TotpOptions {
  secret: string | Buffer;
  code: string;
  timeInSeconds?: number;
  window?: number;
  accountKey?: string;
}

export interface VerifyTotpResult {
  ok: boolean;
  reason?: "invalid_format" | "code_mismatch" | "already_used";
  matchedStep?: number;
}

// In-memory record of the last accepted step per account to prevent replay attacks.
const lastAcceptedStepPerAccount = new Map<string, number>();

/**
 * Verifies a 6-digit TOTP code against a secret within the configured window.
 * Compares candidate codes in constant time and prevents code reuse per account.
 */
export function verifyTotp(options: VerifyTotpOptions): VerifyTotpResult {
  const {
    secret,
    code,
    timeInSeconds = Math.floor(Date.now() / 1000),
    stepSeconds = 30,
    digits = 6,
    window = 1,
    accountKey,
  } = options;

  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return { ok: false, reason: "invalid_format" };
  }

  const currentStep = Math.floor(timeInSeconds / stepSeconds);
  const candidateSteps: number[] = [];
  for (let offset = -window; offset <= window; offset++) {
    candidateSteps.push(currentStep + offset);
  }

  let matchedStep: number | undefined;

  for (const step of candidateSteps) {
    const candidateTime = step * stepSeconds;
    const expectedCode = generateTotp(secret, candidateTime, {
      stepSeconds,
      digits,
    });

    if (timingSafeEqual(code, expectedCode)) {
      matchedStep = step;
      break;
    }
  }

  if (matchedStep === undefined) {
    return { ok: false, reason: "code_mismatch" };
  }

  if (accountKey) {
    const normalizedKey = accountKey.trim().toLowerCase();
    const lastStep = lastAcceptedStepPerAccount.get(normalizedKey);
    if (lastStep !== undefined && matchedStep <= lastStep) {
      return { ok: false, reason: "already_used", matchedStep };
    }
    lastAcceptedStepPerAccount.set(normalizedKey, matchedStep);
  }

  return { ok: true, matchedStep };
}

/**
 * Resets the in-memory TOTP replay protection tracking (used in tests).
 */
export function _resetTotpReplayProtection(): void {
  lastAcceptedStepPerAccount.clear();
}
