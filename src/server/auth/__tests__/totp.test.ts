import { beforeEach, describe, expect, it } from "vitest";
import {
  decodeBase32,
  generateTotp,
  isValidBase32Secret,
  verifyTotp,
  _resetTotpReplayProtection,
} from "@/server/auth/totp";

describe("RFC 6238 TOTP and Base32 verification (src/server/auth/totp.ts)", () => {
  const rfcAsciiSecret = "12345678901234567890";
  // The 20-byte ASCII secret "12345678901234567890" encoded in standard RFC 4648 Base32:
  const rfcBase32Secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  beforeEach(() => {
    _resetTotpReplayProtection();
  });

  describe("Base32 decoding and validation", () => {
    it("decodes RFC Base32 correctly to matching ASCII bytes", () => {
      const decoded = decodeBase32(rfcBase32Secret);
      expect(decoded.toString("ascii")).toBe(rfcAsciiSecret);
      expect(decoded.length).toBe(20);
    });

    it("handles lowercase and whitespace or hyphens gracefully", () => {
      const spaced = "gezd gnbv-gy3t qojq gezd gnbv-gy3t qojq";
      const decoded = decodeBase32(spaced);
      expect(decoded.toString("ascii")).toBe(rfcAsciiSecret);
    });

    it("identifies valid Base32 secrets with at least 16 bytes", () => {
      expect(isValidBase32Secret(rfcBase32Secret, 16)).toBe(true);
      // 16 bytes in Base32 = 26 characters
      const min16ByteSecret = "MFRGGZDFMYZXGZLDMFRGGZDFMY======";
      expect(isValidBase32Secret(min16ByteSecret, 16)).toBe(true);
    });

    it("rejects Base32 secrets that decode to fewer than 16 bytes", () => {
      // "JBSWY3DPEHPK3PXP" is 16 chars = 10 bytes (< 16 bytes)
      const shortSecret = "JBSWY3DPEHPK3PXP";
      expect(isValidBase32Secret(shortSecret, 16)).toBe(false);
      expect(() => decodeBase32(shortSecret)).not.toThrow();
      expect(decodeBase32(shortSecret).length).toBe(10);
    });

    it("rejects invalid Base32 strings with illegal characters or bad lengths", () => {
      expect(isValidBase32Secret("12345678901234567890")).toBe(false); // contains 8, 9, 0, 1
      expect(isValidBase32Secret("INVALID-BASE-32!@#")).toBe(false);
      expect(isValidBase32Secret("")).toBe(false);
    });
  });

  describe("RFC 6238 SHA-1 test vectors (secret '12345678901234567890' in ASCII)", () => {
    // RFC 6238 Appendix B Table 1:
    // Time 59 (step 1) -> 287082
    // Time 1111111109 (step 37037036) -> 081804
    // Time 1234567890 (step 41152263) -> 005924
    it("matches RFC 6238 SHA-1 test vector at time 59 (gives 287082)", () => {
      const codeFromAscii = generateTotp(rfcAsciiSecret, 59);
      expect(codeFromAscii).toBe("287082");

      const codeFromBase32 = generateTotp(rfcBase32Secret, 59);
      expect(codeFromBase32).toBe("287082");
    });

    it("matches RFC 6238 SHA-1 test vector at time 1111111109 (gives 081804)", () => {
      const codeFromAscii = generateTotp(rfcAsciiSecret, 1111111109);
      expect(codeFromAscii).toBe("081804");

      const codeFromBase32 = generateTotp(rfcBase32Secret, 1111111109);
      expect(codeFromBase32).toBe("081804");
    });

    it("matches RFC 6238 SHA-1 test vector at time 1234567890 (gives 005924)", () => {
      const codeFromAscii = generateTotp(rfcAsciiSecret, 1234567890);
      expect(codeFromAscii).toBe("005924");

      const codeFromBase32 = generateTotp(rfcBase32Secret, 1234567890);
      expect(codeFromBase32).toBe("005924");
    });
  });

  describe("Step window: accepts current and one step either side, refuses two steps away", () => {
    const time = 1234567890; // step S = 41152263, code 005924
    const stepMinus1Time = time - 30; // step S - 1
    const stepPlus1Time = time + 30; // step S + 1
    const stepMinus2Time = time - 60; // step S - 2
    const stepPlus2Time = time + 60; // step S + 2

    it("accepts code at current step", () => {
      const currentCode = generateTotp(rfcBase32Secret, time);
      const res = verifyTotp({
        secret: rfcBase32Secret,
        code: currentCode,
        timeInSeconds: time,
      });
      expect(res.ok).toBe(true);
    });

    it("accepts code from one step prior (step - 1)", () => {
      const priorCode = generateTotp(rfcBase32Secret, stepMinus1Time);
      const res = verifyTotp({
        secret: rfcBase32Secret,
        code: priorCode,
        timeInSeconds: time,
      });
      expect(res.ok).toBe(true);
    });

    it("accepts code from one step ahead (step + 1)", () => {
      const aheadCode = generateTotp(rfcBase32Secret, stepPlus1Time);
      const res = verifyTotp({
        secret: rfcBase32Secret,
        code: aheadCode,
        timeInSeconds: time,
      });
      expect(res.ok).toBe(true);
    });

    it("refuses code from two steps prior (step - 2)", () => {
      const oldCode = generateTotp(rfcBase32Secret, stepMinus2Time);
      const res = verifyTotp({
        secret: rfcBase32Secret,
        code: oldCode,
        timeInSeconds: time,
      });
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("code_mismatch");
    });

    it("refuses code from two steps ahead (step + 2)", () => {
      const futureCode = generateTotp(rfcBase32Secret, stepPlus2Time);
      const res = verifyTotp({
        secret: rfcBase32Secret,
        code: futureCode,
        timeInSeconds: time,
      });
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("code_mismatch");
    });
  });

  describe("Replay protection: a reused code is refused while valid", () => {
    const time = 1234567890;
    const account = "nurse@sim-clinic.local";

    it("refuses reusing the same code for the same account", () => {
      const currentCode = generateTotp(rfcBase32Secret, time);

      // First verification succeeds
      const first = verifyTotp({
        secret: rfcBase32Secret,
        code: currentCode,
        timeInSeconds: time,
        accountKey: account,
      });
      expect(first.ok).toBe(true);

      // Immediate reuse of the same code is refused
      const reused = verifyTotp({
        secret: rfcBase32Secret,
        code: currentCode,
        timeInSeconds: time,
        accountKey: account,
      });
      expect(reused.ok).toBe(false);
      expect(reused.reason).toBe("already_used");

      // Reuse 15 seconds later (still within same step) is also refused
      const reusedLater = verifyTotp({
        secret: rfcBase32Secret,
        code: currentCode,
        timeInSeconds: time + 15,
        accountKey: account,
      });
      expect(reusedLater.ok).toBe(false);
      expect(reusedLater.reason).toBe("already_used");
    });

    it("refuses an older step after a newer step was already accepted for that account", () => {
      const currentCode = generateTotp(rfcBase32Secret, time);
      const priorCode = generateTotp(rfcBase32Secret, time - 30);

      // Accept current step
      const first = verifyTotp({
        secret: rfcBase32Secret,
        code: currentCode,
        timeInSeconds: time,
        accountKey: account,
      });
      expect(first.ok).toBe(true);

      // Older code from step - 1 is refused for this account
      const older = verifyTotp({
        secret: rfcBase32Secret,
        code: priorCode,
        timeInSeconds: time,
        accountKey: account,
      });
      expect(older.ok).toBe(false);
      expect(older.reason).toBe("already_used");
    });

    it("accepts subsequent step once time advances", () => {
      const currentCode = generateTotp(rfcBase32Secret, time);
      const nextTime = time + 30;
      const nextCode = generateTotp(rfcBase32Secret, nextTime);

      const first = verifyTotp({
        secret: rfcBase32Secret,
        code: currentCode,
        timeInSeconds: time,
        accountKey: account,
      });
      expect(first.ok).toBe(true);

      const next = verifyTotp({
        secret: rfcBase32Secret,
        code: nextCode,
        timeInSeconds: nextTime,
        accountKey: account,
      });
      expect(next.ok).toBe(true);
    });

    it("allows another account to use its own code independently", () => {
      const currentCode = generateTotp(rfcBase32Secret, time);

      const resA = verifyTotp({
        secret: rfcBase32Secret,
        code: currentCode,
        timeInSeconds: time,
        accountKey: "nurse@sim-clinic.local",
      });
      expect(resA.ok).toBe(true);

      const resB = verifyTotp({
        secret: rfcBase32Secret,
        code: currentCode,
        timeInSeconds: time,
        accountKey: "admin@sim-clinic.local",
      });
      expect(resB.ok).toBe(true);
    });
  });

  describe("Wrong length or non-digits refused", () => {
    const time = 1234567890;

    it.each([
      ["empty string", ""],
      ["5 digits", "12345"],
      ["7 digits", "1234567"],
      ["all letters", "abcdef"],
      ["letters and digits", "00592a"],
      ["with symbols", "00592#"],
      ["with spaces", " 005924 "],
    ])("refuses %s (%s)", (_desc, code) => {
      const res = verifyTotp({
        secret: rfcBase32Secret,
        code,
        timeInSeconds: time,
      });
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("invalid_format");
    });
  });
});
