import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type {
  AuthSession,
  PatientAuthSession,
  StaffAuthSession,
} from "@/lib/auth-types";
import { getRouteDeps } from "@/server/api";
import { readServerSession, readSessionFromRequest } from "./session";

export type ApiSessionResult<T extends AuthSession = AuthSession> =
  | { ok: true; session: T }
  | { ok: false; response: NextResponse };

export function requireApiSession(
  request: Request
): ApiSessionResult<AuthSession>;
export function requireApiSession(
  request: Request,
  allowedKind: "patient"
): ApiSessionResult<PatientAuthSession>;
export function requireApiSession(
  request: Request,
  allowedKind: "staff"
): ApiSessionResult<StaffAuthSession>;
export function requireApiSession(
  request: Request,
  allowedKind?: "patient" | "staff"
): ApiSessionResult<AuthSession> {
  const session = readSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          code: "unauthenticated",
          error: "Authentication required.",
        },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }
  if (allowedKind && session.kind !== allowedKind) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          code: "forbidden",
          error: "Access restricted for your account role.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }
  return { ok: true, session };
}

async function checkPatientTakingPart(patientId: string): Promise<boolean> {
  try {
    const { ports } = getRouteDeps();
    const switches = await ports.patients.getPatientAccessSwitches(patientId);
    return switches?.consent.taking_part ?? false;
  } catch {
    return false;
  }
}

export async function requirePatientPageSession(options?: {
  allowUnconsented?: boolean;
}): Promise<PatientAuthSession> {
  const session = await readServerSession();
  if (!session) {
    redirect("/sign-in");
  }
  if (session.kind !== "patient") {
    redirect("/clinic");
  }

  if (!options?.allowUnconsented) {
    const takingPart = await checkPatientTakingPart(session.actor.patientId);
    if (!takingPart) {
      redirect("/consent");
    }
  }

  return session;
}

export async function requireStaffPageSession(): Promise<StaffAuthSession> {
  const session = await readServerSession();
  if (!session) {
    redirect("/sign-in");
  }
  if (session.kind !== "staff") {
    redirect("/patient");
  }
  return session;
}
