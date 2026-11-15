import { describe, expect, it } from "vitest";
import { evaluateExpressivityRange } from "../expressivity-range";

describe("evaluateExpressivityRange", () => {
  describe("insufficient history", () => {
    it("returns insufficient_history when history is empty", () => {
      const result = evaluateExpressivityRange([], 0.35);
      expect(result.status).toBe("insufficient_history");
      if (result.status === "insufficient_history") {
        expect(result.count).toBe(0);
        expect(result.minimum).toBe(5);
      }
    });

    it("returns insufficient_history when history has exactly 4 readings", () => {
      const history = [0.2, 0.25, 0.3, 0.35];
      const result = evaluateExpressivityRange(history, 0.28);
      expect(result.status).toBe("insufficient_history");
      if (result.status === "insufficient_history") {
        expect(result.count).toBe(4);
        expect(result.minimum).toBe(5);
      }
    });
  });

  describe("sufficient history (5 or more readings)", () => {
    it("evaluates exactly 5 readings within usual range", () => {
      // Mean: (0.2 + 0.3 + 0.4 + 0.5 + 0.6) / 5 = 0.4
      // Deviations: -0.2, -0.1, 0, 0.1, 0.2
      // Sq deviations: 0.04 + 0.01 + 0 + 0.01 + 0.04 = 0.10
      // Sample variance: 0.10 / 4 = 0.025
      // Sample SD: sqrt(0.025) ≈ 0.158113883
      // 1.5 * SD ≈ 0.23717
      // Range: [0.4 - 0.23717, 0.4 + 0.23717] ≈ [0.16283, 0.63717]
      const history = [0.2, 0.3, 0.4, 0.5, 0.6];
      const latest = 0.45; // inside range

      const result = evaluateExpressivityRange(history, latest);
      expect(result.status).toBe("within_usual_range");
      if (result.status !== "insufficient_history") {
        expect(result.position).toBe("within_usual_range");
        expect(result.sampleCount).toBe(5);
        expect(result.mean).toBeCloseTo(0.4, 4);
        expect(result.sd).toBeCloseTo(Math.sqrt(0.025), 4);
        expect(result.lower).toBeCloseTo(0.4 - 1.5 * Math.sqrt(0.025), 4);
        expect(result.upper).toBeCloseTo(0.4 + 1.5 * Math.sqrt(0.025), 4);
      }
    });

    it("evaluates latest reading below usual range", () => {
      const history = [0.4, 0.45, 0.5, 0.55, 0.6];
      // Mean = 0.5, SD = sqrt(0.025 / 4) ≈ 0.0790569
      // Lower bound = 0.5 - 1.5 * 0.0790569 ≈ 0.3814
      const latest = 0.2; // well below 0.3814

      const result = evaluateExpressivityRange(history, latest);
      expect(result.status).toBe("below_usual_range");
      if (result.status !== "insufficient_history") {
        expect(result.position).toBe("below_usual_range");
        expect(result.sampleCount).toBe(5);
      }
    });

    it("evaluates latest reading above usual range", () => {
      const history = [0.2, 0.22, 0.25, 0.28, 0.3];
      // Mean ≈ 0.25, SD ≈ 0.0406
      // Upper bound ≈ 0.25 + 1.5 * 0.0406 ≈ 0.311
      const latest = 0.55; // well above 0.311

      const result = evaluateExpressivityRange(history, latest);
      expect(result.status).toBe("above_usual_range");
      if (result.status !== "insufficient_history") {
        expect(result.position).toBe("above_usual_range");
        expect(result.sampleCount).toBe(5);
      }
    });
  });

  describe("zero spread (all past readings equal)", () => {
    // Decision: When sample SD is 0, the usual range collapses to a point [mean, mean].
    // The latest reading is within_usual_range if and only if it equals the mean.
    const flatHistory = [0.35, 0.35, 0.35, 0.35, 0.35];

    it("returns within_usual_range and point range when latest equals the constant mean", () => {
      const result = evaluateExpressivityRange(flatHistory, 0.35);
      expect(result.status).toBe("within_usual_range");
      if (result.status !== "insufficient_history") {
        expect(result.position).toBe("within_usual_range");
        expect(result.mean).toBe(0.35);
        expect(result.sd).toBe(0);
        expect(result.lower).toBe(0.35);
        expect(result.upper).toBe(0.35);
      }
    });

    it("returns below_usual_range when latest is strictly less than constant mean", () => {
      const result = evaluateExpressivityRange(flatHistory, 0.34);
      expect(result.status).toBe("below_usual_range");
      if (result.status !== "insufficient_history") {
        expect(result.position).toBe("below_usual_range");
        expect(result.mean).toBe(0.35);
        expect(result.sd).toBe(0);
      }
    });

    it("returns above_usual_range when latest is strictly greater than constant mean", () => {
      const result = evaluateExpressivityRange(flatHistory, 0.36);
      expect(result.status).toBe("above_usual_range");
      if (result.status !== "insufficient_history") {
        expect(result.position).toBe("above_usual_range");
        expect(result.mean).toBe(0.35);
        expect(result.sd).toBe(0);
      }
    });
  });

  describe("input validation and rejection of invalid data", () => {
    it("rejects non-finite values in history", () => {
      expect(() =>
        evaluateExpressivityRange([0.2, 0.3, NaN, 0.4, 0.5], 0.3)
      ).toThrow();
      expect(() =>
        evaluateExpressivityRange([0.2, 0.3, Infinity, 0.4, 0.5], 0.3)
      ).toThrow();
      expect(() =>
        evaluateExpressivityRange([0.2, 0.3, -Infinity, 0.4, 0.5], 0.3)
      ).toThrow();
    });

    it("rejects out-of-range values in history (< 0 or > 1)", () => {
      expect(() =>
        evaluateExpressivityRange([0.2, 0.3, -0.01, 0.4, 0.5], 0.3)
      ).toThrow();
      expect(() =>
        evaluateExpressivityRange([0.2, 0.3, 1.05, 0.4, 0.5], 0.3)
      ).toThrow();
    });

    it("rejects missing or invalid latest reading", () => {
      expect(() =>
        evaluateExpressivityRange([0.2, 0.3, 0.4, 0.5, 0.6], undefined as unknown as number)
      ).toThrow();
      expect(() =>
        evaluateExpressivityRange([0.2, 0.3, 0.4, 0.5, 0.6], null as unknown as number)
      ).toThrow();
      expect(() =>
        evaluateExpressivityRange([0.2, 0.3, 0.4, 0.5, 0.6], NaN)
      ).toThrow();
      expect(() =>
        evaluateExpressivityRange([0.2, 0.3, 0.4, 0.5, 0.6], -0.1)
      ).toThrow();
      expect(() =>
        evaluateExpressivityRange([0.2, 0.3, 0.4, 0.5, 0.6], 1.2)
      ).toThrow();
    });
  });
});
