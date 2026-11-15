"use client";

import { useEffect, useState } from "react";
import { type BroadAreaKey } from "@/lib/constants";
import { ClinicNurseBriefPanel } from "@/components/clinic-nurse-brief-panel";
import { ClinicFlagCard, type RequestedCallInfo } from "@/components/clinic-flag-card";

interface FlagItem {
  patientId: string;
  area: string;
  since: string;
  raisedAt: string;
}

interface NurseCallApiItem {
  id: string;
  patientId: string;
  status: string;
  requestedAt: string;
  staffUserId: string | null;
}

export function ClinicFlagsView() {
  const [flags, setFlags] = useState<FlagItem[] | null>(null);
  const [nurseCalls, setNurseCalls] = useState<Record<string, RequestedCallInfo>>({});
  const [selectedFlagIndex, setSelectedFlagIndex] = useState(0);
  const [authRequired, setAuthRequired] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Fetch flags
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

    // Fetch existing nurse call records to preserve state across reloads
    fetch("/api/clinic/nurse-calls", {
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        if (!mounted || !res.ok) return;
        const data = (await res.json()) as { ok: boolean; nurseCalls?: NurseCallApiItem[] };
        if (data.ok && Array.isArray(data.nurseCalls)) {
          const map: Record<string, RequestedCallInfo> = {};
          for (const call of data.nurseCalls) {
            if (call.status === "requested") {
              map[call.patientId] = {
                requestedBy: call.staffUserId ?? "Staff",
                requestedAt: call.requestedAt,
              };
            }
          }
          setNurseCalls(map);
        }
      })
      .catch(() => {
        // Non-blocking for flags rendering
      });

    return () => {
      mounted = false;
    };
  }, []);

  const activeFlag = flags && flags.length > 0 ? flags[selectedFlagIndex] ?? flags[0] : null;

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
          {flags.map((flag, index) => (
            <div key={`${flag.patientId}-${flag.raisedAt}`} className="space-y-3">
              <ClinicFlagCard
                participantLabel={`Participant ${flag.patientId}`}
                participantExternalId={flag.patientId}
                tmsCompletedDate="Recent"
                sinceDate={flag.since}
                broadAreas={[flag.area as BroadAreaKey]}
                ringActiveDuringSilence={false}
                initialRequestedCall={nurseCalls[flag.patientId] ?? null}
                onCallRequested={(info) =>
                  setNurseCalls((prev) => ({ ...prev, [flag.patientId]: info }))
                }
              />
              {flags.length > 1 && selectedFlagIndex !== index ? (
                <div className="flex justify-end px-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFlagIndex(index)}
                    className="text-xs font-semibold text-accent-sage hover:underline cursor-pointer"
                  >
                    Select this flag for nurse brief ↓
                  </button>
                </div>
              ) : null}
            </div>
          ))}

          {activeFlag ? (
            <ClinicNurseBriefPanel
              participantCode={activeFlag.patientId}
              sinceDate={activeFlag.since}
              broadAreas={[activeFlag.area]}
              ringActiveDuringSilence={false}
              triggerKind="silence"
              metrics={[
                { label: "Unanswered rounds", valueText: "2" },
                { label: "Sleep regularity shift", valueText: "-18%" },
              ]}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
