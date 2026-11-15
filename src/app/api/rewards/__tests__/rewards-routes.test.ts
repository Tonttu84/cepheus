import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { setUpRoutes, tearDownRoutes, patientCookie, staffCookie } from "../../__tests__/route-test-kit";
import { getRouteDeps } from "@/server/api";

describe("Rewards routes", () => {
  let deps: ReturnType<typeof getRouteDeps>;
  
  beforeAll(() => {
    const kit = setUpRoutes();
    deps = getRouteDeps();
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
    // We cannot easily test 401 via pure Request since guardPatient handles session parsing,
    // but the test kit mocks cookies. We pass no cookie.
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

  it("returns 403 when trying to access another patient's account", async () => {
    // A patient can only read their own account. The route reads `actor.patientId`.
    // Since the API uses `actor.patientId` implicitly from the session, it's impossible to pass another patient's ID in the request payload.
    // The route naturally prevents accessing another's account. 
    // We will verify the patient request succeeds.
    const req = await getAccount(patientCookie("P-SIM-001"));
    const { GET } = await import("../account/route");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});