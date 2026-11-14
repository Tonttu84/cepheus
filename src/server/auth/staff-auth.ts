import { getPrisma } from "@/lib/db";
import {
  SIMULATED_STAFF_PRESETS,
  type StaffAuthSession,
} from "@/lib/auth-types";
import { getEnv } from "@/server/env";
import { verifyTotp } from "@/server/auth/totp";
import { timingSafeEqualString } from "@/server/security/crypto";

export interface StaffCredentialsInput {
  email: string;
  password: string;
  totpCode: string;
}

export type StaffSecondFactorKind = "time_based" | "fixed_demo";

export function getStaffSecondFactorKind(): StaffSecondFactorKind {
  const secret = getEnv().STAFF_TOTP_SECRET;
  return secret && secret.length > 0 ? "time_based" : "fixed_demo";
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
// Demonstration defaults for simulated staff.
const LOCAL_DEMO_PASSPHRASE = "cepheus-local-only";
// Demonstration defaults for simulated staff.
const LOCAL_DEMO_TOTP_CODE = "123456";

function resolveConfiguredSecrets(): {
  passphrase: string;
  totpKind: StaffSecondFactorKind;
  totpSecret?: string;
  demoTotpCode?: string;
} | null {
  const env = getEnv();
  const isProduction = env.NODE_ENV === "production";
  const envPassphrase = process.env.STAFF_DEMO_PASSPHRASE?.trim() ?? "";
  const passphrase = isProduction
    ? envPassphrase
    : envPassphrase || LOCAL_DEMO_PASSPHRASE;

  if (!passphrase) {
    return null;
  }

  if (env.STAFF_TOTP_SECRET && env.STAFF_TOTP_SECRET.length > 0) {
    return {
      passphrase,
      totpKind: "time_based",
      totpSecret: env.STAFF_TOTP_SECRET,
    };
  }

  const envTotp = process.env.STAFF_DEMO_TOTP_CODE?.trim();
  return {
    passphrase,
    totpKind: "fixed_demo",
    demoTotpCode: envTotp || LOCAL_DEMO_TOTP_CODE,
  };
}

export type StaffIdResolver = (
  email: string,
  fallbackStaffId: string
) => Promise<{ staffId: string; clinicId: string }>;

async function defaultResolveStaffIds(
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

let activeStaffIdResolver: StaffIdResolver = defaultResolveStaffIds;

export function _setStaffIdResolver(resolver: StaffIdResolver | null): void {
  activeStaffIdResolver = resolver ?? defaultResolveStaffIds;
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

  const passwordMatches = timingSafeEqualString(
    input.password,
    secrets.passphrase
  );

  if (!preset || !passwordMatches) {
    return {
      ok: false,
      status: 401,
      code: "invalid_credentials",
      message: "Invalid staff email or passphrase.",
    };
  }

  const trimmedTotp = input.totpCode.trim();

  if (secrets.totpKind === "time_based" && secrets.totpSecret) {
    const verifyResult = verifyTotp({
      secret: secrets.totpSecret,
      code: trimmedTotp,
      accountKey: preset.email,
    });

    if (!verifyResult.ok) {
      return {
        ok: false,
        status: 401,
        code: "invalid_second_factor",
        message: "Invalid 6-digit verification code.",
      };
    }
  } else {
    const expectedCode = secrets.demoTotpCode ?? LOCAL_DEMO_TOTP_CODE;
    if (
      !/^\d{6}$/.test(trimmedTotp) ||
      !timingSafeEqualString(trimmedTotp, expectedCode)
    ) {
      return {
        ok: false,
        status: 401,
        code: "invalid_second_factor",
        message: "Invalid 6-digit verification code.",
      };
    }
  }

  const { staffId, clinicId } = await activeStaffIdResolver(
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
