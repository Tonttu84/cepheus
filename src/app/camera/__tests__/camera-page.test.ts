import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import type { PatientAuthSession } from "@/lib/auth-types";
import { requirePatientPageSession } from "@/server/auth";
import { getRouteDeps } from "@/server/api";
import { getPatientConsent } from "@/usecases";
import CameraPage from "../page";
import {
  CameraCheckSession,
  saveCompletedCameraReading,
} from "@/components/camera-check-session";

vi.mock("@/server/auth", () => ({
  requirePatientPageSession: vi.fn(),
}));

vi.mock("@/server/api", () => ({
  getRouteDeps: vi.fn(),
}));

vi.mock("@/usecases", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/usecases");
  return {
    ...actual,
    getPatientConsent: vi.fn(),
  };
});

function findInTree(
  node: React.ReactNode,
  predicate: (el: React.ReactElement<{ children?: React.ReactNode; canSave?: boolean }>) => boolean
): React.ReactElement<{ children?: React.ReactNode; canSave?: boolean }> | null {
  if (!React.isValidElement(node)) return null;
  const el = node as React.ReactElement<{ children?: React.ReactNode; canSave?: boolean }>;
  if (predicate(el)) return el;
  const children = React.Children.toArray(el.props?.children);
  for (const child of children) {
    const found = findInTree(child, predicate);
    if (found) return found;
  }
  return null;
}

function getTextContent(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!React.isValidElement(node)) return "";
  const el = node as React.ReactElement<{ children?: React.ReactNode }>;
  const children = React.Children.toArray(el.props?.children);
  return children.map(getTextContent).join(" ");
}

describe("Camera Page Consent & Saving Enforcement", () => {
  const mockPatientSession: PatientAuthSession = {
    kind: "patient",
    actor: { kind: "patient", patientId: "pt-cam-1", clinicId: "clinic-1" },
    participantCode: "P-SIM-001",
    label: "Simulated participant",
    avatarInitials: "PC",
    authMethod: "simulated_finnish_eid",
    isSimulated: true,
    signedInAt: "2026-11-16T18:00:00.000Z",
  };

  const mockPorts = {
    camera: {
      getCameraReadings: vi.fn().mockResolvedValue([]),
      saveCameraReading: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePatientPageSession).mockResolvedValue(mockPatientSession);
    vi.mocked(getRouteDeps).mockReturnValue({
      ports: mockPorts,
      rewardsPorts: {} as never,
      clinicPatientIds: [] as never,
    } as unknown as ReturnType<typeof getRouteDeps>);
  });

  it("reads patient consent via getPatientConsent and plainly displays 'Saving is off' when camera consent is paused or not granted", async () => {
    vi.mocked(getPatientConsent).mockResolvedValue({
      ok: true,
      value: {
        consent: {
          taking_part: true,
          methods: { ring: true, camera: false },
          rule_check: true,
        },
      },
    });

    const pageElement = await CameraPage();
    expect(getPatientConsent).toHaveBeenCalledWith(
      mockPatientSession.actor,
      { patientId: "pt-cam-1" },
      mockPorts
    );

    const fullText = getTextContent(pageElement);
    expect(fullText).toContain("Saving is off");

    const sessionEl = findInTree(pageElement, (el) => el.type === CameraCheckSession);
    expect(sessionEl).not.toBeNull();
    expect(sessionEl?.props.canSave).toBe(false);
  });

  it("plainly displays 'Saving is off' and sets canSave = false when taking_part is false", async () => {
    vi.mocked(getPatientConsent).mockResolvedValue({
      ok: true,
      value: {
        consent: {
          taking_part: false,
          methods: { ring: true, camera: true },
          rule_check: false,
        },
      },
    });

    const pageElement = await CameraPage();
    const fullText = getTextContent(pageElement);
    expect(fullText).toContain("Saving is off");

    const sessionEl = findInTree(pageElement, (el) => el.type === CameraCheckSession);
    expect(sessionEl).not.toBeNull();
    expect(sessionEl?.props.canSave).toBe(false);
  });

  it("enables saving and does not show 'Saving is off' when camera consent is granted", async () => {
    vi.mocked(getPatientConsent).mockResolvedValue({
      ok: true,
      value: {
        consent: {
          taking_part: true,
          methods: { ring: true, camera: true },
          rule_check: true,
        },
      },
    });

    const pageElement = await CameraPage();
    const fullText = getTextContent(pageElement);
    expect(fullText).not.toContain("Saving is off");

    const sessionEl = findInTree(pageElement, (el) => el.type === CameraCheckSession);
    expect(sessionEl).not.toBeNull();
    expect(sessionEl?.props.canSave).toBe(true);
  });

  it("does not call the save route when canSave is false", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await saveCompletedCameraReading({
      canSave: false,
      patientId: "pt-cam-1",
      sessionResult: {
        hasNumbers: true,
        expressivity: 0.15,
        headMovement: 1.2,
        quality: { analysedFrames: 100, faceShare: 0.9, sessionDurationMs: 20000 },
      },
    });

    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("calls the save route when canSave is true and session completes with numbers", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await saveCompletedCameraReading({
      canSave: true,
      patientId: "pt-cam-1",
      sessionResult: {
        hasNumbers: true,
        expressivity: 0.15,
        headMovement: 1.2,
        quality: { analysedFrames: 100, faceShare: 0.9, sessionDurationMs: 20000 },
      },
    });

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/camera/readings",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.unstubAllGlobals();
  });
});
