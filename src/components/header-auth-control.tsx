"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  PatientEidSignInPanel,
  StaffSignInPanel,
} from "@/components/auth-forms";
import { useAuth } from "@/components/auth-provider";
import type { AuthSession } from "@/lib/auth-types";

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function UnsignedPopover({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"patient" | "staff">("patient");

  return (
    <div
      role="dialog"
      aria-label="Sign in to Cepheus"
      data-testid="header-auth-popover"
      className="absolute left-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border-tactile bg-surface-card p-4 shadow-sm sm:left-1/2 sm:-translate-x-1/2"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-primary">
          Sign in to Cepheus
        </span>
        <span className="rounded-full border border-[#fcd34d] bg-[#fffbeb] px-2 py-0.5 text-[11px] font-medium text-[#451a03]">
          Simulated
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-border-hairline bg-surface-subtle p-1">
        <button
          type="button"
          data-testid="auth-tab-patient"
          onClick={() => setTab("patient")}
          className={`min-h-9 rounded-lg px-2 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
            tab === "patient"
              ? "bg-accent-sage text-white"
              : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          Participant e-ID
        </button>
        <button
          type="button"
          data-testid="auth-tab-staff"
          onClick={() => setTab("staff")}
          className={`min-h-9 rounded-lg px-2 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
            tab === "staff"
              ? "bg-accent-sage text-white"
              : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          Clinic staff
        </button>
      </div>

      {tab === "patient" ? (
        <PatientEidSignInPanel onSuccess={onClose} />
      ) : (
        <StaffSignInPanel onSuccess={onClose} />
      )}

      <div className="mt-3 border-t border-border-hairline pt-2.5 text-center">
        <Link
          href="/sign-in"
          data-testid="auth-open-signin-page"
          onClick={onClose}
          className="inline-flex min-h-9 items-center text-xs font-medium text-accent-sage hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
        >
          Full sign-in page →
        </Link>
      </div>
    </div>
  );
}

function SignedInMenu({
  session,
  onSignOut,
  onClose,
}: {
  session: AuthSession;
  onSignOut: () => Promise<void>;
  onClose: () => void;
}) {
  const isPatient = session.kind === "patient";

  return (
    <div
      role="menu"
      aria-label="Account menu"
      data-testid="header-user-menu"
      className="absolute left-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border-tactile bg-surface-card p-4 shadow-sm sm:left-1/2 sm:-translate-x-1/2"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ring-1 ring-border-tactile ${
            isPatient
              ? "bg-accent-sage text-white"
              : "bg-accent-sage-soft text-ink-primary"
          }`}
        >
          {session.avatarInitials}
        </span>
        <div className="min-w-0 flex-1">
          {isPatient ? (
            <>
              <p className="truncate text-sm font-semibold text-ink-primary">
                Participant {session.participantCode}
              </p>
              <p className="truncate text-xs text-ink-secondary">
                {session.label}
              </p>
            </>
          ) : (
            <>
              <p className="truncate text-sm font-semibold text-ink-primary">
                {session.displayName}
              </p>
              <p className="truncate text-xs text-ink-secondary">
                {session.email}
              </p>
              <p className="truncate text-xs text-ink-muted">
                {session.clinicName}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-3">
        <span className="inline-block rounded-full border border-[#fcd34d] bg-[#fffbeb] px-2.5 py-0.5 text-[11px] font-medium text-[#451a03]">
          Simulated session
        </span>
      </div>

      <div className="mt-3 space-y-1 border-t border-border-hairline pt-2.5">
        {isPatient ? (
          <>
            <Link
              href="/check-in"
              role="menuitem"
              onClick={onClose}
              className="flex min-h-10 items-center rounded-lg px-2.5 text-sm text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary"
            >
              Check-in
            </Link>
            <Link
              href="/patient"
              role="menuitem"
              onClick={onClose}
              className="flex min-h-10 items-center rounded-lg px-2.5 text-sm text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary"
            >
              Patient view
            </Link>
          </>
        ) : (
          <Link
            href="/clinic"
            role="menuitem"
            onClick={onClose}
            className="flex min-h-10 items-center rounded-lg px-2.5 text-sm text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary"
          >
            Clinic view
          </Link>
        )}
        <Link
          href="/sign-in"
          role="menuitem"
          onClick={onClose}
          className="flex min-h-10 items-center rounded-lg px-2.5 text-sm text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary"
        >
          Switch account
        </Link>
      </div>

      <div className="mt-2 border-t border-border-hairline pt-2.5">
        <button
          type="button"
          role="menuitem"
          data-testid="header-sign-out-button"
          onClick={() => {
            void onSignOut().then(onClose);
          }}
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-border-tactile bg-surface-subtle px-3 py-2 text-sm font-medium text-ink-primary transition hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function HeaderAuthControl() {
  const { session, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex items-center">
      {session ? (
        <button
          type="button"
          data-testid="header-user-avatar-button"
          aria-label={`Account menu (${session.avatarInitials})`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ring-1 ring-border-tactile transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
            session.kind === "patient"
              ? "bg-accent-sage text-white hover:bg-accent-sage-hover"
              : "bg-accent-sage-soft text-ink-primary hover:bg-surface-subtle"
          }`}
        >
          {session.avatarInitials}
        </button>
      ) : (
        <button
          type="button"
          data-testid="header-sign-in-button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-tactile bg-surface-subtle px-4 py-2 text-sm font-medium text-ink-primary transition hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
        >
          <UserIcon />
          <span>Sign in</span>
        </button>
      )}

      {open && !session ? (
        <UnsignedPopover onClose={() => setOpen(false)} />
      ) : null}

      {open && session ? (
        <SignedInMenu
          session={session}
          onSignOut={signOut}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
