import { z } from "zod";

/**
 * Documented local-only passwords for embedded PostgreSQL development.
 * These are documented, local-only values for offline development, not secrets.
 */
export const LOCAL_DEV_PASSWORD = "cepheus-local-only";
export const LEGACY_LOCAL_DEV_PASSWORD = "postgres";

export interface AppEnv {
  NODE_ENV: string;
  DATABASE_URL: string;
  APP_SESSION_SECRET: string;
  FITBIT_CLIENT_ID: string;
  FITBIT_CLIENT_SECRET: string;
  FITBIT_REDIRECT_URI: string;
  ARDUINO_INGEST_TOKEN: string;
}

const optionalTrimmedString = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim());

/**
 * Parses and validates environment variables with Zod.
 * Enforces postgresql:// or postgres:// protocol, rejects the documented
 * local development password in production, and checks Fitbit / Arduino /
 * session secret invariants without ever leaking values in error messages.
 */
export function parseEnv(rawEnv: Record<string, string | undefined>): AppEnv {
  const isBuildPhase = rawEnv.NEXT_PHASE === "phase-production-build";

  const schema = z
    .object({
      NODE_ENV: z.string().default("development"),
      DATABASE_URL: z
        .string({ error: "Missing required environment variable: DATABASE_URL" })
        .min(1, "Environment variable DATABASE_URL cannot be empty"),
      APP_SESSION_SECRET: optionalTrimmedString,
      FITBIT_CLIENT_ID: optionalTrimmedString,
      FITBIT_CLIENT_SECRET: optionalTrimmedString,
      FITBIT_REDIRECT_URI: optionalTrimmedString,
      ARDUINO_INGEST_TOKEN: optionalTrimmedString,
    })
    .superRefine((val, ctx) => {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(val.DATABASE_URL);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message:
            "Invalid environment variable: DATABASE_URL (must be a valid postgresql:// or postgres:// address)",
        });
        return;
      }

      if (
        parsedUrl.protocol !== "postgresql:" &&
        parsedUrl.protocol !== "postgres:"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message:
            "Invalid environment variable: DATABASE_URL (must be a postgresql:// or postgres:// address)",
        });
        return;
      }

      const isProduction = val.NODE_ENV === "production";
      const hasLocalPassword =
        parsedUrl.password === LOCAL_DEV_PASSWORD ||
        parsedUrl.password === LEGACY_LOCAL_DEV_PASSWORD;

      if (isProduction && hasLocalPassword && !isBuildPhase) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message:
            "Invalid environment variable: DATABASE_URL (local development password is not allowed in production)",
        });
      }

      if (val.FITBIT_REDIRECT_URI.length > 0) {
        try {
          const redirectUrl = new URL(val.FITBIT_REDIRECT_URI);
          if (
            redirectUrl.protocol !== "https:" &&
            redirectUrl.protocol !== "http:"
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["FITBIT_REDIRECT_URI"],
              message:
                "Invalid environment variable: FITBIT_REDIRECT_URI (must be http:// or https://)",
            });
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["FITBIT_REDIRECT_URI"],
            message:
              "Invalid environment variable: FITBIT_REDIRECT_URI (must be a valid URL)",
          });
        }
      }

      if (isProduction && !isBuildPhase) {
        if (val.FITBIT_CLIENT_ID.length > 0 && val.FITBIT_CLIENT_SECRET.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["FITBIT_CLIENT_SECRET"],
            message:
              "Missing required environment variable: FITBIT_CLIENT_SECRET (required when FITBIT_CLIENT_ID is set in production)",
          });
        }

        if (
          (val.FITBIT_CLIENT_ID.length > 0 || val.APP_SESSION_SECRET.length > 0) &&
          val.APP_SESSION_SECRET.length < 32
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["APP_SESSION_SECRET"],
            message:
              "Invalid environment variable: APP_SESSION_SECRET (must be at least 32 characters in production)",
          });
        }

        if (
          val.ARDUINO_INGEST_TOKEN.length > 0 &&
          val.ARDUINO_INGEST_TOKEN.length < 16
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ARDUINO_INGEST_TOKEN"],
            message:
              "Invalid environment variable: ARDUINO_INGEST_TOKEN (must be at least 16 characters in production)",
          });
        }
      }
    });

  const result = schema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => {
        const varName = issue.path[0] ? String(issue.path[0]) : "DATABASE_URL";
        return `${varName}: ${issue.message}`;
      })
      .join("; ");

    // Never print raw variable values in the exception
    throw new Error(`[env] Environment check failed: ${errorDetails}`);
  }

  return {
    NODE_ENV: result.data.NODE_ENV,
    DATABASE_URL: result.data.DATABASE_URL,
    APP_SESSION_SECRET: result.data.APP_SESSION_SECRET,
    FITBIT_CLIENT_ID: result.data.FITBIT_CLIENT_ID,
    FITBIT_CLIENT_SECRET: result.data.FITBIT_CLIENT_SECRET,
    FITBIT_REDIRECT_URI: result.data.FITBIT_REDIRECT_URI,
    ARDUINO_INGEST_TOKEN: result.data.ARDUINO_INGEST_TOKEN,
  };
}

let cachedEnv: AppEnv | undefined;

/**
 * Returns parsed environment values for the application.
 * Evaluates process.env with Zod on first call and remembers the result.
 * Never prints variable values in error messages.
 */
export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}

/**
 * For testing purposes: resets the cached environment so subsequent
 * calls re-evaluate process.env.
 */
export function _resetEnv(): void {
  cachedEnv = undefined;
}

/**
 * Proxy for backward-compatibility that evaluates lazily on property access.
 */
export const env: AppEnv = new Proxy({} as AppEnv, {
  get(_target, prop) {
    return getEnv()[prop as keyof AppEnv];
  },
});
