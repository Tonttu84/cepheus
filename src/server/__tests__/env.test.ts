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
});
