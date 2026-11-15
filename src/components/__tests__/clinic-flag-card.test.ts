import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClinicFlagCard } from "../clinic-flag-card";
import type { ExpressivityRangeResult } from "@/domain/camera";

const BASE_PROPS = {
  participantLabel: "Sample Patient 1",
  participantExternalId: "P-SIM-001",
  tmsCompletedDate: "2026-09-15",
  sinceDate: "2026-11-10",
  broadAreas: ["check_in" as const],
};

const RESEARCH_LINE =
  "Review of 12 studies (389 people) found response goes with more expressivity (source: Facial expression and treatment response, systematic review (Karger supplementary record)).";
const LIMITS_LINE =
  "This is not a reading of mood and not a judgement. No study shows that it warns of relapse. The clinician decides.";
const COST_LINE =
  "Whether this is worth it is doubtful: it needs a camera in the home, and it adds privacy and data-security cost for an uncertain benefit. It is off by default.";

describe("ClinicFlagCard - Expressivity Showcase Panel", () => {
  it("does not render expressivity showcase panel when showcase data is absent", () => {
    const html = renderToString(
      React.createElement(ClinicFlagCard, {
        ...BASE_PROPS,
        expressivityShowcase: null,
      })
    );

    expect(html).not.toContain("Facial movement, against this person&#x27;s own usual range");
    expect(html).not.toContain("Facial movement, against this person's own usual range");
    expect(html).not.toContain(RESEARCH_LINE);
  });

  it("renders panel with inside usual range fact and exact required content in order", () => {
    const showcase: ExpressivityRangeResult = {
      status: "within_usual_range",
      kind: "usual_range",
      position: "within_usual_range",
      mean: 0.35,
      lower: 0.25,
      upper: 0.45,
      sd: 0.05,
      sampleCount: 6,
    };

    const html = renderToString(
      React.createElement(ClinicFlagCard, {
        ...BASE_PROPS,
        expressivityShowcase: showcase,
      })
    );

    // 1. Heading
    expect(html).toContain("Facial movement, against this person&#x27;s own usual range (optional module, research potential)");
    // 2. Fact with reading count
    expect(html).toContain("Latest camera check: inside this person&#x27;s usual range (6 readings).");
    // 3. Simulated badge for sample patient
    expect(html).toContain("Simulated");
    // 4. Research line quoting 12 studies, 389 people
    expect(html).toContain(RESEARCH_LINE);
    // 5. Limits line
    expect(html).toContain(LIMITS_LINE);
    // 6. Cost line
    expect(html).toContain(COST_LINE);

    // Verify ordering in output HTML
    const headingIndex = html.indexOf("Facial movement, against this person&#x27;s own usual range");
    const factIndex = html.indexOf("inside this person&#x27;s usual range");
    const researchIndex = html.indexOf("Review of 12 studies (389 people)");
    const limitsIndex = html.indexOf("This is not a reading of mood");
    const costIndex = html.indexOf("Whether this is worth it is doubtful");

    expect(headingIndex).toBeLessThan(factIndex);
    expect(factIndex).toBeLessThan(researchIndex);
    expect(researchIndex).toBeLessThan(limitsIndex);
    expect(limitsIndex).toBeLessThan(costIndex);
  });

  it("renders insufficient history fact when fewer than 5 readings exist", () => {
    const showcase: ExpressivityRangeResult = {
      status: "insufficient_history",
      kind: "insufficient_history",
      count: 3,
      minimum: 5,
    };

    const html = renderToString(
      React.createElement(ClinicFlagCard, {
        ...BASE_PROPS,
        expressivityShowcase: showcase,
      })
    );

    expect(html).toContain("Not enough camera checks yet (3 of 5).");
    expect(html).toContain(RESEARCH_LINE);
    expect(html).toContain(LIMITS_LINE);
    expect(html).toContain(COST_LINE);
  });

  it("renders below and above usual range facts correctly", () => {
    const belowShowcase: ExpressivityRangeResult = {
      status: "below_usual_range",
      kind: "usual_range",
      position: "below_usual_range",
      mean: 0.4,
      lower: 0.3,
      upper: 0.5,
      sd: 0.05,
      sampleCount: 5,
    };

    const belowHtml = renderToString(
      React.createElement(ClinicFlagCard, {
        ...BASE_PROPS,
        expressivityShowcase: belowShowcase,
      })
    );
    expect(belowHtml).toContain("Latest camera check: below this person&#x27;s usual range (5 readings).");

    const aboveShowcase: ExpressivityRangeResult = {
      status: "above_usual_range",
      kind: "usual_range",
      position: "above_usual_range",
      mean: 0.4,
      lower: 0.3,
      upper: 0.5,
      sd: 0.05,
      sampleCount: 5,
    };

    const aboveHtml = renderToString(
      React.createElement(ClinicFlagCard, {
        ...BASE_PROPS,
        expressivityShowcase: aboveShowcase,
      })
    );
    expect(aboveHtml).toContain("Latest camera check: above this person&#x27;s usual range (5 readings).");
  });
});
