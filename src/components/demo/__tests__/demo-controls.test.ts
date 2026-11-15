import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DemoControls } from "../demo-controls";

const COST_SENTENCE =
  "Whether this is worth it is doubtful: it needs a camera in the home, and it adds privacy and data-security cost for an uncertain benefit. It is off by default.";

describe("DemoControls - Expressivity showcase switch", () => {
  it("renders expressivity showcase switch with exact cost sentence", () => {
    const html = renderToString(
      React.createElement(DemoControls, {
        initialState: {
          isSimulated: true,
          now: "2026-11-15T12:00:00Z",
          offsetDays: 0,
          offsetMs: 0,
          needsReset: false,
          switches: {
            rewards: true,
            counters: false,
            extraQuestion: false,
            expressivityShowcase: false,
          },
          patients: [],
        },
      })
    );

    expect(html).toContain("Expressivity showcase");
    expect(html).toContain(COST_SENTENCE);
    expect(html).toContain("switch-status-expressivity");
  });
});
