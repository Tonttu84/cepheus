import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage from "@/app/privacy/page";
import { PrivacyContent } from "@/components/privacy/privacy-content";
import { PRIVACY_PAGE_DATA } from "@/components/privacy/privacy-page-data";

describe("Privacy Page Content & Demonstrator Governance", () => {
  it("carries the exact required demonstration notice", () => {
    expect(PRIVACY_PAGE_DATA.demonstrationNotice).toBe(
      "Mock policies for a demonstration. Written by an AI agent, not reviewed by a lawyer, not legal advice."
    );
  });

  it("makes no claim of demonstration compliance or certification guarantees", () => {
    const rawDataJson = JSON.stringify(PRIVACY_PAGE_DATA).toLowerCase();

    // Does not claim that the demonstration itself is certified or compliant
    expect(rawDataJson).not.toContain("certified service");
    expect(rawDataJson).not.toContain("is compliant");
    expect(rawDataJson).not.toContain("guarantee");

    // Distinguishes demonstration status honestly
    expect(rawDataJson).toContain(
      "demonstration runs on a laptop with simulated patients only"
    );
  });

  it("defines the five required privacy sections with clear facts", () => {
    expect(PRIVACY_PAGE_DATA.sections).toHaveLength(5);

    const [section1, section2, section3, section4, section5] =
      PRIVACY_PAGE_DATA.sections;

    // 1. What we collect and what we never store
    expect(section1.id).toBe("collection-and-storage");
    expect(section1.title.toLowerCase()).toContain("collect");
    expect(section1.title.toLowerCase()).toContain("never store");
    expect(section1.facts.length).toBeGreaterThanOrEqual(4);

    // 2. Who sees what
    expect(section2.id).toBe("who-sees-what");
    expect(section2.title.toLowerCase()).toContain("who sees what");
    expect(section2.facts.length).toBeGreaterThanOrEqual(3);

    // 3. Your rights and how to stop
    expect(section3.id).toBe("rights-and-stopping");
    expect(section3.title.toLowerCase()).toContain("rights");
    expect(section3.title.toLowerCase()).toContain("stop");
    expect(section3.facts.length).toBeGreaterThanOrEqual(3);

    // 4. Rewards are simulated and why
    expect(section4.id).toBe("simulated-rewards");
    expect(section4.title.toLowerCase()).toContain("rewards are simulated");
    expect(section4.facts.length).toBeGreaterThanOrEqual(3);

    // 5. What a real deployment requires
    expect(section5.id).toBe("production-requirements");
    expect(section5.title.toLowerCase()).toContain(
      "what a real deployment requires"
    );
    expect(section5.summary).toContain(
      "demonstration runs on a laptop with simulated patients only"
    );
    expect(section5.facts.length).toBeGreaterThanOrEqual(4);

    const labels = section5.facts.map((f) => f.label.toLowerCase());
    expect(labels.some((l) => l.includes("certified provider"))).toBe(true);
    expect(labels.some((l) => l.includes("outside the eu"))).toBe(true);
    expect(labels.some((l) => l.includes("strong identification"))).toBe(true);
    expect(labels.some((l) => l.includes("impact assessment"))).toBe(true);
  });

  it("renders the privacy page without throwing or requiring a session", () => {
    // The PrivacyPage component is a public page and does not call requirePatientPageSession
    const html = renderToString(React.createElement(PrivacyPage));
    expect(html).toContain("Mock policies for a demonstration");
    expect(html).toContain("What we collect and what we never store");
    expect(html).toContain("Who sees what");
    expect(html).toContain("Your rights and how to stop");
    expect(html).toContain("Rewards are simulated and why");
    expect(html).toContain("What a real deployment requires");
    expect(html).toContain(
      "demonstration runs on a laptop with simulated patients only"
    );
    expect(html).toContain("Return to Overview");
  });

  it("ensures interactive touch targets enforce at least 44px height", () => {
    const html = renderToString(React.createElement(PrivacyContent));
    // Check that navigation links carry min-h-[44px]
    expect(html).toContain("min-h-[44px]");
  });
});
