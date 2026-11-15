import { describe, it, expect } from "vitest";
import { creditAnsweredRound } from "../credit-answered-round";
import { createFakeRewardsPorts } from "../testing/fake-ports";
import type { Actor } from "../../../domain/access/types";

describe("Rewards use cases", () => {
  const actor: Actor = { kind: "patient", patientId: "p1", clinicId: "c1" };

  it("credits an answered round once", async () => {
    const ports = createFakeRewardsPorts();
    ports.rounds.setRoundOutcome("p1", {
      roundNumber: 1,
      localDate: "2026-11-14",
      status: "answered",
    });

    const res1 = await creditAnsweredRound(actor, { patientId: "p1", roundNumber: 1 }, ports);
    expect(res1.ok).toBe(true);
    if (res1.ok) {
      expect(res1.value.rewarded).toBe(true);
      expect(res1.value.amountCents).toBe(100);
      expect(res1.value.balanceCents).toBe(100);
    }

    const res2 = await creditAnsweredRound(actor, { patientId: "p1", roundNumber: 1 }, ports);
    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.value.rewarded).toBe(false); // Duplicate
      expect(res2.value.balanceCents).toBe(100);
    }
  });

  it("does not credit a missed round", async () => {
    const ports = createFakeRewardsPorts();
    ports.rounds.setRoundOutcome("p1", {
      roundNumber: 2,
      localDate: "2026-11-15",
      status: "missed",
    });

    const res = await creditAnsweredRound(actor, { patientId: "p1", roundNumber: 2 }, ports);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.rewarded).toBe(false);
      expect(res.value.reason).toBe("round_not_answered");
      expect(res.value.balanceCents).toBe(0);
    }
  });

  it("does not credit when disabled", async () => {
    const ports = createFakeRewardsPorts({ config: { enabled: false } });
    ports.rounds.setRoundOutcome("p1", {
      roundNumber: 3,
      localDate: "2026-11-16",
      status: "answered",
    });

    const res = await creditAnsweredRound(actor, { patientId: "p1", roundNumber: 3 }, ports);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("not enabled");
    }
  });
});
