import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { PatientActor, StaffActor } from "@/domain/access/types";
import { AuthSessionSchema, type AuthSession } from "@/lib/auth-types";
import { getEnv } from "@/server/env";
import { sealJson, unsealJson } from "@/server/security/crypto";

export const SESSION_COOKIE_NAME = "cepheus_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_MAX_AGE_SEC = 8 * 60 * 60;

export function sealSession(session: AuthSession): string {
  return sealJson(session, SESSION_TTL_MS);
}

export function unsealSession(
  token: string | undefined | null
): AuthSession | null {
  const unsealed = unsealJson<unknown>(token);
  if (!unsealed) {
    return null;
  }
  const parsed = AuthSessionSchema.safeParse(unsealed);
  return parsed.success ? parsed.data : null;
}

function parseCookieHeader(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) {
    return null;
  }
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

export function readSessionFromRequest(request: Request): AuthSession | null {
  const token = parseCookieHeader(
    request.headers.get("cookie"),
    SESSION_COOKIE_NAME
  );
  return unsealSession(token);
}

export async function readServerSession(): Promise<AuthSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return unsealSession(token);
}

export function applySessionCookie(
  response: NextResponse,
  session: AuthSession
): void {
  const sealed = sealSession(session);
  response.cookies.set(SESSION_COOKIE_NAME, sealed, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function sessionToActor(
  session: AuthSession
): PatientActor | StaffActor {
  return session.actor;
}
