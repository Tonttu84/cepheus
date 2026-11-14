import { z } from "zod";
import { isValidBase32Secret } from "@/server/auth/totp";

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
  STAFF_TOTP_SECRET: string;
  FITBIT_CLIENT_ID: string;
  FITBIT_CLIENT_SECRET: string;
  FITBIT_REDIRECT_URI: string;
  ARDUINO_INGEST_TOKEN: string;
  ARDUINO_DEVICE_KEYS_JSON: string;
  HEALTH_CONNECT_WEBHOOK_SECRET: string;
  TRUST_PROXY_HEADERS: boolean;
  VERDA_AI_ENABLED: boolean;
  VERDA_PATIENT_STEP_ENABLED: boolean;
  VERDA_INFERENCE_URL: string;
  VERDA_API_KEY: string;
  VERDA_GEMMA_MODEL: string;
  STORE_ITEM_ANSWERS: boolean;
}

const optionalTrimmedString = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim());

function addCustomIssue(ctx: z.RefinementCtx, field: string, message: string): void {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [field],
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
    addCustomIssue(
      ctx,
      "DATABASE_URL",
      "Invalid environment variable: DATABASE_URL (must be a valid postgresql:// or postgres:// address)"
    );
    return;
  }

  if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
    addCustomIssue(
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
    addCustomIssue(
      ctx,
      "DATABASE_URL",
      "Invalid environment variable: DATABASE_URL (local development password is not allowed in production)"
    );
  }
}

function validateOptionalHttpUrl(
  urlVal: string,
  field: string,
  ctx: z.RefinementCtx
): void {
  if (urlVal.length === 0) return;
  try {
    const parsed = new URL(urlVal);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      addCustomIssue(
        ctx,
        field,
        `Invalid environment variable: ${field} (must be http:// or https://)`
      );
    }
  } catch {
    addCustomIssue(ctx, field, `Invalid environment variable: ${field} (must be a valid URL)`);
  }
}

