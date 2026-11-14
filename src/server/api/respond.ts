import { NextResponse } from "next/server";
import type { z } from "zod";
import { CRISIS_RESOURCES } from "@/lib/constants";

const MAX_BODY_BYTES = 8_192;

/**
 * Every API answer goes through here: JSON, never cached, no cookie and no
 * header that carries an answer value. A crisis answer adds the crisis path
 * to whatever else is said, refusals and failures included.
 */
export function respond(body: Record<string, unknown>, status = 200, crisis = false): NextResponse {
  const withCrisis = crisis ? { ...body, showCrisisPath: true, crisisResources: CRISIS_RESOURCES } : body;
  return NextResponse.json(withCrisis, { status, headers: { "Cache-Control": "no-store" } });
}

export function refuse(status: number, error: string, crisis = false): NextResponse {
  return respond({ ok: false, error }, status, crisis);
}

export const INVALID_BODY = "Invalid request body.";

/** The raw JSON body, or undefined when it is missing, too large or not JSON. */
export async function readJsonBody(request: Request): Promise<unknown> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return undefined;
  }
  if (text.length === 0 || Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Parses a value with a schema; the failure says only that the input was invalid, never what it was. */
export function parseInput<T>(
  schema: z.ZodType<T>,
  value: unknown,
  crisis = false
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, response: refuse(400, INVALID_BODY, crisis) };
}

const ACCESS_REFUSALS = new Set([
  "other_clinic",
  "not_own_data",
  "clinic_staff_forbidden_clinical_data",
  "access_log_immutable",
  "admin_only",
  "consent_required",
  "method_mismatch",
  "patient_forbidden_data",
  "disallowed_action",
]);

const CONFLICT_PREFIXES = [
  "Cannot submit",
  "No round is currently open",
  "No extra item offered",
  "Extra items feature is disabled",
  "Extra answer already submitted",
  "GAD-7 is not assigned",
];

/** The status for a use case's refusal, or null when the error is not a known refusal (storage failed). */
function refusalStatus(error: string): number | null {
  if (ACCESS_REFUSALS.has(error)) return 403;
  if (error === "Patient not found") return 404;
  if (error.startsWith("Invalid ")) return 400;
  if (CONFLICT_PREFIXES.some((prefix) => error.startsWith(prefix))) return 409;
  return null;
}

export interface FailureContext {
  readonly route: string;
  readonly actorKind: string;
  /** Item ids only; answer values are never logged. */
  readonly itemId?: string;
}

/** The first line of an error, short: enough to find the cause, without the query arguments that follow it. */
function firstLine(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const line = text.split("\n").find((part) => part.trim().length > 0) ?? "";
  return line.trim().slice(0, 120);
}

/**
 * Storage failed: nothing was saved, and the answer says so plainly. The
 * log names the route, the kind of caller and the item, never answer values.
 */
export function storageFailure(context: FailureContext, error: unknown, crisis = false): NextResponse {
  console.error("[api] Storing or reading failed:", { ...context, error: firstLine(error) });
  return respond({ ok: false, saved: false, error: "Not saved: storage is not available." }, 503, crisis);
}

/** The answer to a use case that returned ok: false. */
export function failureOf(context: FailureContext, error: string, crisis = false): NextResponse {
  const status = refusalStatus(error);
  if (status === null) return storageFailure(context, error, crisis);
  return refuse(status, error, crisis);
}

/** Runs a route's storage work; anything it throws is the plain "not saved" answer. */
export async function orStorageFailure(
  context: FailureContext,
  work: () => Promise<NextResponse>,
  crisis = false
): Promise<NextResponse> {
  try {
    return await work();
  } catch (error) {
    return storageFailure(context, error, crisis);
  }
}
