import { getPrisma } from "@/lib/db";
import {
  SIMULATED_STAFF_PRESETS,
  type StaffAuthSession,
} from "@/lib/auth-types";
import { getEnv } from "@/server/env";
import { timingSafeEqualString } from "@/server/security/crypto";

export interface StaffCredentialsInput {
  email: string;
  password: string;
  totpCode: string;
}

export type StaffAuthResult =
  | { ok: true; session: StaffAuthSession }
  | {
      ok: false;
      status: 401 | 503;
      code:
        | "invalid_credentials"
        | "invalid_second_factor"
        | "auth_not_configured";
      message: string;
    };

const DEFAULT_SIMULATED_CLINIC_ID = "sim-clinic-01";
const LOCAL_DEMO_PASSPHRASE = "cepheus-local-only";
const LOCAL_DEMO_TOTP_CODE = "123456";

function resolveConfiguredSecrets(): {
  passphrase: string;
  totpCode: string;
} | null {
  const isProduction = getEnv().NODE_ENV === "production";
  const envPassphrase = process.env.STAFF_DEMO_PASSPHRASE?.trim() ?? "";
  const envTotp = process.env.STAFF_DEMO_TOTP_CODE?.trim() ?? "";

  if (isProduction) {
    if (!envPassphrase || !envTotp) {
      return null;
    }
    return { passphrase: envPassphrase, totpCode: envTotp };
  }

  return {
    passphrase: envPassphrase || LOCAL_DEMO_PASSPHRASE,
    totpCode: envTotp || LOCAL_DEMO_TOTP_CODE,
  };
}

async function resolveStaffIds(
  email: string,
  fallbackStaffId: string
): Promise<{ staffId: string; clinicId: string }> {
  try {
    const prisma = getPrisma();
    const clinic = await prisma.clinic.findUnique({
      where: { code: DEFAULT_SIMULATED_CLINIC_ID },
      select: { id: true },
    });
    const staff = await prisma.staffUser.findUnique({
      where: { email },
      select: { id: true, clinicId: true },
    });
    if (staff) {
      return {
        staffId: staff.id,
        clinicId: clinic?.id ?? staff.clinicId,
      };
    }
  } catch {
    // Database unavailable; fall back to deterministic simulated IDs.
  }

  return {
    staffId: fallbackStaffId,
    clinicId: DEFAULT_SIMULATED_CLINIC_ID,
  };
}

export async function authenticateStaffCredentials(
  input: StaffCredentialsInput
): Promise<StaffAuthResult> {
  const secrets = resolveConfiguredSecrets();
  if (!secrets) {
    return {
      ok: false,
      status: 503,
      code: "auth_not_configured",
      message: "Staff authentication is not configured for production.",
    };
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const preset = SIMULATED_STAFF_PRESETS.find(
    (item) => item.email === normalizedEmail
  );

  if (!preset || !timingSafeEqualString(input.password, secrets.passphrase)) {
    return {
      ok: false,
      status: 401,
      code: "invalid_credentials",
      message: "Invalid staff email or passphrase.",
    };
  }

  const trimmedTotp = input.totpCode.trim();
  if (
    !/^\d{6}$/.test(trimmedTotp) ||
    !timingSafeEqualString(trimmedTotp, secrets.totpCode)
  ) {
    return {
      ok: false,
      status: 401,
      code: "invalid_second_factor",
      message: "Invalid 6-digit verification code.",
    };
  }

  const { staffId, clinicId } = await resolveStaffIds(
    preset.email,
    preset.fallbackStaffId
  );

  return {
    ok: true,
    session: {
      kind: "staff",
      actor: {
        kind: "staff",
        staffId,
        clinicId,
        role: preset.role,
      },
      displayName: preset.displayName,
      email: preset.email,
      clinicName: preset.clinicName,
      avatarInitials: preset.avatarInitials,
      isSimulated: true,
      signedInAt: new Date().toISOString(),
    },
  };
}
