import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { PatientActor } from "@/domain/access";
import { containsRawMediaFields } from "@/domain/arduino";
import { getOpenRound } from "@/domain/rounds";
import {
  defaultResolveDevicePatient,
  failureOf,
  getRouteDeps,
  isCrisisAnswer,
  orStorageFailure,
  refuse,
  respond,
  runRuleIfNeeded,
} from "@/server/api";
import { getEnv } from "@/server/env";
import { isCrisisBedsideInput, type BedsideCheckInInput } from "@/server/monitoring/bedside";
import {
  checkAndRecordDeviceReplay,
  checkRateLimit,
  extractBearerToken,
  getClientKey,
  verifyArduinoDeviceCredential,
  verifySameOrigin,
} from "@/server/security";
import {
  submitNotToday,
  submitPhq9Answer,
  submitTaps,
  type Ports,
} from "@/usecases";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8_192;
const ROUTE = "arduino:check-in";

const baseFields = {
  deviceId: z.string().min(2).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timestampMs: z.number().finite().optional(),
  nonce: z.string().min(8).max(128).optional(),
  isSimulated: z.boolean().default(false),
};

const bedsideCheckInSchema = z.discriminatedUnion("kind", [
  z.object({
    ...baseFields,
    kind: z.literal("taps"),
    mood: z.number().int().min(0).max(4),
    interest: z.number().int().min(0).max(4),
  }),
  z.object({
    ...baseFields,
    kind: z.literal("not_today"),
  }),
  z.object({
    ...baseFields,
    kind: z.literal("phq9_item"),
    itemId: z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    value: z.number().int().min(0).max(3),
  }),
  z.object({
    ...baseFields,
    kind: z.literal("crisis_button"),
  }),
]);

export type BedsidePayload = z.infer<typeof bedsideCheckInSchema>;

function authenticateDevice(
  request: Request,
  deviceId: string,
  timestampMs: number | undefined,
  nonce: string | undefined,
  isSimulated: boolean
): { ok: true } | { ok: false; status: 401 | 409; error: string } {
  const env = getEnv();
  const sameOriginUiSim =
    env.NODE_ENV !== "production" && verifySameOrigin(request) && isSimulated;
  if (sameOriginUiSim) return { ok: true };

  const hasCreds =
    env.ARDUINO_DEVICE_KEYS_JSON.length > 0 || env.ARDUINO_INGEST_TOKEN.length > 0;
  if (!hasCreds && env.NODE_ENV === "production") {
    return { ok: false, status: 401, error: "Hardware credentials required in production." };
  }
  if (hasCreds) {
    const cred = verifyArduinoDeviceCredential(deviceId, extractBearerToken(request));
    if (!cred.ok) return { ok: false, status: 401, error: cred.reason };
    const replay = checkAndRecordDeviceReplay(deviceId, timestampMs, nonce);
    if (!replay.ok) return { ok: false, status: replay.status, error: replay.reason };
  }
  return { ok: true };
}

async function readBedsideBody(
  request: Request
): Promise<
  | { ok: true; raw: unknown; body: BedsidePayload }
  | { ok: false; response: NextResponse }
> {
  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return { ok: false, response: refuse(400, "Unable to read body.") };
  }
  if (Buffer.byteLength(rawText, "utf8") > MAX_BYTES) {
    return { ok: false, response: refuse(413, "Payload exceeds 8 KB limit.") };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return { ok: false, response: refuse(400, "Invalid JSON.") };
  }

  const crisis = isCrisisAnswer(raw) || (typeof raw === "object" && raw !== null && (raw as Record<string, unknown>).kind === "crisis_button");
  const rawMediaKey = containsRawMediaFields(raw);
  if (rawMediaKey) {
    return { ok: false, response: refuse(400, `Refused raw media field "${rawMediaKey}".`, crisis) };
  }

  const parsed = bedsideCheckInSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: refuse(400, "Invalid bedside check-in payload.", crisis) };
  }

  return { ok: true, raw, body: parsed.data };
}

async function resolveBedsideCrisisRound(ports: Ports, patientId: string): Promise<number> {
  const patient = await ports.patients.getPatient(patientId);
  const openRound = patient ? getOpenRound(patient.schedule, ports.clock.now()) : null;
  if (openRound) return openRound.number;
  const rounds = await ports.rounds.getRounds(patientId);
  if (rounds.length > 0) {
    return Math.max(...rounds.map((r) => r.roundNumber));
  }
  return 1;
}

