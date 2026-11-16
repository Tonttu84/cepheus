"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  PatientEidSignInPanel,
  StaffSignInPanel,
} from "@/components/auth-forms";
import { useAuth } from "@/components/auth-provider";
import type { AuthSession } from "@/lib/auth-types";
import { safeReturnUrl } from "@/lib/safe-return-url";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { session, signOut } = useAuth();

  const handleSuccess = (signedInSession?: AuthSession) => {
    if (returnTo) {
      const safe = safeReturnUrl(returnTo);
      if (safe) {
        router.push(safe);
        return;
      }
    }
    router.push(signedInSession?.kind === "staff" ? "/clinic" : "/check-in");
  };

  return (
    <div data-testid="sign-in-page" className="space-y-8">
      <header className="space-y-3">
        <span
          data-testid="simulated-badge"
          className="inline-block rounded-full border border-[#fcd34d] bg-[#fffbeb] px-3 py-1 text-xs font-medium text-[#451a03]"
        >
          Simulated data
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-primary">
          Sign in to Cepheus
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-secondary">
          Choose a sample participant or clinic staff account below. Participant
          sign-in uses simulated strong identification and stores only a
          pseudonymous code—never your name or personal identity number.
        </p>
      </header>

      {!session && safeReturnUrl(returnTo) ? (
        <p className="rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 px-4 py-3 text-sm text-ink-primary">
          Sign in below to continue to the page you opened.
        </p>
      ) : null}

      {session ? (
        <section
          aria-label="Active session"
          className="flex flex-col gap-4 rounded-2xl border border-accent-sage-border bg-accent-sage-soft p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ring-1 ring-border-tactile ${
                session.kind === "patient"
                  ? "bg-accent-sage text-white"
                  : "bg-surface-card text-ink-primary"
              }`}
            >
              {session.avatarInitials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-primary">
                {session.kind === "patient"
                  ? `Signed in as Participant ${session.participantCode}`
                  : `Signed in as ${session.displayName}`}
              </p>
              <p className="text-sm text-ink-secondary [overflow-wrap:anywhere]">
                {session.kind === "patient"
                  ? session.label
                  : `${session.email} · ${session.clinicName}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={session.kind === "patient" ? "/check-in" : "/clinic"}
              className="inline-flex min-h-11 items-center rounded-xl bg-accent-sage px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
            >
              {session.kind === "patient" ? "Open check-in" : "Open clinic view"}
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex min-h-11 items-center rounded-xl border border-border-tactile bg-surface-card px-4 py-2 text-sm font-medium text-ink-primary transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
            >
              Sign out
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border-hairline bg-surface-card p-4 sm:p-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-primary">
            Participant e-ID
          </h2>
          <PatientEidSignInPanel onSuccess={handleSuccess} />
        </section>

        <section className="rounded-2xl border border-border-hairline bg-surface-card p-4 sm:p-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-primary">
            Clinic staff
          </h2>
          <StaffSignInPanel onSuccess={handleSuccess} />
        </section>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
