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
    // Documented local password
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus",
      })
    ).toThrowError(/DATABASE_URL/);

    // Fallback/legacy local password
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/cepheus",
      })
    ).toThrowError(/DATABASE_URL/);

    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://postgres:postgres@db.production:5432/cepheus",
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

    const prodLocalPassword = "cepheus-local-only";
    try {
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: `postgresql://user:${prodLocalPassword}@db.internal:5432/db`,
      });
      expect.fail("Expected parseEnv to throw an error");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain("DATABASE_URL");
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

    const parsed2 = parseEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgres://user:pass@localhost:5433/cepheus",
    });
    expect(parsed2.DATABASE_URL).toBe(
      "postgres://user:pass@localhost:5433/cepheus"
    );
  });

  it("accepts valid PostgreSQL URLs with non-local password in production", () => {
    const parsed = parseEnv({
      NODE_ENV: "production",
      DATABASE_URL:
        "postgresql://cloud_user:strong_prod_pass_999@helsinki.db:5432/cepheus_prod",
    });
    expect(parsed.DATABASE_URL).toBe(
      "postgresql://cloud_user:strong_prod_pass_999@helsinki.db:5432/cepheus_prod"
    );
  });

  it("does not throw on import with no DATABASE_URL set, and getEnv() then throws naming the variable and never contains a value", () => {
    const savedUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    _resetEnv();
    try {
      expect(() => getEnv()).toThrowError(/DATABASE_URL/);

      try {
        getEnv();
        expect.fail("Expected getEnv() to throw");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        expect(message).toContain("DATABASE_URL");
        expect(message).toContain("Missing required environment variable");
        expect(message).not.toContain("localhost");
        expect(message).not.toContain("postgres");
      }
    } finally {
      if (savedUrl !== undefined) {
        process.env.DATABASE_URL = savedUrl;
      }
      _resetEnv();
    }
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
      const parsed2 = getEnv();
      expect(parsed2).toBe(parsed1);
      expect(env.DATABASE_URL).toBe(testUrl);
    } finally {
      if (savedUrl !== undefined) {
        process.env.DATABASE_URL = savedUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
      _resetEnv();
    }
  });

  it("validates optional Fitbit, session secret, and Arduino ingest token rules in production without leaking secrets", () => {
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

    try {
      parseEnv({
        ...baseProd,
        FITBIT_CLIENT_ID: "fitbit-id-123",
        FITBIT_CLIENT_SECRET: "super-secret-fitbit-val",
        APP_SESSION_SECRET: "too-short-secret",
      });
      expect.fail("Expected short APP_SESSION_SECRET to throw");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toContain("APP_SESSION_SECRET");
      expect(msg).not.toContain("too-short-secret");
      expect(msg).not.toContain("super-secret-fitbit-val");
    }

    expect(() =>
      parseEnv({
        ...baseProd,
        ARDUINO_INGEST_TOKEN: "short-token",
      })
    ).toThrowError(/ARDUINO_INGEST_TOKEN/);

    expect(() =>
      parseEnv({
        ...baseProd,
        FITBIT_REDIRECT_URI: "ftp://invalid.example.com/cb",
      })
    ).toThrowError(/FITBIT_REDIRECT_URI/);

    const ok = parseEnv({
      ...baseProd,
      FITBIT_CLIENT_ID: "fitbit-id-123",
      FITBIT_CLIENT_SECRET: "fitbit-secret-456",
      FITBIT_REDIRECT_URI: "https://cepheus.example.fi/api/fitbit/callback",
      APP_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
      ARDUINO_INGEST_TOKEN: "unoq-prod-token-123456",
    });
    expect(ok.FITBIT_CLIENT_ID).toBe("fitbit-id-123");
    expect(ok.ARDUINO_INGEST_TOKEN).toBe("unoq-prod-token-123456");
  });
});