async function handleCrisisButton(actor: PatientActor, ports: Ports): Promise<NextResponse> {
  const roundNumber = await resolveBedsideCrisisRound(ports, actor.patientId);
  await ports.unitOfWork.execute(async () => {
    await ports.crisis.saveCrisisEvent({
      patientId: actor.patientId,
      roundNumber,
      itemId: "crisis_button",
      value: 1,
      occurredAt: ports.clock.now(),
    });
  });
  return respond({ ok: true, saved: true, kind: "crisis_button", roundNumber }, 200, true);
}

async function handleTaps(
  actor: PatientActor,
  data: Extract<BedsidePayload, { kind: "taps" }>,
  ports: Ports,
  context: { route: string; actorKind: string }
): Promise<NextResponse> {
  const result = await submitTaps(
    actor,
    { patientId: actor.patientId, mood: data.mood, interest: data.interest },
    ports
  );
  if (!result.ok) return failureOf(context, result.error, false);
  await runRuleIfNeeded(actor.patientId, result.value.ruleRunNeeded, ports);
  return respond({ ok: true, saved: true, kind: "taps" });
}

async function handleNotToday(
  actor: PatientActor,
  ports: Ports,
  context: { route: string; actorKind: string }
): Promise<NextResponse> {
  const result = await submitNotToday(actor, { patientId: actor.patientId }, ports);
  if (!result.ok) return failureOf(context, result.error, false);
  await runRuleIfNeeded(actor.patientId, result.value.ruleRunNeeded, ports);
  return respond({ ok: true, saved: true, kind: "not_today" });
}

async function handlePhq9Item(
  actor: PatientActor,
  data: Extract<BedsidePayload, { kind: "phq9_item" }>,
  ports: Ports,
  crisis: boolean,
  context: { route: string; actorKind: string; itemId: string }
): Promise<NextResponse> {
  const result = await submitPhq9Answer(
    actor,
    { patientId: actor.patientId, itemId: data.itemId, value: data.value },
    ports
  );
  if (!result.ok) {
    return failureOf(context, result.error, crisis || result.showCrisisPath === true);
  }
  await runRuleIfNeeded(actor.patientId, result.value.ruleRunNeeded, ports);
  const showCrisis = crisis || result.value.showCrisisPath;
  return respond(
    { ok: true, saved: true, kind: "phq9_item", progress: result.value.progress, showCrisisPath: showCrisis },
    200,
    showCrisis
  );
}

async function dispatchBedsideAction(
  actor: PatientActor,
  data: BedsidePayload,
  ports: Ports,
  crisis: boolean
): Promise<NextResponse> {
  const context = {
    route: ROUTE,
    actorKind: actor.kind,
    itemId: data.kind === "phq9_item" ? data.itemId : undefined,
  };
  if (data.kind === "crisis_button") {
    return handleCrisisButton(actor, ports);
  }
  if (data.kind === "taps") {
    return handleTaps(actor, data, ports, context);
  }
  if (data.kind === "not_today") {
    return handleNotToday(actor, ports, context);
  }
  return handlePhq9Item(actor, data, ports, crisis, context as { route: string; actorKind: string; itemId: string });
}

export async function POST(request: Request) {
  const read = await readBedsideBody(request);
  if (!read.ok) return read.response;
  const { raw, body } = read;
  const crisis = isCrisisAnswer(raw) || isCrisisBedsideInput(body as BedsideCheckInInput);

  const rate = checkRateLimit(getClientKey(request, "arduino-checkin"), 60, 60_000);
  if (!rate.allowed) {
    const res = refuse(429, "Rate limit exceeded.", crisis);
    res.headers.set("Retry-After", String(rate.retryAfterSec));
    return res;
  }

  const auth = authenticateDevice(request, body.deviceId, body.timestampMs, body.nonce, body.isSimulated);
  if (!auth.ok) {
    return refuse(auth.status, auth.error, crisis);
  }

  const context = {
    route: ROUTE,
    actorKind: "patient",
    itemId: body.kind === "phq9_item" ? body.itemId : undefined,
    deviceHash: crypto.createHash("sha256").update(body.deviceId).digest("hex").slice(0, 12),
  };

  return orStorageFailure(
    context,
    async () => {
      const { ports, resolveDevicePatient } = getRouteDeps();
      const patient = resolveDevicePatient
        ? await resolveDevicePatient(body.deviceId)
        : await defaultResolveDevicePatient();
      const actor: PatientActor = {
        kind: "patient",
        patientId: patient.patientId,
        clinicId: patient.clinicId,
      };
      return dispatchBedsideAction(actor, body, ports, crisis);
    },
    crisis
  );
}
