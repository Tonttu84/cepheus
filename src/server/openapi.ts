import type { z } from "zod";
import { createDocument, type ZodOpenApiOperationObject, type ZodOpenApiPathsObject } from "zod-openapi";
import {
  AcknowledgeCrisisEventRequestSchema,
  CheckInCrisisRequestSchema,
  CheckInExtraAnswerRequestSchema,
  CheckInGad7RequestSchema,
  CheckInNotTodayRequestSchema,
  CheckInPhq9RequestSchema,
  CheckInTapsRequestSchema,
  PatientEvaluateParamsSchema,
  RecordNurseCallRequestSchema,
  RoundsCloseRequestSchema,
} from "./route-schemas";

type Caller = "patient" | "staff" | "system" | "anyone";

interface RouteEntry {
  readonly path: string;
  readonly method: "get" | "post";
  readonly caller: Caller;
  readonly summary: string;
  readonly body?: z.ZodType;
  readonly pathParams?: z.ZodObject;
}

const CALLER_TEXT: Record<Caller, string> = {
  patient: "Caller: a signed-in patient (session cookie), acting only for themself.",
  staff: "Caller: signed-in clinic staff (session cookie), for their own clinic only.",
  system: "Caller: the system only (Authorization: Bearer SYSTEM_API_KEY); sessions are refused.",
  anyone: "Caller: anyone.",
};

/** Every route of the product API (D43), with who may call it. */
export const API_ROUTES: readonly RouteEntry[] = [
  { path: "/api/check-in", method: "get", caller: "patient", summary: "The check-in state of the open round" },
  { path: "/api/check-in/taps", method: "post", caller: "patient", summary: "The two taps", body: CheckInTapsRequestSchema },
  { path: "/api/check-in/not-today", method: "post", caller: "patient", summary: '"Not today"', body: CheckInNotTodayRequestSchema },
  {
    path: "/api/check-in/phq9",
    method: "post",
    caller: "patient",
    summary: "One PHQ-9 item; a self-harm answer above 0 returns the crisis path in every answer",
    body: CheckInPhq9RequestSchema,
  },
  { path: "/api/check-in/gad7", method: "post", caller: "patient", summary: "One GAD-7 item (D35)", body: CheckInGad7RequestSchema },
  {
    path: "/api/check-in/crisis",
    method: "post",
    caller: "patient",
    summary: "A typed or spoken request for help on the check-in screen",
    body: CheckInCrisisRequestSchema,
  },
  {
    path: "/api/check-in/extra-answer",
    method: "post",
    caller: "patient",
    summary: "The experimental rotating extra question (D25)",
    body: CheckInExtraAnswerRequestSchema,
  },
  { path: "/api/clinic/flags", method: "get", caller: "staff", summary: "The flags of the caller's clinic: patient, area, dates" },
  {
    path: "/api/clinic/crisis-events",
    method: "get",
    caller: "staff",
    summary: "Unacknowledged crisis events for patients of the caller's clinic",
  },
  {
    path: "/api/clinic/crisis-events/acknowledge",
    method: "post",
    caller: "staff",
    summary: "Acknowledge a patient's unacknowledged crisis event",
    body: AcknowledgeCrisisEventRequestSchema,
  },
  {
    path: "/api/clinic/nurse-calls",
    method: "get",
    caller: "staff",
    summary: "Nurse call records for patients of the caller's clinic",
  },
  {
    path: "/api/clinic/nurse-calls",
    method: "post",
    caller: "staff",
    summary: "Record the outcome of a nurse call about a flag",
    body: RecordNurseCallRequestSchema,
  },
  { path: "/api/rounds/close", method: "post", caller: "system", summary: "Close one patient's elapsed rounds", body: RoundsCloseRequestSchema },
  {
    path: "/api/patients/{patientId}/evaluate",
    method: "post",
    caller: "system",
    summary: "Run the warning rule for one patient",
    pathParams: PatientEvaluateParamsSchema,
  },
  { path: "/api/openapi.json", method: "get", caller: "anyone", summary: "This document" },
];

const RESPONSES = {
  "200": { description: "Done" },
  "400": { description: "Invalid input; the answer does not echo it" },
  "401": { description: "No valid session or key" },
  "403": { description: "Refused by the access rules" },
  "404": { description: "Patient not found" },
  "409": { description: "Not possible now (no open round, not due, already answered)" },
  "429": { description: "Too many requests" },
  "503": { description: "Not saved: storage is not available ({ ok: false, saved: false })" },
};

function operationOf(route: RouteEntry): ZodOpenApiOperationObject {
  return {
    summary: route.summary,
    description: CALLER_TEXT[route.caller],
    ...(route.body ? { requestBody: { content: { "application/json": { schema: route.body } } } } : {}),
    ...(route.pathParams ? { requestParams: { path: route.pathParams } } : {}),
    responses: route.caller === "anyone" ? { "200": RESPONSES["200"] } : RESPONSES,
  };
}

export function getOpenApiDocument() {
  const paths: ZodOpenApiPathsObject = {};
  for (const route of API_ROUTES) {
    paths[route.path] = { ...paths[route.path], [route.method]: operationOf(route) };
  }
  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "Cepheus check-in API",
      version: "1.0.0",
      description:
        "One API for every way of answering (D43). Patients and staff are identified by the session cookie; " +
        "no route stores or returns names, free text, audio or video.",
    },
    paths,
  });
}
