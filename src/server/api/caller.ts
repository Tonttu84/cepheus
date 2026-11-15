import type { PatientActor, StaffActor } from "@/domain/access";
import { readSessionFromRequest } from "@/server/auth";
import { getEnv } from "@/server/env";
import { extractBearerToken, timingSafeEqualString } from "@/server/security";

export interface Caller {
  readonly actor: PatientActor | StaffActor;
  readonly isSimulated: boolean;
}

/**
 * Who is calling, from trail 53's sealed session cookie: a patient with their
 * own id, or staff with their clinic. No session, or one that does not
 * unseal and parse, is null, which the routes answer with a 401.
 */
export function readCaller(request: Request): Caller | null {
  const session = readSessionFromRequest(request);
  if (!session) return null;
  return { actor: session.actor, isSimulated: session.isSimulated };
}

/** True only for the bearer system key, compared in constant time; an unset key matches nothing. */
export function isSystemCaller(request: Request): boolean {
  const key = getEnv().SYSTEM_API_KEY;
  const bearer = extractBearerToken(request);
  return key.length > 0 && bearer !== null && timingSafeEqualString(bearer, key);
}
