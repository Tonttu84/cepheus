import { describe, expect, it } from "vitest";
import type { PatientAuthSession, StaffAuthSession } from "@/lib/auth-types";
import { decidePageAccess, decideRouteAccess } from "../page-access";

const SAMPLE_PATIENT: PatientAuthSession = {
  kind: "patient",
  actor: { kind: "patient", patientId: "p-001", clinicId: "c-001" },
  participantCode: "P-SIM-001",
  label: "Simulated participant",
  avatarInitials: "P1",
  authMethod: "simulated_finnish_eid",
  isSimulated: true,
  signedInAt: "2026-11-16T18:00:00.000Z",
};

const SAMPLE_STAFF: StaffAuthSession = {
  kind: "staff",
  actor: { kind: "staff", staffId: "s-001", clinicId: "c-001", role: "nurse" },
  email: "nurse@clinic.example",
  displayName: "Nurse Elena",
  clinicName: "TMS Clinic",
  avatarInitials: "NE",
  isSimulated: true,
  signedInAt: "2026-11-16T18:00:00.000Z",
};

describe("Page access decision (src/lib/page-access.ts)", () => {
  describe("Signed-in patient without consent", () => {
    it("redirects to /consent when accessing /check-in", () => {
      const decision = decidePageAccess({
        session: SAMPLE_PATIENT,
        pathname: "/check-in",
        takingPart: false,
      });
      expect(decision).toEqual({ kind: "redirect", destination: "/consent" });
    });

    it("redirects to /consent when accessing /patient", () => {
      const decision = decidePageAccess({
        session: SAMPLE_PATIENT,
        pathname: "/patient",
        takingPart: false,
      });
      expect(decision).toEqual({ kind: "redirect", destination: "/consent" });
    });

    it("redirects to /consent when accessing /monitoring", () => {
      const decision = decidePageAccess({
        session: SAMPLE_PATIENT,
        pathname: "/monitoring",
        takingPart: false,
      });
      expect(decision).toEqual({ kind: "redirect", destination: "/consent" });
    });

    it("allows access to /consent", () => {
      const decision = decidePageAccess({
        session: SAMPLE_PATIENT,
        pathname: "/consent",
        takingPart: false,
      });
      expect(decision).toEqual({ kind: "allowed", session: SAMPLE_PATIENT });
    });

    it("allows access to /privacy", () => {
      const decision = decidePageAccess({
        session: SAMPLE_PATIENT,
        pathname: "/privacy",
        takingPart: false,
      });
      expect(decision).toEqual({ kind: "allowed", session: SAMPLE_PATIENT });
    });

    it("keeps crisis path reachable", () => {
      const decision = decidePageAccess({
        session: SAMPLE_PATIENT,
        pathname: "/crisis-help",
        takingPart: false,
      });
      expect(decision).toEqual({ kind: "allowed", session: SAMPLE_PATIENT });
    });
  });

  describe("Signed-in patient with consent", () => {
    it("allows access to /check-in and other patient pages", () => {
      expect(
        decidePageAccess({
          session: SAMPLE_PATIENT,
          pathname: "/check-in",
          takingPart: true,
        })
      ).toEqual({ kind: "allowed", session: SAMPLE_PATIENT });

      expect(
        decidePageAccess({
          session: SAMPLE_PATIENT,
          pathname: "/patient",
          takingPart: true,
        })
      ).toEqual({ kind: "allowed", session: SAMPLE_PATIENT });
    });

    it("redirects /consent to /check-in when consent is already given", () => {
      const decision = decidePageAccess({
        session: SAMPLE_PATIENT,
        pathname: "/consent",
        takingPart: true,
      });
      expect(decision).toEqual({ kind: "redirect", destination: "/check-in" });
    });
  });

  describe("Staff and unauthenticated visitors", () => {
    it("sends signed-out visitors to /sign-in with returnTo", () => {
      expect(
        decidePageAccess({ session: null, pathname: "/check-in" })
      ).toEqual({ kind: "redirect", destination: "/sign-in?returnTo=%2Fcheck-in" });
    });

    it("allows public access to /privacy without signing in", () => {
      expect(
        decidePageAccess({ session: null, pathname: "/privacy" })
      ).toEqual({ kind: "allowed", session: null });
    });

    it("blocks staff from patient pages", () => {
      const decision = decidePageAccess({
        session: SAMPLE_STAFF,
        pathname: "/check-in",
      });
      expect(decision.kind).toBe("wrong_role");
    });
  });
});

describe("Route access decision (decideRouteAccess)", () => {
  it("refuses patient API calls with 403 consent_required when takingPart is false", () => {
    const decision = decideRouteAccess({
      session: SAMPLE_PATIENT,
      pathname: "/api/check-in/taps",
      takingPart: false,
    });
    expect(decision).toEqual({
      kind: "refusal",
      status: 403,
      code: "consent_required",
      message: "Consent to take part is required before accessing check-in services.",
    });
  });

  it("exempts sign-out, consent, and crisis routes from the consent check", () => {
    expect(
      decideRouteAccess({
        session: SAMPLE_PATIENT,
        pathname: "/api/auth/sign-out",
        takingPart: false,
      })
    ).toEqual({ kind: "allowed" });

    expect(
      decideRouteAccess({
        session: SAMPLE_PATIENT,
        pathname: "/api/consent",
        takingPart: false,
      })
    ).toEqual({ kind: "allowed" });

    expect(
      decideRouteAccess({
        session: SAMPLE_PATIENT,
        pathname: "/api/clinic/crisis-events",
        takingPart: false,
      })
    ).toEqual({ kind: "allowed" });
  });

  it("allows patient API calls when takingPart is true", () => {
    expect(
      decideRouteAccess({
        session: SAMPLE_PATIENT,
        pathname: "/api/check-in/taps",
        takingPart: true,
      })
    ).toEqual({ kind: "allowed" });
  });
});
