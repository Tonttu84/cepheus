import type { AuthSession } from "@/lib/auth-types";

export type ExpectedRole = "patient" | "staff" | "public";

export type PageAccessDecision =
  | { kind: "allowed"; session: AuthSession | null }
  | { kind: "redirect"; destination: string }
  | {
      kind: "wrong_role";
      session: AuthSession;
      expectedRole: "patient" | "staff";
      currentRole: "patient" | "staff";
    };

export type RouteAccessDecision =
  | { kind: "allowed" }
  | { kind: "refusal"; status: 401 | 403; code: string; message: string };

const PUBLIC_PAGES = new Set(["/", "/privacy"]);
const PATIENT_PAGES = new Set([
  "/check-in",
  "/patient",
  "/monitoring",
  "/camera",
  "/consent",
]);

const EXEMPT_PATIENT_ROUTES = [
  "/api/auth/sign-in",
  "/api/auth/sign-out",
  "/api/auth/session",
  "/api/consent",
  "/api/patient/consent",
  "/api/clinic/crisis-events",
  "/api/health",
  "/privacy",
];

export function isExemptRoute(pathname: string): boolean {
  return EXEMPT_PATIENT_ROUTES.some((prefix) => pathname.startsWith(prefix));
}

export function isCrisisPath(pathname: string): boolean {
  return (
    pathname.includes("crisis") ||
    pathname.includes("112") ||
    pathname.includes("emergency")
  );
}

/**
 * Decides whether a visitor can view a page based on session, role, and taking-part consent.
 */
export function decidePageAccess(params: {
  session: AuthSession | null;
  pathname: string;
  takingPart?: boolean;
}): PageAccessDecision {
  const { session, pathname, takingPart } = params;

  // Crisis paths and public informational pages are always reachable
  if (isCrisisPath(pathname) || pathname === "/privacy") {
    return { kind: "allowed", session };
  }

  // Not signed in
  if (!session) {
    if (PUBLIC_PAGES.has(pathname)) {
      return { kind: "allowed", session: null };
    }
    if (pathname === "/sign-in") {
      return { kind: "allowed", session: null };
    }
    const destination =
      pathname === "/" || pathname === "/sign-in"
        ? "/sign-in"
        : `/sign-in?returnTo=${encodeURIComponent(pathname)}`;
    return { kind: "redirect", destination };
  }

  // Staff user
  if (session.kind === "staff") {
    if (PATIENT_PAGES.has(pathname)) {
      return {
        kind: "wrong_role",
        session,
        expectedRole: "patient",
        currentRole: "staff",
      };
    }
    return { kind: "allowed", session };
  }

  // Patient user
  if (session.kind === "patient") {
    if (pathname === "/clinic") {
      return {
        kind: "wrong_role",
        session,
        expectedRole: "staff",
        currentRole: "patient",
      };
    }

    // Patient has NOT agreed to take part
    if (takingPart !== true) {
      if (pathname === "/consent") {
        return { kind: "allowed", session };
      }
      return { kind: "redirect", destination: "/consent" };
    }

    // Patient has agreed to take part
    if (pathname === "/consent") {
      return { kind: "redirect", destination: "/check-in" };
    }

    return { kind: "allowed", session };
  }

  return { kind: "allowed", session };
}

/**
 * Decides whether an API request from a patient session is allowed or requires consent.
 */
export function decideRouteAccess(params: {
  session: AuthSession | null;
  pathname: string;
  takingPart?: boolean;
}): RouteAccessDecision {
  const { session, pathname, takingPart } = params;

  if (isExemptRoute(pathname) || isCrisisPath(pathname)) {
    return { kind: "allowed" };
  }

  if (!session) {
    return {
      kind: "refusal",
      status: 401,
      code: "unauthenticated",
      message: "Authentication required.",
    };
  }

  if (session.kind === "patient" && takingPart !== true) {
    return {
      kind: "refusal",
      status: 403,
      code: "consent_required",
      message: "Consent to take part is required before accessing check-in services.",
    };
  }

  return { kind: "allowed" };
}
