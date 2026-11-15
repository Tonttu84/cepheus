import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as postNurseBrief } from "@/app/api/ai/nurse-brief/route";
import { STORED_WARNING_KINDS } from "@/domain/ai-support";
import {
  apiRequest,
  patientCookie,
  setUpRoutes,
  staffCookie,
  tearDownRoutes,
} from "@/app/api/__tests__/route-test-kit";

function briefRequest(cookie: string | null, body: unknown, origin = "http://localhost:3000"): Request {
  const req = apiRequest("/api/ai/nurse-brief", { method: "POST", cookie, body });
  const headers = new Headers(req.headers);
  headers.set("origin", origin);
  return new Request(req.url, {
    method: req.method,
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/nurse-brief", () => {
  beforeEach(() => {
    setUpRoutes();
  });

  afterEach(() => {
    tearDownRoutes();
  });

  it("accepts every warning kind defined by the domain", async () => {
    expect(STORED_WARNING_KINDS).toEqual([
      "low_answers",
      "silence",
      "mixed",
      "phq9",
      "gad7",
      "sustained_dip",
    ]);

    for (const kind of STORED_WARNING_KINDS) {
      const res = await postNurseBrief(
        briefRequest(staffCookie(), {
          participantCode: "P-SIM-001",
          sinceDate: "2026-11-16",
          triggerKind: kind,
          broadAreas: ["check_in"],
          ringActiveDuringSilence: false,
          metrics: [
            { label: "Unanswered rounds", valueText: "2" },
            { label: "Sleep regularity shift", valueText: "-18%" },
          ],
          isSimulated: true,
        })
      );

      expect(res.status, `Trigger kind '${kind}' should be accepted`).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.result).toBeDefined();
      expect(data.result.summary).toBeDefined();
    }
  });

  it("rejects unknown trigger kinds with 400", async () => {
    const res = await postNurseBrief(
      briefRequest(staffCookie(), {
        participantCode: "P-SIM-001",
        sinceDate: "2026-11-16",
        triggerKind: "invalid_trigger_kind",
        broadAreas: ["check_in"],
        ringActiveDuringSilence: false,
        metrics: [],
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it("enforces staff authentication and same-origin check", async () => {
    const unsignedRes = await postNurseBrief(
      briefRequest(null, {
        participantCode: "P-SIM-001",
        sinceDate: "2026-11-16",
        triggerKind: "silence",
        broadAreas: ["check_in"],
        ringActiveDuringSilence: false,
        metrics: [],
      })
    );
    expect(unsignedRes.status).toBe(401);

    const patientRes = await postNurseBrief(
      briefRequest(patientCookie(), {
        participantCode: "P-SIM-001",
        sinceDate: "2026-11-16",
        triggerKind: "silence",
        broadAreas: ["check_in"],
        ringActiveDuringSilence: false,
        metrics: [],
      })
    );
    expect(patientRes.status).toBe(403);

    const crossOriginRes = await postNurseBrief(
      briefRequest(
        staffCookie(),
        {
          participantCode: "P-SIM-001",
          sinceDate: "2026-11-16",
          triggerKind: "silence",
          broadAreas: ["check_in"],
          ringActiveDuringSilence: false,
          metrics: [],
        },
        "https://evil.attacker.example.com"
      )
    );
    expect(crossOriginRes.status).toBe(403);
  });
});
