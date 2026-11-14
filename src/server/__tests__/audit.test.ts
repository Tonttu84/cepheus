import { describe, expect, it } from "vitest";
import { findUnexpectedAuditFindings } from "../../../scripts/audit.mjs";

describe("audit matching logic (findUnexpectedAuditFindings)", () => {
  const sampleExceptions = [
    {
      id: "GHSA-6g55-p6wh-862q",
      package: "postcss",
      reason: "inside Next.js 15 build tooling",
    },
  ];

  it("fixture 1: accepts a known accepted advisory", () => {
    const report = {
      auditReportVersion: 2,
      vulnerabilities: {
        postcss: {
          name: "postcss",
          severity: "high",
          via: [
            {
              source: 1124252,
              name: "postcss",
              dependency: "postcss",
              title: "PostCSS arbitrary file read",
              url: "https://github.com/advisories/GHSA-6g55-p6wh-862q",
              severity: "high",
            },
          ],
        },
      },
    };

    const unexpected = findUnexpectedAuditFindings(report, sampleExceptions);
    expect(unexpected).toHaveLength(0);
  });

  it("fixture 2: fails on a new advisory in the same package", () => {
    const report = {
      auditReportVersion: 2,
      vulnerabilities: {
        postcss: {
          name: "postcss",
          severity: "high",
          via: [
            {
              source: 9999999,
              name: "postcss",
              dependency: "postcss",
              title: "New unaccepted vulnerability in postcss",
              url: "https://github.com/advisories/GHSA-9999-9999-9999",
              severity: "high",
            },
          ],
        },
      },
    };

    const unexpected = findUnexpectedAuditFindings(report, sampleExceptions);
    expect(unexpected.length).toBeGreaterThan(0);
    expect(unexpected[0].package).toBe("postcss");
    expect(unexpected[0].id).toBe("GHSA-9999-9999-9999");
  });

  it("fixture 3: fails on a finding with no readable advisory id", () => {
    const report = {
      auditReportVersion: 2,
      vulnerabilities: {
        "mystery-pkg": {
          name: "mystery-pkg",
          severity: "high",
          via: [
            {
              name: "mystery-pkg",
              severity: "high",
              // No id, source, or url
            },
          ],
        },
      },
    };

    const unexpected = findUnexpectedAuditFindings(report, sampleExceptions);
    expect(unexpected.length).toBeGreaterThan(0);
    expect(unexpected[0].package).toBe("mystery-pkg");
  });

  it("fixture 3b: fails on a transitive high finding with no advisory objects in chain", () => {
    const report = {
      auditReportVersion: 2,
      vulnerabilities: {
        "parent-pkg": {
          name: "parent-pkg",
          severity: "high",
          via: ["nonexistent-child"],
        },
      },
    };

    const unexpected = findUnexpectedAuditFindings(report, sampleExceptions);
    expect(unexpected.length).toBeGreaterThan(0);
  });

  it("fixture 4: ignores moderate findings", () => {
    const report = {
      auditReportVersion: 2,
      vulnerabilities: {
        next: {
          name: "next",
          severity: "moderate",
          via: ["postcss"],
        },
        postcss: {
          name: "postcss",
          severity: "moderate",
          via: [
            {
              source: 1117015,
              name: "postcss",
              dependency: "postcss",
              title: "Moderate XSS",
              url: "https://github.com/advisories/GHSA-qx2v-qp2m-jg93",
              severity: "moderate",
            },
          ],
        },
      },
    };

    const unexpected = findUnexpectedAuditFindings(report, sampleExceptions);
    expect(unexpected).toHaveLength(0);
  });

  it("fixture 5: fails on unreadable JSON", () => {
    const invalidJsonString = "{ not valid json: ";
    const unexpectedFromString = findUnexpectedAuditFindings(invalidJsonString, sampleExceptions);
    expect(unexpectedFromString.length).toBeGreaterThan(0);

    const unexpectedFromNull = findUnexpectedAuditFindings(null, sampleExceptions);
    expect(unexpectedFromNull.length).toBeGreaterThan(0);
  });

  it("follows the via chain to advisory objects in transitive dependencies", () => {
    const report = {
      auditReportVersion: 2,
      vulnerabilities: {
        next: {
          name: "next",
          severity: "high",
          via: ["postcss"],
        },
        postcss: {
          name: "postcss",
          severity: "high",
          via: [
            {
              source: 1124252,
              name: "postcss",
              dependency: "postcss",
              title: "PostCSS arbitrary file read",
              url: "https://github.com/advisories/GHSA-6g55-p6wh-862q",
              severity: "high",
            },
          ],
        },
      },
    };

    const unexpected = findUnexpectedAuditFindings(report, sampleExceptions);
    expect(unexpected).toHaveLength(0);
  });
});
