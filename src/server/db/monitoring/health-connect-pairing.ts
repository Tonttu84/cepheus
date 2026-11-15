import crypto from "node:crypto";
import type { PrismaClient, WebhookCredential } from "@prisma/client";
import { decideAccess } from "@/domain/access";
import {
  buildHcWebhookAuthHeaders,
  buildLifeDashboardPairingUri,
  encodeQrMatrix,
} from "@/domain/health-connect";
import type { PatientAuthSession } from "@/lib/auth-types";
import { getPrisma } from "@/lib/db";
import { getEnv } from "@/server/env";
import {
  sealJson,
  sha256Hex,
  timingSafeEqualString,
  unsealJson,
  verifyHmacSha256Signature,
} from "@/server/security";
import { resolveMonitoringTarget } from "./session-scope";
import {
  ensureHomeDemoParticipant,
  loadConsentContext,
} from "@/server/monitoring/store";

const SEAL_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export interface HealthConnectPairingStatus {
  configuredViaEnv: boolean;
  paired: boolean;
  tokenId: string | null;
  webhookUrl: string;
  lastTestPingAt: string | null;
  lastSyncAt: string | null;
  lastSequence: number | null;
  ringConsentEnabled: boolean;
}

export interface HealthConnectProvisionedPairing {
  tokenId: string;
  secret: string;
  webhookUrl: string;
  lifeDashboardUri: string;
  qrMatrix: boolean[][];
  bearerHeader: string;
  apiKeyHeader: string;
}

function resolveOrigin(requestOrigin: string): string {
  return requestOrigin.replace(/\/+$/, "");
}

function buildWebhookUrl(origin: string, tokenId: string | null): string {
  const base = `${origin}/api/webhooks/health-connect`;
  return tokenId ? `${base}?token=${encodeURIComponent(tokenId)}` : base;
}

function unsealCredentialSecret(cred: WebhookCredential | null): string | null {
  if (!cred || cred.revokedAt !== null) return null;
  const unsealed = unsealJson<{ secret: string }>(cred.sealedSecret);
  if (!unsealed || typeof unsealed.secret !== "string" || unsealed.secret.length === 0) {
    return null;
  }
  return unsealed.secret;
}

function verifyCredentialAuth(
  cred: WebhookCredential,
  secret: string,
  input: {
    rawBody: string;
    sigHeader: string | null;
    presentedToken: string | null;
  }
): boolean {
  if (verifyHmacSha256Signature(input.rawBody, input.sigHeader, secret)) {
    return true;
  }
  if (input.presentedToken === null) return false;
  return timingSafeEqualString(sha256Hex(input.presentedToken), cred.bearerHash);
}

export async function getHealthConnectPairingStatus(
  requestOrigin: string,
  prisma: PrismaClient = getPrisma(),
  session?: PatientAuthSession
): Promise<HealthConnectPairingStatus> {
  const origin = resolveOrigin(requestOrigin);
  const target = await resolveMonitoringTarget({ session }, prisma);
  if (!target) {
    throw new Error("Participant record unavailable.");
  }
  const { participant } = target;
  const { consentState } = await loadConsentContext(participant.id, prisma);
  const cred = await prisma.webhookCredential.findUnique({
    where: { participantId: participant.id },
  });

  const activeSecret = unsealCredentialSecret(cred);
  const paired = activeSecret !== null && cred !== null;
  const tokenId = paired ? cred.tokenId : null;

  return {
    configuredViaEnv: getEnv().HEALTH_CONNECT_WEBHOOK_SECRET.length > 0,
    paired,
    tokenId,
    webhookUrl: buildWebhookUrl(origin, tokenId),
    lastTestPingAt: paired && cred.lastTestPingAt ? cred.lastTestPingAt.toISOString() : null,
    lastSyncAt: paired && cred.lastSyncAt ? cred.lastSyncAt.toISOString() : null,
    lastSequence: paired ? cred.lastSequence : null,
    ringConsentEnabled: consentState.methods.ring,
  };
}

async function upsertParticipantCredential(
  participant: { id: string; clinicId: string | null },
  prisma: PrismaClient
): Promise<{ tokenId: string; secret: string }> {
  const tokenId = crypto.randomBytes(16).toString("base64url");
  const secret = crypto.randomBytes(32).toString("base64url");
  const sealedSecret = sealJson({ secret }, SEAL_TTL_MS);
  const bearerHash = sha256Hex(secret);

  await prisma.webhookCredential.upsert({
    where: { participantId: participant.id },
    create: {
      participantId: participant.id,
      clinicId: participant.clinicId,
      tokenId,
      sealedSecret,
      bearerHash,
      lastSequence: null,
      lastTestPingAt: null,
      lastSyncAt: null,
      revokedAt: null,
    },
    update: {
      tokenId,
      sealedSecret,
      bearerHash,
      lastSequence: null,
      lastTestPingAt: null,
      lastSyncAt: null,
      revokedAt: null,
    },
  });

  return { tokenId, secret };
}

function canWriteRingForParticipant(
  participantId: string,
  clinicId: string,
  consentState: Awaited<ReturnType<typeof loadConsentContext>>["consentState"]
): boolean {
  const access = decideAccess({
    actor: { kind: "patient", patientId: participantId, clinicId },
    action: "write",
    target: { kind: "readings", patientId: participantId, clinicId, method: "ring" },
    purpose: "method:ring",
    consent: consentState,
  });
  return Boolean(access.ok && access.value.allowed && consentState.methods.ring);
}

export async function provisionOrRotateHealthConnectPairing(
  requestOrigin: string,
  prisma: PrismaClient = getPrisma(),
  session?: PatientAuthSession
): Promise<
  | {
      ok: true;
      pairing: HealthConnectProvisionedPairing;
      status: HealthConnectPairingStatus;
    }
  | { ok: false; status: 403; error: string }
