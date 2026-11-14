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
  VERDA_INFERENCE_URL: string;
  VERDA_API_KEY: string;
  VERDA_GEMMA_MODEL: string;
}

const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim());

function addIssue(ctx: z.RefinementCtx, path: string, message: string): void {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [path],
    message,
  });
}

function validateDatabaseUrl(
  databaseUrl: string,
  isProduction: boolean,
  isBuildPhase: boolean,
  ctx: z.RefinementCtx
): void {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    addIssue(
      ctx,
      "DATABASE_URL",
      "Invalid environment variable: DATABASE_URL (must be a valid postgresql:// or postgres:// address)"
    );
    return;
  }

  if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
    addIssue(
      ctx,
      "DATABASE_URL",
      "Invalid environment variable: DATABASE_URL (must be a postgresql:// or postgres:// address)"
    );
    return;
  }

  const hasLocalPassword =
    parsedUrl.password === LOCAL_DEV_PASSWORD ||
    parsedUrl.password === LEGACY_LOCAL_DEV_PASSWORD;

  if (isProduction && hasLocalPassword && !isBuildPhase) {
    addIssue(
      ctx,
      "DATABASE_URL",
      "Invalid environment variable: DATABASE_URL (local development password is not allowed in production)"
    );
  }
}

function validateVerdaConfig(
  verdaUrl: string,
  verdaKey: string,
  isProduction: boolean,
  isBuildPhase: boolean,
  ctx: z.RefinementCtx
): void {
  if (verdaUrl.length > 0) {
    try {
      const parsed = new URL(verdaUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        addIssue(
          ctx,
          "VERDA_INFERENCE_URL",
          "Invalid environment variable: VERDA_INFERENCE_URL (must be http:// or https://)"
        );
      }
    } catch {
      addIssue(
        ctx,
        "VERDA_INFERENCE_URL",
        "Invalid environment variable: VERDA_INFERENCE_URL (must be a valid URL)"
      );
    }
  }

  if (isProduction && !isBuildPhase && verdaUrl.length > 0 && verdaKey.length === 0) {
    addIssue(
      ctx,
      "VERDA_API_KEY",
      "Missing required environment variable: VERDA_API_KEY (required when VERDA_INFERENCE_URL is set in production)"
    );
  }
}

const rawEnvSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    DATABASE_URL: z
      .string({ error: "Missing required environment variable: DATABASE_URL" })
      .min(1, "Environment variable DATABASE_URL cannot be empty"),
    VERDA_INFERENCE_URL: optionalTrimmed,
    VERDA_API_KEY: optionalTrimmed,
    VERDA_GEMMA_MODEL: optionalTrimmed,
  })
  .superRefine((val, ctx) => {
    const isProduction = val.NODE_ENV === "production";
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    validateDatabaseUrl(val.DATABASE_URL, isProduction, isBuildPhase, ctx);
    validateVerdaConfig(
      val.VERDA_INFERENCE_URL,
      val.VERDA_API_KEY,
      isProduction,
      isBuildPhase,
      ctx
    );
  });

/**
 * Parses and validates environment variables with Zod without ever leaking
 * secret values in exception messages.
 */
export function parseEnv(rawEnv: Record<string, string | undefined>): AppEnv {
  const savedPhase = process.env.NEXT_PHASE;
  if (rawEnv.NEXT_PHASE !== undefined) {
    process.env.NEXT_PHASE = rawEnv.NEXT_PHASE;
  }

  let result: ReturnType<typeof rawEnvSchema.safeParse>;
  try {
    result = rawEnvSchema.safeParse(rawEnv);
  } finally {
    if (savedPhase === undefined) {
      delete process.env.NEXT_PHASE;
    } else {
      process.env.NEXT_PHASE = savedPhase;
    }
  }

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => {
        const varName = issue.path[0] ? String(issue.path[0]) : "DATABASE_URL";
        return `${varName}: ${issue.message}`;
      })
      .join("; ");
    throw new Error(`[env] Environment check failed: ${errorDetails}`);
  }

  return {
    NODE_ENV: result.data.NODE_ENV,
    DATABASE_URL: result.data.DATABASE_URL,
    VERDA_INFERENCE_URL: result.data.VERDA_INFERENCE_URL,
    VERDA_API_KEY: result.data.VERDA_API_KEY,
    VERDA_GEMMA_MODEL: result.data.VERDA_GEMMA_MODEL || "google/gemma-3-27b-it",
  };
}

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}

export function _resetEnv(): void {
  cachedEnv = undefined;
}

export const env: AppEnv = new Proxy({} as AppEnv, {
  get(_target, prop) {
    return getEnv()[prop as keyof AppEnv];
  },
});
