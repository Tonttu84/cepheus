"use client";

import { useId, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  SIMULATED_PATIENT_PRESETS,
  SIMULATED_STAFF_PRESETS,
  type AuthSession,
  type SimulatedPatientPresetKey,
} from "@/lib/auth-types";

interface AuthPanelProps {
  onSuccess?: (session: AuthSession) => void;
}

export function PatientEidSignInPanel({ onSuccess }: AuthPanelProps) {
  const { signIn } = useAuth();
  const [submittingCode, setSubmittingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(presetKey: SimulatedPatientPresetKey) {
    setError(null);
    setSubmittingCode(presetKey);
    const result = await signIn({
      mode: "patient_eid",
      participantCode: presetKey,
    });
    setSubmittingCode(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSuccess?.(result.session);
  }

  const isSubmitting = submittingCode !== null;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-ink-secondary">
        Simulated Finnish strong electronic identification (D34). Choose your
        simulated participant to sign in at once.
      </p>

      <div
        role="group"
        aria-label="Simulated strong identification participants"
        className="space-y-2"
      >
        {SIMULATED_PATIENT_PRESETS.map((preset) => {
          const isPending = submittingCode === preset.participantCode;
          return (
            <button
              key={preset.participantCode}
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSignIn(preset.participantCode)}
              data-testid={`auth-preset-${preset.participantCode}`}
              aria-label={`Sign in as ${preset.label} (${preset.participantCode}) using simulated strong identification`}
              className="flex w-full items-start gap-3 rounded-xl border border-border-hairline bg-surface-subtle p-3 text-left transition hover:border-border-tactile hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-60"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-sage font-mono text-xs font-semibold text-white"
              >
                {preset.avatarInitials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink-primary">
                    {preset.label}
                  </span>
                  <span className="font-mono text-xs text-ink-muted">
                    {preset.participantCode}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-ink-secondary">
                  {preset.description}
                </span>
                {isPending ? (
                  <span className="mt-1 block text-xs font-medium text-accent-sage">
                    Signing in...
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          data-testid="auth-error-message"
          className="rounded-lg border border-[#fcd34d] bg-[#fffbeb] px-3 py-2 text-xs text-[#451a03]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StaffTimeBasedForm({ onSuccess }: AuthPanelProps) {
  const { signIn } = useAuth();
  const radioName = useId();
  const passwordId = useId();
  const totpId = useId();
  const [email, setEmail] = useState<string>(SIMULATED_STAFF_PRESETS[0].email);
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(totpCode.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setSubmitting(true);
    const result = await signIn({
      mode: "staff",
      email,
      password,
      totpCode: totpCode.trim(),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSuccess?.(result.session);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs leading-relaxed text-ink-secondary">
        Clinic staff sign-in requires a password and 6-digit code from an
        authenticator app.
      </p>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Select staff account</legend>
        {SIMULATED_STAFF_PRESETS.map((preset) => {
          const isSelected = email === preset.email;
          return (
            <label
              key={preset.email}
              data-testid={`auth-staff-${preset.role}`}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-xs transition focus-within:ring-2 focus-within:ring-accent-sage ${
                isSelected
                  ? "border-accent-sage-border bg-accent-sage-soft font-medium text-ink-primary"
                  : "border-border-hairline bg-surface-subtle text-ink-secondary hover:border-border-tactile"
              }`}
            >
              <input
                type="radio"
                name={radioName}
                value={preset.email}
                checked={isSelected}
                onChange={() => setEmail(preset.email)}
                className="h-4 w-4 accent-accent-sage"
              />
              <span className="truncate">{preset.displayName}</span>
            </label>
          );
        })}
      </fieldset>

      <div>
        <label
          htmlFor={passwordId}
          className="mb-1 block text-xs font-medium text-ink-secondary"
        >
          Password
        </label>
        <input
          id={passwordId}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="auth-staff-password"
          className="min-h-11 w-full rounded-xl border border-border-tactile bg-surface-card px-3 py-2 text-sm text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
        />
      </div>

      <div>
        <label
          htmlFor={totpId}
          className="mb-1 block text-xs font-medium text-ink-secondary"
        >
          6-digit code from authenticator app
        </label>
        <input
          id={totpId}
          type="text"
          inputMode="numeric"
          maxLength={6}
          required
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          data-testid="auth-staff-totp"
          className="min-h-11 w-full rounded-xl border border-border-tactile bg-surface-card px-3 py-2 font-mono text-sm text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
        />
        <p className="mt-1 text-[11px] text-ink-muted">
          The code comes from an authenticator app.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          data-testid="auth-error-message"
          className="rounded-lg border border-[#fcd34d] bg-[#fffbeb] px-3 py-2 text-xs text-[#451a03]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        data-testid="auth-submit-staff"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent-sage px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-60"
      >
        {submitting ? "Signing in..." : "Sign in as clinic staff"}
      </button>
    </form>
  );
}

export function StaffSignInPanel({ onSuccess }: AuthPanelProps) {
  const { signIn, secondFactor } = useAuth();
  const [submittingEmail, setSubmittingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (secondFactor === "time_based") {
    return <StaffTimeBasedForm onSuccess={onSuccess} />;
  }

  async function handleDemoSignIn(email: string) {
    setError(null);
    setSubmittingEmail(email);
    const result = await signIn({
      mode: "staff",
      email,
      password: "cepheus-local-only",
      totpCode: "123456",
    });
    setSubmittingEmail(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSuccess?.(result.session);
  }

  const isSubmitting = submittingEmail !== null;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-ink-secondary">
        Demonstration sign-in using simulated clinic credentials. Press an
        account below to sign in at once.
      </p>

      <div
        role="group"
        aria-label="Simulated clinic staff accounts"
        className="space-y-2"
      >
        {SIMULATED_STAFF_PRESETS.map((preset) => {
          const isPending = submittingEmail === preset.email;
          return (
            <button
              key={preset.email}
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleDemoSignIn(preset.email)}
              data-testid={`auth-staff-${preset.role}`}
              aria-label={`Sign in as ${preset.displayName} (${preset.role}) - demonstration sign-in`}
              className="flex w-full items-start gap-3 rounded-xl border border-border-hairline bg-surface-subtle p-3 text-left transition hover:border-border-tactile hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-60"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-sage-soft font-mono text-xs font-semibold text-ink-primary ring-1 ring-border-tactile"
              >
                {preset.avatarInitials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink-primary">
                    {preset.displayName}
                  </span>
                  <span className="rounded-full border border-border-hairline bg-surface-card px-2 py-0.5 text-[11px] text-ink-muted">
                    {preset.role}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-ink-secondary">
                  {preset.email} · {preset.clinicName}
                </span>
                {isPending ? (
                  <span className="mt-1 block text-xs font-medium text-accent-sage">
                    Signing in...
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          data-testid="auth-error-message"
          className="rounded-lg border border-[#fcd34d] bg-[#fffbeb] px-3 py-2 text-xs text-[#451a03]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