function validateProductionSecrets(
  val: {
    APP_SESSION_SECRET: string;
    FITBIT_CLIENT_ID: string;
    FITBIT_CLIENT_SECRET: string;
    FITBIT_REDIRECT_URI: string;
    ARDUINO_INGEST_TOKEN: string;
    HEALTH_CONNECT_WEBHOOK_SECRET: string;
    VERDA_AI_ENABLED: string;
    VERDA_INFERENCE_URL: string;
    VERDA_API_KEY: string;
  },
  ctx: z.RefinementCtx
): void {
  if (val.FITBIT_CLIENT_ID.length > 0 && val.FITBIT_CLIENT_SECRET.length === 0) {
    addCustomIssue(
      ctx,
      "FITBIT_CLIENT_SECRET",
      "Missing required environment variable: FITBIT_CLIENT_SECRET (required when FITBIT_CLIENT_ID is set in production)"
    );
  }
  if (val.FITBIT_CLIENT_ID.length > 0 && val.FITBIT_REDIRECT_URI.length === 0) {
    addCustomIssue(
      ctx,
      "FITBIT_REDIRECT_URI",
      "Missing required environment variable: FITBIT_REDIRECT_URI (required when FITBIT_CLIENT_ID is set in production)"
    );
  }
  if (
    (val.FITBIT_CLIENT_ID.length > 0 || val.APP_SESSION_SECRET.length > 0) &&
    val.APP_SESSION_SECRET.length < 32
  ) {
    addCustomIssue(
      ctx,
      "APP_SESSION_SECRET",
      "Invalid environment variable: APP_SESSION_SECRET (must be at least 32 characters in production)"
    );
  }
  if (val.ARDUINO_INGEST_TOKEN.length > 0 && val.ARDUINO_INGEST_TOKEN.length < 16) {
    addCustomIssue(
      ctx,
      "ARDUINO_INGEST_TOKEN",
      "Invalid environment variable: ARDUINO_INGEST_TOKEN (must be at least 16 characters in production)"
    );
  }
  if (
    val.HEALTH_CONNECT_WEBHOOK_SECRET.length > 0 &&
    val.HEALTH_CONNECT_WEBHOOK_SECRET.length < 16
  ) {
    addCustomIssue(
      ctx,
      "HEALTH_CONNECT_WEBHOOK_SECRET",
      "Invalid environment variable: HEALTH_CONNECT_WEBHOOK_SECRET (must be at least 16 characters in production)"
    );
  }
  if (val.VERDA_AI_ENABLED.toLowerCase() === "true") {
    if (val.VERDA_INFERENCE_URL.length === 0) {
      addCustomIssue(
        ctx,
        "VERDA_INFERENCE_URL",
        "Missing required environment variable: VERDA_INFERENCE_URL (required when VERDA_AI_ENABLED=true in production)"
      );
    }
    if (val.VERDA_API_KEY.length === 0) {
      addCustomIssue(
        ctx,
        "VERDA_API_KEY",
        "Missing required environment variable: VERDA_API_KEY (required when VERDA_AI_ENABLED=true in production)"
      );
    }
  } else if (val.VERDA_INFERENCE_URL.length > 0 && val.VERDA_API_KEY.length === 0) {
    addCustomIssue(
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
    APP_SESSION_SECRET: optionalTrimmedString,
    STAFF_TOTP_SECRET: optionalTrimmedString,
    FITBIT_CLIENT_ID: optionalTrimmedString,
    FITBIT_CLIENT_SECRET: optionalTrimmedString,
    FITBIT_REDIRECT_URI: optionalTrimmedString,
    ARDUINO_INGEST_TOKEN: optionalTrimmedString,
    ARDUINO_DEVICE_KEYS_JSON: optionalTrimmedString,
    HEALTH_CONNECT_WEBHOOK_SECRET: optionalTrimmedString,
    TRUST_PROXY_HEADERS: optionalTrimmedString,
    VERDA_AI_ENABLED: optionalTrimmedString,
    VERDA_PATIENT_STEP_ENABLED: optionalTrimmedString,
    VERDA_INFERENCE_URL: optionalTrimmedString,
    VERDA_API_KEY: optionalTrimmedString,
    VERDA_GEMMA_MODEL: optionalTrimmedString,
    STORE_ITEM_ANSWERS: optionalTrimmedString,
  })
  .superRefine((val, ctx) => {
    const isProduction = val.NODE_ENV === "production";
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

    validateDatabaseUrl(val.DATABASE_URL, isProduction, isBuildPhase, ctx);
    validateOptionalHttpUrl(val.FITBIT_REDIRECT_URI, "FITBIT_REDIRECT_URI", ctx);
    validateOptionalHttpUrl(val.VERDA_INFERENCE_URL, "VERDA_INFERENCE_URL", ctx);
    if (
      val.STAFF_TOTP_SECRET.length > 0 &&
      !isValidBase32Secret(val.STAFF_TOTP_SECRET, 16)
    ) {
      addCustomIssue(
        ctx,
        "STAFF_TOTP_SECRET",
        "Invalid environment variable: STAFF_TOTP_SECRET (must be valid base32 decoding to at least 16 bytes)"
      );
    }
    if (isProduction && !isBuildPhase) {
      validateProductionSecrets(val, ctx);
    }
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
    APP_SESSION_SECRET: result.data.APP_SESSION_SECRET,
    STAFF_TOTP_SECRET: result.data.STAFF_TOTP_SECRET,
    FITBIT_CLIENT_ID: result.data.FITBIT_CLIENT_ID,
    FITBIT_CLIENT_SECRET: result.data.FITBIT_CLIENT_SECRET,
    FITBIT_REDIRECT_URI: result.data.FITBIT_REDIRECT_URI,
    ARDUINO_INGEST_TOKEN: result.data.ARDUINO_INGEST_TOKEN,
    ARDUINO_DEVICE_KEYS_JSON: result.data.ARDUINO_DEVICE_KEYS_JSON,
    HEALTH_CONNECT_WEBHOOK_SECRET: result.data.HEALTH_CONNECT_WEBHOOK_SECRET,
    TRUST_PROXY_HEADERS: result.data.TRUST_PROXY_HEADERS.toLowerCase() === "true",
    VERDA_AI_ENABLED: result.data.VERDA_AI_ENABLED.toLowerCase() === "true",
    VERDA_PATIENT_STEP_ENABLED:
      result.data.VERDA_PATIENT_STEP_ENABLED.toLowerCase() === "true",
    VERDA_INFERENCE_URL: result.data.VERDA_INFERENCE_URL,
    VERDA_API_KEY: result.data.VERDA_API_KEY,
    VERDA_GEMMA_MODEL: result.data.VERDA_GEMMA_MODEL || "google/gemma-3-27b-it",
    STORE_ITEM_ANSWERS: result.data.STORE_ITEM_ANSWERS.toLowerCase() === "true",
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
