"use client";

import { useEffect, useState } from "react";
import { type BroadAreaKey } from "@/lib/constants";
import { ClinicNurseBriefPanel } from "@/components/clinic-nurse-brief-panel";
import { ClinicFlagCard } from "@/components/clinic-flag-card";

interface FlagItem {
  patientId: string;
  area: string;
  since: string;
  raisedAt: string;
}

export function ClinicFlagsView() {
  const [flags, setFlags] = useState<FlagItem[] | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/clinic/flags", {
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        if (!mounted) return;
        if (res.status === 401) {
          setAuthRequired(true);
          return;
        }
        if (!res.ok) {
          setErrorText("Could not load clinic flags.");
          return;
        }
        const data = await res.json();
        if (data.ok && Array.isArray(data.flags)) {
          setFlags(data.flags);
        } else {
          setFlags([]);
        }
      })
      .catch(() => {
        if (mounted) setErrorText("Network error loading clinic flags.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      {authRequired ? (
        <div
          role="status"
          className="rounded-2xl border border-border-hairline bg-surface-subtle p-6 text-sm text-ink-secondary"
        >
          Please{" "}
          <a
            href="/sign-in"
            className="font-semibold text-ink-primary underline hover:text-accent-sage"
          >
            sign in
          </a>{" "}
          to continue.
        </div>
      ) : null}

      {errorText ? (
        <div
          role="status"
          className="rounded-2xl border border-amber-300/80 bg-amber-50/70 p-6 text-sm text-amber-950 font-medium"
        >
          {errorText}
        </div>
      ) : null}

      {!authRequired && !errorText && flags !== null && flags.length === 0 ? (
        <div
          role="status"
          data-testid="no-flags"
          className="rounded-2xl border border-border-hairline bg-surface-card p-6 text-sm text-ink-secondary"
        >
          No open follow-up flags.
        </div>
      ) : null}

      {!authRequired && flags && flags.length > 0 ? (
        <div className="space-y-6">
          {flags.map((flag) => (
            <ClinicFlagCard
              key={`${flag.patientId}-${flag.raisedAt}`}
              participantLabel={`Participant ${flag.patientId}`}
              participantExternalId={flag.patientId}
              tmsCompletedDate="Recent"
              sinceDate={flag.since}
              broadAreas={[flag.area as BroadAreaKey]}
              ringActiveDuringSilence={false}
            />
          ))}

          <ClinicNurseBriefPanel
            participantCode={flags[0].patientId}
            sinceDate={flags[0].since}
            broadAreas={[flags[0].area]}
            ringActiveDuringSilence={false}
          />
        </div>
      ) : null}
    </>
  );
}
