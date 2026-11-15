import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postTaps } from "@/app/api/check-in/taps/route";
import {
  apiRequest,
  PATIENT_ID,
  patientCookie,
  patientRecord,
  setUpRoutes,
  tearDownRoutes,
} from "@/app/api/__tests__/route-test-kit";
import { runRuleIfNeeded } from "@/server/api";

// Enrolled Monday 16 Nov 2026 on Mondays and Thursdays at 18:00 in Helsinki:
// round 1 opens 16 Nov, round 2 opens Thursday 19 Nov at 16:00 UTC.
const ROUND_2_OPEN = "2026-11-19T16:05:00.000Z";

type Fake = ReturnType<typeof setUpRoutes>;

describe("the warning rule after an answer", () => {
  let fake: Fake;
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    fake = setUpRoutes(ROUND_2_OPEN);
    await fake.ports.patients.savePatient(patientRecord());
    errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    tearDownRoutes();
    vi.restoreAllMocks();
  });

  it("records an elapsed round without a row as missed before the rule runs", async () => {
    const response = await postTaps(
      apiRequest("/api/check-in/taps", { body: { mood: 0, interest: 0 }, cookie: patientCookie() })
    );
    expect(response.status).toBe(200);

    const rounds = await fake.ports.rounds.getRounds(PATIENT_ID);
    expect(rounds.map((r) => [r.roundNumber, r.status])).toEqual([
      [1, "missed"],
      [2, "answered"],
    ]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("raises the flag that a missed round and a low round make together", async () => {
    await postTaps(apiRequest("/api/check-in/taps", { body: { mood: 0, interest: 0 }, cookie: patientCookie() }));

    const warnings = await fake.ports.warnings.getWarnings(PATIENT_ID);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ kind: "mixed", since: "2026-11-16" });
  });

  it("does not close rounds when no rule run is needed", async () => {
    await runRuleIfNeeded(PATIENT_ID, false, fake.ports);
    expect(await fake.ports.rounds.getRounds(PATIENT_ID)).toEqual([]);
  });

  it("still runs the rule for a round 1 answer with nothing to close", async () => {
    fake.clock.setNow("2026-11-16T16:05:00.000Z");
    await postTaps(apiRequest("/api/check-in/taps", { body: { mood: 0, interest: 0 }, cookie: patientCookie() }));
    expect((await fake.ports.rounds.getRounds(PATIENT_ID)).map((r) => r.status)).toEqual(["answered"]);
    expect(await fake.ports.smallDips.getSmallDips(PATIENT_ID)).toHaveLength(1);
    expect(errors).not.toHaveBeenCalled();
  });
});
