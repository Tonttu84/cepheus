import { describe, expect, it } from "vitest";
import type { PatientActor, StaffActor, SystemActor } from "../../access/types";
import { decideRewardsAccess } from "../access";

describe("Rewards Access Control (Rule 9)", () => {
  const patientId = "patient-123";
  const clinicId = "clinic-456";

  const patientActor: PatientActor = {
    kind: "patient",
    patientId,
    clinicId,
  };

  const otherPatientActor: PatientActor = {
    kind: "patient",
    patientId: "patient-999",
    clinicId,
  };

  const nurseActor: StaffActor = {
    kind: "staff",
    staffId: "nurse-1",
    clinicId,
    role: "nurse",
  };

  const adminActor: StaffActor = {
    kind: "staff",
    staffId: "admin-1",
    clinicId,
    role: "admin",
  };

  const systemActor: SystemActor = {
    kind: "system",
  };

  it("allows the patient to access their own data", () => {
    const decision = decideRewardsAccess(patientActor, patientId);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
  });

  it("refuses another patient accessing data", () => {
    const decision = decideRewardsAccess(otherPatientActor, patientId);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("refused_not_own_data");
  });

  it("refuses clinic nurse accessing patient rewards data", () => {
    const decision = decideRewardsAccess(nurseActor, patientId);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("refused_staff_forbidden");
  });

  it("refuses clinic admin accessing patient rewards data", () => {
    const decision = decideRewardsAccess(adminActor, patientId);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("refused_staff_forbidden");
  });

  it("refuses system actor accessing patient rewards data", () => {
    const decision = decideRewardsAccess(systemActor, patientId);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("refused_patient_only");
  });

  it("refuses malformed or null actor", () => {
    const decision = decideRewardsAccess(null as unknown as PatientActor, patientId);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("refused_invalid_actor");
  });
});
