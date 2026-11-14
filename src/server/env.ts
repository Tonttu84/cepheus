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
}

/**
 * Parses and validates environment variables with Zod.
 * Enforces postgresql:// or postgres:// protocol and rejects the documented
 * local development password when running in production.
 * Never prints variable values in error messages.
 */
export function parseEnv(rawEnv: Record<string, string | undefined>): AppEnv {
  const isBuildPhase = rawEnv.NEXT_PHASE === "phase-production-build";

  const schema = z
    .object({
      NODE_ENV: z.string().default("development"),
      DATABASE_URL: z
        .string({ error: "Missing required environment variable: DATABASE_URL" })
        .min(1, "Environment variable DATABASE_URL cannot be empty"),
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
