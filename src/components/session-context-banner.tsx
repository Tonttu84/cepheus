"use client";

import { useAuth } from "@/components/auth-provider";

export function SessionContextPill({
  expectedRole,
}: {
  expectedRole: "patient" | "staff";
}) {
  const { session } = useAuth();

  if (!session) {
    return null;
  }

  const label =
    session.kind === "patient"
      ? `Session: Participant ${session.participantCode} (Simulated e-ID)`
      : `Session: ${session.displayName} · ${session.clinicName} (Simulated)`;

  return (
    <span
      data-testid="active-session-pill"
      data-expected-role={expectedRole}
      className="rounded-full border border-accent-sage-border bg-accent-sage-soft px-3 py-1 text-xs font-medium text-accent-sage"
    >
      {label}
    </span>
  );
}
