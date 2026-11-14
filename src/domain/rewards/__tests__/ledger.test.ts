import { describe, expect, it } from "vitest";
import {
  DEFAULT_REWARDS_CONFIG,
  validateRewardsConfig,
} from "../config";
import {
  buildAccountSummary,
  calculateBalance,
  calculateCentsToPayout,
  canRequestPayout,
  createLedgerEntry,
} from "../ledger";
import type { RewardLedgerEntry } from "../types";

describe("Rewards Ledger Domain Logic", () => {
  describe("Rule 1: Whole cents in integers and configurable amounts", () => {
    it("has defaults of 100 cents for round, 100 for task, 1000 for payout threshold", () => {
      expect(DEFAULT_REWARDS_CONFIG.answeredRoundRewardCents).toBe(100);
      expect(DEFAULT_REWARDS_CONFIG.smallTaskRewardCents).toBe(100);
      expect(DEFAULT_REWARDS_CONFIG.payoutThresholdCents).toBe(1000);
      expect(DEFAULT_REWARDS_CONFIG.maxRewardedTasksPerLocalDay).toBe(1);
    });

    it("rejects configuration containing floating point numbers", () => {
      expect(() =>
        validateRewardsConfig({
          ...DEFAULT_REWARDS_CONFIG,
          answeredRoundRewardCents: 100.5,
        })
      ).toThrow(/positive integer whole cents/);

      expect(() =>
        validateRewardsConfig({
          ...DEFAULT_REWARDS_CONFIG,
          smallTaskRewardCents: 99.99,
        })
      ).toThrow(/positive integer whole cents/);

      expect(() =>
        validateRewardsConfig({
          ...DEFAULT_REWARDS_CONFIG,
          payoutThresholdCents: 1000.1,
        })
      ).toThrow(/positive integer whole cents/);
    });

    it("rejects negative or zero amounts in configuration", () => {
      expect(() =>
        validateRewardsConfig({
          ...DEFAULT_REWARDS_CONFIG,
          answeredRoundRewardCents: 0,
        })
      ).toThrow(/positive integer whole cents/);

      expect(() =>
        validateRewardsConfig({
          ...DEFAULT_REWARDS_CONFIG,
          payoutThresholdCents: -500,
        })
      ).toThrow(/positive integer whole cents/);
    });

    it("rejects non-integer amount when creating a ledger entry", () => {
      expect(() =>
        createLedgerEntry({
          id: "e1",
          patientId: "p1",
          kind: "answered_round",
          amountCents: 100.25,
          createdAt: "2026-11-14T10:00:00.000Z",
        })
      ).toThrow(/non-zero integer in cents/);
    });
  });

  describe("Rule 2: Append-only ledger, balance is sum, never goes below zero", () => {
    it("sums entries of kind answered_round, small_task, and payout", () => {
      const entries: RewardLedgerEntry[] = [
        createLedgerEntry({
          id: "e1",
          patientId: "p1",
          kind: "answered_round",
          amountCents: 100,
          roundNumber: 1,
          createdAt: "2026-11-14T10:00:00.000Z",
        }),
        createLedgerEntry({
          id: "e2",
          patientId: "p1",
          kind: "small_task",
          amountCents: 100,
          taskKey: "short_walk",
          localDate: "2026-11-15",
          createdAt: "2026-11-15T12:00:00.000Z",
        }),
      ];

      expect(calculateBalance(entries)).toBe(200);
    });

    it("throws if ledger balance would ever drop below zero", () => {
      const invalidEntries: RewardLedgerEntry[] = [
        createLedgerEntry({
          id: "e1",
          patientId: "p1",
          kind: "answered_round",
          amountCents: 100,
          createdAt: "2026-11-14T10:00:00.000Z",
        }),
        createLedgerEntry({
          id: "p1",
          patientId: "p1",
          kind: "payout",
          amountCents: -500,
          createdAt: "2026-11-14T11:00:00.000Z",
        }),
      ];

      expect(() => calculateBalance(invalidEntries)).toThrow(
        /Ledger invariant violated: balance cannot be negative/
      );
    });

    it("requires credits to be positive and payouts to be negative", () => {
      expect(() =>
        createLedgerEntry({
          id: "e1",
          patientId: "p1",
          kind: "answered_round",
          amountCents: -100,
          createdAt: "2026-11-14T10:00:00.000Z",
        })
      ).toThrow(/must be positive/);

      expect(() =>
        createLedgerEntry({
          id: "e2",
          patientId: "p1",
          kind: "payout",
          amountCents: 1000,
          createdAt: "2026-11-14T10:00:00.000Z",
        })
      ).toThrow(/must be negative/);
    });
  });

  describe("Rule 5: Payout moves threshold amount out, simulated flag", () => {
    it("sets isSimulated: true on every ledger entry", () => {
      const entry = createLedgerEntry({
        id: "e1",
        patientId: "p1",
        kind: "answered_round",
        amountCents: 100,
        createdAt: "2026-11-14T10:00:00.000Z",
      });
      expect(entry.isSimulated).toBe(true);

      const payoutEntry = createLedgerEntry({
        id: "p1",
        patientId: "p1",
        kind: "payout",
        amountCents: -1000,
        createdAt: "2026-11-14T12:00:00.000Z",
      });
      expect(payoutEntry.isSimulated).toBe(true);
    });

    it("evaluates payout eligibility based on threshold", () => {
      expect(canRequestPayout(900, 1000)).toBe(false);
      expect(canRequestPayout(1000, 1000)).toBe(true);
      expect(canRequestPayout(1200, 1000)).toBe(true);
    });

    it("calculates cents remaining to payout threshold correctly", () => {
      expect(calculateCentsToPayout(0, 1000)).toBe(1000);
      expect(calculateCentsToPayout(400, 1000)).toBe(600);
      expect(calculateCentsToPayout(1000, 1000)).toBe(0);
      expect(calculateCentsToPayout(1200, 1000)).toBe(0);
    });

    it("builds account summary with isSimulated and accurate balance", () => {
      const entries: RewardLedgerEntry[] = [
        createLedgerEntry({
          id: "e1",
          patientId: "p1",
          kind: "answered_round",
          amountCents: 500,
          createdAt: "2026-11-14T10:00:00.000Z",
        }),
      ];
      const summary = buildAccountSummary({
        entries,
        counts: { tasksDone: 3, roundsAnswered: 5 },
        config: DEFAULT_REWARDS_CONFIG,
      });

      expect(summary.balanceCents).toBe(500);
      expect(summary.payoutAvailable).toBe(false);
      expect(summary.centsToPayout).toBe(500);
      expect(summary.counts.tasksDone).toBe(3);
      expect(summary.counts.roundsAnswered).toBe(5);
      expect(summary.isSimulated).toBe(true);
    });
  });
});
