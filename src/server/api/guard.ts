import type { NextResponse } from "next/server";
import type { PatientActor, StaffActor } from "@/domain/access";
import { checkRateLimit, getClientKey } from "@/server/security";
import { isSystemCaller, readCaller } from "./caller";
import { refuse, respond } from "./respond";

const REQUESTS_PER_MINUTE = 60;

type Guarded<T> = { ok: true; actor: T } | { ok: false; response: NextResponse };

function rateLimited(request: Request, route: string, identity: string): NextResponse | null {
  const rate = checkRateLimit(getClientKey(request, route, identity), REQUESTS_PER_MINUTE, 60_000);
  if (rate.allowed) return null;
  const response = respond({ ok: false, error: "Too many requests." }, 429);
  response.headers.set("Retry-After", String(rate.retryAfterSec));
  return response;
}

function guardSession(
  request: Request,
  route: string,
  crisis: boolean
): Guarded<PatientActor | StaffActor> {
  const caller = readCaller(request);
  if (!caller) return { ok: false, response: refuse(401, "Sign in required.", crisis) };
  const { actor } = caller;
  const identity = actor.kind === "patient" ? actor.patientId : actor.staffId;
  const limited = rateLimited(request, route, identity);
  if (limited) return { ok: false, response: limited };
  return { ok: true, actor };
}

/** A signed-in patient, who acts only for themself; `crisis` keeps the crisis path on a refusal. */
export function guardPatient(request: Request, route: string, crisis = false): Guarded<PatientActor> {
  const guarded = guardSession(request, route, crisis);
  if (!guarded.ok) return guarded;
  if (guarded.actor.kind !== "patient") {
    return { ok: false, response: refuse(403, "Only patient sessions may call this.", crisis) };
  }
  return { ok: true, actor: guarded.actor };
}

/** Signed-in clinic staff, who see only their own clinic. */
export function guardStaff(request: Request, route: string): Guarded<StaffActor> {
  const guarded = guardSession(request, route, false);
  if (!guarded.ok) return guarded;
  if (guarded.actor.kind !== "staff") {
    return { ok: false, response: refuse(403, "Only staff sessions may call this.") };
  }
  return { ok: true, actor: guarded.actor };
}

/** The system key only; patient and staff sessions are refused even when valid. */
export function guardSystem(request: Request): { ok: true } | { ok: false; response: NextResponse } {
  if (isSystemCaller(request)) return { ok: true };
  const hasSession = readCaller(request) !== null;
  return {
    ok: false,
    response: hasSession
      ? refuse(403, "Only the system may call this.")
      : refuse(401, "System key required."),
  };
}
