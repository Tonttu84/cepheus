import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SwitchesSection } from "../demo-controls";

const COST_SENTENCE =
  "Whether this is worth it is doubtful: it needs a camera in the home, and it adds privacy and data-security cost for an uncertain benefit. It is off by default.";

describe("DemoControls - Expressivity showcase switch", () => {
  it("renders expressivity showcase switch with exact cost sentence", () => {
    const html = renderToString(
      React.createElement(SwitchesSection, {
        switches: {
          rewards: true,
          counters: false,
          extraQuestion: false,
          expressivityShowcase: false,
        },
        isPending: false,
        onToggle: () => {},
      })
    );

    expect(html).toContain("Expressivity showcase");
    expect(html).toContain(COST_SENTENCE);
    expect(html).toContain("switch-status-expressivity");
  });
});
