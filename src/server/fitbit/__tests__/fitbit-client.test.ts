import { describe, expect, it } from "vitest";
import { _resetEnv } from "@/server/env";
import { isFitbitConfigured, resolveFitbitRedirectUri } from "../client";

describe("Fitbit OAuth Redirect Configuration (src/server/fitbit/client.ts)", () => {
  it("refuses to start Fitbit OAuth when FITBIT_REDIRECT_URI is empty", () => {
    const savedDb = process.env.DATABASE_URL;
    const savedId = process.env.FITBIT_CLIENT_ID;
    const savedSecret = process.env.FITBIT_CLIENT_SECRET;
    const savedUri = process.env.FITBIT_REDIRECT_URI;

    process.env.DATABASE_URL =
      "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
    process.env.FITBIT_CLIENT_ID = "fitbit-id";
    process.env.FITBIT_CLIENT_SECRET = "fitbit-secret";
    delete process.env.FITBIT_REDIRECT_URI;
    _resetEnv();

    try {
      expect(isFitbitConfigured()).toBe(false);
      expect(() => resolveFitbitRedirectUri()).toThrowError(/FITBIT_REDIRECT_URI/);

      process.env.FITBIT_REDIRECT_URI = "http://localhost:3000/api/fitbit/callback";
      _resetEnv();
      expect(isFitbitConfigured()).toBe(true);
      expect(resolveFitbitRedirectUri()).toBe(
        "http://localhost:3000/api/fitbit/callback"
      );
    } finally {
      if (savedDb !== undefined) process.env.DATABASE_URL = savedDb;
      if (savedId !== undefined) process.env.FITBIT_CLIENT_ID = savedId;
      else delete process.env.FITBIT_CLIENT_ID;
      if (savedSecret !== undefined) process.env.FITBIT_CLIENT_SECRET = savedSecret;
      else delete process.env.FITBIT_CLIENT_SECRET;
      if (savedUri !== undefined) process.env.FITBIT_REDIRECT_URI = savedUri;
      else delete process.env.FITBIT_REDIRECT_URI;
      _resetEnv();
    }
  });
});
