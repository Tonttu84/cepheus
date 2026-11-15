import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setUpRoutes, tearDownRoutes, patientCookie, staffCookie } from "../../__tests__/route-test-kit";
import { getRouteDeps, setRouteDepsForTests } from "@/server/api";
import { createFakeRewardsPorts } from "@/usecases/rewards/testing/fake-ports";

describe("Rewards routes", () => {
  beforeAll(() => {
    setUpRoutes();
    const fakeRewards = createFakeRewardsPorts();
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
});