> {
  const origin = resolveOrigin(requestOrigin);
  const target = await resolveMonitoringTarget({ session }, prisma);
  if (!target) {
    return { ok: false, status: 403, error: "Participant record unavailable." };
  }
  const { participant, clinicCode } = target;
  const { consentState } = await loadConsentContext(participant.id, prisma);
  if (!canWriteRingForParticipant(participant.id, participant.clinicId ?? clinicCode, consentState)) {
    return {
      ok: false,
      status: 403,
      error: "Enable Wearable sleep & activity rhythm consent before pairing a phone.",
    };
  }

  const { tokenId, secret } = await upsertParticipantCredential(participant, prisma);
  const webhookUrl = buildWebhookUrl(origin, tokenId);
  const lifeDashboardUri = buildLifeDashboardPairingUri({ webhookUrl, secret });
  const qrMatrix = encodeQrMatrix(lifeDashboardUri);
  const { bearerHeader, apiKeyHeader } = buildHcWebhookAuthHeaders(secret);
  const status = await getHealthConnectPairingStatus(origin, prisma, session);

  return {
    ok: true,
    pairing: {
      tokenId,
      secret,
      webhookUrl,
      lifeDashboardUri,
      qrMatrix,
      bearerHeader,
      apiKeyHeader,
    },
    status,
  };
}

export async function revokeHealthConnectPairing(
  requestOrigin: string,
  prisma: PrismaClient = getPrisma(),
  session?: PatientAuthSession
): Promise<HealthConnectPairingStatus> {
  const origin = resolveOrigin(requestOrigin);
  const target = await resolveMonitoringTarget({ session }, prisma);
  if (!target) {
    throw new Error("Participant record unavailable.");
  }
  const { participant } = target;
  const existing = await prisma.webhookCredential.findUnique({
    where: { participantId: participant.id },
    select: { id: true, revokedAt: true },
  });

  if (existing && existing.revokedAt === null) {
    await prisma.webhookCredential.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
  }

  return getHealthConnectPairingStatus(origin, prisma, session);
}

type WebhookAuthResult =
  | {
      ok: true;
      credentialId: string | null;
      participantId: string | null;
      lastSequence: number | null;
    }
  | { ok: false };

function matchCredential(
  cred: WebhookCredential | null,
  rawBody: string,
  sigHeader: string | null,
  presentedToken: string | null
): WebhookAuthResult {
  const secret = unsealCredentialSecret(cred);
  if (!cred || !secret) return { ok: false };
  const valid = verifyCredentialAuth(cred, secret, {
    rawBody,
    sigHeader,
    presentedToken,
  });
  return valid
    ? {
        ok: true,
        credentialId: cred.id,
        participantId: cred.participantId,
        lastSequence: cred.lastSequence,
      }
    : { ok: false };
}

export async function verifyAndResolveHealthConnectWebhook(
  input: {
    rawBody: string;
    tokenParam: string | null;
    sigHeader: string | null;
    bearerToken: string | null;
    webhookTokenHeader: string | null;
    apiKeyHeader: string | null;
  },
  prisma: PrismaClient = getPrisma()
): Promise<WebhookAuthResult> {
  if (
    !input.sigHeader &&
    !input.bearerToken &&
    !input.webhookTokenHeader &&
    !input.apiKeyHeader
  ) {
    return { ok: false };
  }

  const presentedToken =
    input.bearerToken ?? input.webhookTokenHeader ?? input.apiKeyHeader;

  if (input.tokenParam) {
    const cred = await prisma.webhookCredential.findUnique({
      where: { tokenId: input.tokenParam },
    });
    return matchCredential(cred, input.rawBody, input.sigHeader, presentedToken);
  }

  const envSecret = getEnv().HEALTH_CONNECT_WEBHOOK_SECRET;
  if (envSecret.length > 0) {
    const envHmac = verifyHmacSha256Signature(input.rawBody, input.sigHeader, envSecret);
    const envToken =
      presentedToken !== null && timingSafeEqualString(presentedToken, envSecret);
    if (envHmac || envToken) {
      return { ok: true, credentialId: null, participantId: null, lastSequence: null };
    }
  }

  try {
    const participant = await ensureHomeDemoParticipant(prisma);
    const cred = await prisma.webhookCredential.findUnique({
      where: { participantId: participant.id },
    });
    return matchCredential(cred, input.rawBody, input.sigHeader, presentedToken);
  } catch {
    return { ok: false };
  }
}

export async function recordHealthConnectWebhookDelivery(
  params: {
    credentialId: string | null;
    isTestPing: boolean;
    sequence?: number;
  },
  prisma: PrismaClient = getPrisma()
): Promise<{ duplicateSequence: boolean }> {
  if (!params.credentialId) {
    return { duplicateSequence: false };
  }

  if (params.isTestPing) {
    await prisma.webhookCredential.update({
      where: { id: params.credentialId },
      data: { lastTestPingAt: new Date() },
    });
    return { duplicateSequence: false };
  }

  const cred = await prisma.webhookCredential.findUnique({
    where: { id: params.credentialId },
    select: { lastSequence: true },
  });

  if (typeof params.sequence === "number" && cred?.lastSequence === params.sequence) {
    return { duplicateSequence: true };
  }

  await prisma.webhookCredential.update({
    where: { id: params.credentialId },
    data: {
      lastSyncAt: new Date(),
      ...(typeof params.sequence === "number" ? { lastSequence: params.sequence } : {}),
    },
  });

  return { duplicateSequence: false };
}
