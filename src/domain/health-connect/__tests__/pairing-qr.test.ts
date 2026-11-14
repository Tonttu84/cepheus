import { describe, expect, it } from "vitest";
import {
  buildHcWebhookAuthHeaders,
  buildLifeDashboardPairingUri,
  encodeQrMatrix,
} from "../index";

describe("Life Dashboard Pairing & HC Webhook Headers", () => {
  it("encodes pairing URI with encodeURIComponent (%20, %2C) and never uses github.io", () => {
    const uri = buildLifeDashboardPairingUri({
      webhookUrl: "https://cepheus.example.com/api/health-connect/webhook?token=abc+123",
      secret: "sec-42",
      name: "Cepheus Home",
      sources: ["health_connect", "screen_time"],
    });

    expect(uri.startsWith("lifedashboard://pair#")).toBe(true);
    expect(uri).not.toContain("github.io");
    expect(uri).toContain("v=1");
    expect(uri).toContain("name=Cepheus%20Home");
    expect(uri).toContain("sources=health_connect%2Cscreen_time");
    expect(uri).toContain(
      "url=https%3A%2F%2Fcepheus.example.com%2Fapi%2Fhealth-connect%2Fwebhook%3Ftoken%3Dabc%2B123"
    );
    expect(uri).toContain("secret=sec-42");
  });

  it("builds HC Webhook auth headers", () => {
    const headers = buildHcWebhookAuthHeaders("my-secret");
    expect(headers.bearerHeader).toBe("Authorization: Bearer my-secret");
    expect(headers.apiKeyHeader).toBe("X-API-Key: my-secret");
  });
});

describe("Pure-TS QR Matrix Encoder", () => {
  it("encodes a realistic ~170-char lifedashboard://pair# URI into a valid square matrix", () => {
    const uri = buildLifeDashboardPairingUri({
      webhookUrl: "https://cepheus.example.com/api/health-connect/webhook?token=demo-token-12345",
      secret: "whsec_0123456789abcdef0123456789abcdef",
      name: "Cepheus",
      sources: ["health_connect"],
    });
    expect(uri.length).toBeGreaterThan(150);

    const matrix = encodeQrMatrix(uri);
    const size = matrix.length;
    expect(size).toBeGreaterThanOrEqual(21);
    expect((size - 17) % 4).toBe(0);
    for (const row of matrix) {
      expect(row).toHaveLength(size);
    }

    // Top-left 7x7 finder pattern outer border & 3x3 center
    expect(matrix[0][0]).toBe(true);
    expect(matrix[0][6]).toBe(true);
    expect(matrix[6][0]).toBe(true);
    expect(matrix[1][1]).toBe(false);
    expect(matrix[3][3]).toBe(true);

    // Top-right & bottom-left finder corners
    expect(matrix[0][size - 1]).toBe(true);
    expect(matrix[size - 1][0]).toBe(true);

    // Timing pattern alternation on row 6 (cols 8..size-9)
    for (let c = 8; c < size - 8; c++) {
      expect(matrix[6][c]).toBe(c % 2 === 0);
    }

    // Deterministic output
    expect(encodeQrMatrix(uri)).toEqual(matrix);
  });

  it("throws RangeError on empty or oversized input", () => {
    expect(() => encodeQrMatrix("")).toThrow(RangeError);
    expect(() => encodeQrMatrix("a".repeat(400))).toThrow(RangeError);
  });
});
