import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setUpRoutes, tearDownRoutes, patientCookie, staffCookie } from "../../__tests__/route-test-kit";
import { getRouteDeps, setRouteDepsForTests } from "@/server/api";
import { createFakeRewardsPorts, type FakeRewardsPorts } from "@/usecases/rewards/testing/fake-ports";
import { createLedgerEntry } from "@/domain/rewards/ledger";

describe("Rewards routes", () => {
  let fakeRewards: FakeRewardsPorts;

  beforeAll(() => {
    setUpRoutes();
    fakeRewards = createFakeRewardsPorts();
    fakeRewards.patients.setPatient({
      patientId: "P-SIM-001",
      clinicId: "clinic-1",
      schedule: {
        weekdays: [2, 5],
        timeOfDay: "09:00",
        timeZone: "Europe/Helsinki",
        enrolmentDate: "2026-11-01",
      },
    });
    const current = getRouteDeps();
    setRouteDepsForTests(() => ({
      ...current,
      rewardsPorts: fakeRewards,
    }));
  });
  
  afterAll(() => {
    tearDownRoutes();
  });

  async function getAccount(cookie?: string) {
    const headers = new Headers();
    if (cookie) headers.set("cookie", cookie);
    return new Request("http://localhost:3000/api/rewards/account", {
      method: "GET",
      headers,
    });
  }

  async function postPayout(cookie?: string, body?: object) {
    const headers = new Headers();
    if (cookie) headers.set("cookie", cookie);
    if (body) headers.set("content-type", "application/json");
    return new Request("http://localhost:3000/api/rewards/payout", {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("returns 401 signed out", async () => {
    const req = await getAccount();
    const { GET } = await import("../account/route");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for staff", async () => {
    const req = await getAccount(staffCookie());
    const { GET } = await import("../account/route");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 200 for signed-in patient reading their account", async () => {
    const req = await getAccount(patientCookie("P-SIM-001"));
    const { GET } = await import("../account/route");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.isSimulated).toBe(true);
    expect(json.counts.walks).toBeDefined();
    expect(json.counts.roundsAnswered).toBeDefined();
  });

  describe("POST /api/rewards/payout", () => {
    it("returns 401 signed out", async () => {
      const req = await postPayout();
      const { POST } = await import("../payout/route");
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 for staff", async () => {
      const req = await postPayout(staffCookie());
      const { POST } = await import("../payout/route");
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("refuses payout below 10 euros with 400", async () => {
      const req = await postPayout(patientCookie("P-SIM-001"), { requestId: "req-low-bal" });
      const { POST } = await import("../payout/route");
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe("Insufficient balance for payout.");
    });

    it("at or above 10 euros: balance goes down, entry written, marked simulated, and pressing twice does not pay twice", async () => {
      // Seed 1000 cents (10 euros)
      for (let r = 1; r <= 10; r++) {
        await fakeRewards.ledger.appendEntry(
          createLedgerEntry({
            id: `route-seed-credit-${r}`,
            patientId: "P-SIM-001",
            kind: "answered_round",
            amountCents: 100,
            roundNumber: r,
            createdAt: `2026-11-0${r}T10:00:00.000Z`,
          })
        );
      }

      // First payout request
      const req1 = await postPayout(patientCookie("P-SIM-001"), { requestId: "idemp-payout-1" });
      const { POST } = await import("../payout/route");
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);
      const json1 = await res1.json();
      expect(json1.enabled).toBe(true);
      expect(json1.payoutCents).toBe(1000);
      expect(json1.newBalanceCents).toBe(0);
      expect(json1.isDuplicate).toBe(false);
      expect(json1.isSimulated).toBe(true);
      expect(json1.entry.isSimulated).toBe(true);
      expect(json1.entry.kind).toBe("payout");

      // Verify entry in ledger
      const entries = await fakeRewards.ledger.getEntries("P-SIM-001");
      const payouts = entries.filter((e) => e.kind === "payout");
      expect(payouts).toHaveLength(1);
      expect(payouts[0].isSimulated).toBe(true);
      expect(payouts[0].amountCents).toBe(-1000);

      // Pressing twice with same requestId: does NOT pay twice
      const req2 = await postPayout(patientCookie("P-SIM-001"), { requestId: "idemp-payout-1" });
      const res2 = await POST(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.isDuplicate).toBe(true);
      expect(json2.newBalanceCents).toBe(0);
      expect(json2.isSimulated).toBe(true);

      const entriesAfter = await fakeRewards.ledger.getEntries("P-SIM-001");
      const payoutsAfter = entriesAfter.filter((e) => e.kind === "payout");
      expect(payoutsAfter).toHaveLength(1);
    });
  });
});
