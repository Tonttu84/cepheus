import { describe, expect, it } from "vitest";
import { parseEnv, getEnv, env, _resetEnv } from "@/server/env";

describe("Environment Check (src/server/env.ts)", () => {
  it("fails when DATABASE_URL is missing and names the variable without printing values", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "development",
      })
    ).toThrowError(/DATABASE_URL/);
  });

  it("fails when DATABASE_URL is empty", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "development",
        DATABASE_URL: "",
      })
    ).toThrowError(/DATABASE_URL/);
  });

  it("fails when DATABASE_URL has a non-PostgreSQL protocol", () => {
    const invalidProtocols = [
      "file:./dev.db",
      "sqlite:./dev.db",
      "mysql://user:pass@localhost:3306/db",
      "mongodb://localhost:27017/db",
      "http://localhost:5432/db",
    ];

    for (const url of invalidProtocols) {
      expect(
        () =>
          parseEnv({
            NODE_ENV: "development",
            DATABASE_URL: url,
          }),
        `Expected failure for ${url}`
      ).toThrowError(/DATABASE_URL/);
    }
  });

  it("refuses the documented local-only password when NODE_ENV is production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus",
      })
    ).toThrowError(/DATABASE_URL/);

    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/cepheus",
      })
    ).toThrowError(/DATABASE_URL/);
  });

  it("ensures error text never leaks the DATABASE_URL value or secret credentials", () => {
    const secretPassword = "ultra-secret-plain-text-password-12345";
    const sensitiveUrl = `mysql://user:${secretPassword}@db.internal:3306/db`;

    try {
      parseEnv({
        NODE_ENV: "development",
        DATABASE_URL: sensitiveUrl,
      });
      expect.fail("Expected parseEnv to throw an error");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain("DATABASE_URL");
      expect(message).not.toContain(secretPassword);
      expect(message).not.toContain("db.internal");
    }
  });

  it("accepts valid postgresql:// and postgres:// URLs in development", () => {
    const parsed1 = parseEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus",
    });
    expect(parsed1.DATABASE_URL).toBe(
      "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus"
    );
    expect(parsed1.VERDA_AI_ENABLED).toBe(false);
  });

  it("validates optional Fitbit, session secret, Arduino, Health Connect, and Verda rules in production", () => {
    const baseProd = {
      NODE_ENV: "production",
      DATABASE_URL:
        "postgresql://cloud_user:strong_prod_pass_999@helsinki.db:5432/cepheus_prod",
    };

    expect(() =>
      parseEnv({
        ...baseProd,
        FITBIT_CLIENT_ID: "fitbit-id-123",
        FITBIT_CLIENT_SECRET: "",
        APP_SESSION_SECRET: "short",
      })
    ).toThrowError(/FITBIT_CLIENT_SECRET/);

    expect(() =>
      parseEnv({
        ...baseProd,
        ARDUINO_INGEST_TOKEN: "short-token",
      })
    ).toThrowError(/ARDUINO_INGEST_TOKEN/);

    expect(() =>
      parseEnv({
        ...baseProd,
        HEALTH_CONNECT_WEBHOOK_SECRET: "short-hc-secret",
      })
    ).toThrowError(/HEALTH_CONNECT_WEBHOOK_SECRET/);

    expect(() =>
      parseEnv({
        ...baseProd,
        VERDA_INFERENCE_URL: "ftp://invalid.verda.example",
      })
    ).toThrowError(/VERDA_INFERENCE_URL/);

    expect(() =>
      parseEnv({
        ...baseProd,
        VERDA_AI_ENABLED: "true",
        VERDA_INFERENCE_URL: "",
        VERDA_API_KEY: "verda-key",
      })
    ).toThrowError(/VERDA_INFERENCE_URL/);

    expect(() =>
      parseEnv({
        ...baseProd,
        VERDA_AI_ENABLED: "true",
        VERDA_INFERENCE_URL: "https://inference.verda.example/v1/chat/completions",
        VERDA_API_KEY: "",
      })
    ).toThrowError(/VERDA_API_KEY/);

    const ok = parseEnv({
      ...baseProd,
      FITBIT_CLIENT_ID: "fitbit-id-123",
      FITBIT_CLIENT_SECRET: "fitbit-secret-456",
      FITBIT_REDIRECT_URI: "https://cepheus.example.fi/api/fitbit/callback",
      APP_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
      ARDUINO_INGEST_TOKEN: "unoq-prod-token-123456",
      HEALTH_CONNECT_WEBHOOK_SECRET: "hc-webhook-prod-secret-999",
      VERDA_AI_ENABLED: "true",
      VERDA_INFERENCE_URL: "https://inference.verda.example/v1/chat/completions",
      VERDA_API_KEY: "verda-prod-secret",
    });
    expect(ok.FITBIT_CLIENT_ID).toBe("fitbit-id-123");
    expect(ok.VERDA_AI_ENABLED).toBe(true);
    expect(ok.VERDA_GEMMA_MODEL).toBe("google/gemma-3-27b-it");
  });

  it("evaluates process.env on first call and remembers the result across getEnv() calls", () => {
    const savedUrl = process.env.DATABASE_URL;
    const testUrl =
      "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
    process.env.DATABASE_URL = testUrl;
    _resetEnv();
    try {
      const parsed1 = getEnv();
      expect(parsed1.DATABASE_URL).toBe(testUrl);
      expect(env.DATABASE_URL).toBe(testUrl);
    } finally {
      if (savedUrl !== undefined) process.env.DATABASE_URL = savedUrl;
      else delete process.env.DATABASE_URL;
      _resetEnv();
    }
  });
});
