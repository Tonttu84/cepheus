import { requirePatientPageSession } from "@/server/auth";
import { getRouteDeps } from "@/server/api";
import { getPatientSuggestion, getPatientConsent } from "@/usecases";
import { readAccount } from "@/usecases/rewards";
import Link from "next/link";
import { SimulatedBadge } from "@/components/simulated-badge";
import { SessionContextPill } from "@/components/session-context-banner";
import { PatientSuggestionCard } from "@/components/patient-suggestion-card";
import { PatientConsentSection } from "@/components/patient-consent-section";
import {
  ForestCanopyArtwork,
  ForestDivider,
} from "@/components/forest-divider";

export default async function PatientPage() {
  const session = await requirePatientPageSession();
  const { ports } = getRouteDeps();

  const suggestionRes = await getPatientSuggestion(
    session.actor,
    { patientId: session.actor.patientId },
    ports
  );
  const suggestion = suggestionRes.ok ? suggestionRes.value.suggestion : null;

  const consentRes = await getPatientConsent(
    session.actor,
    { patientId: session.actor.patientId },
    ports
  );
  const consent = consentRes.ok
    ? consentRes.value.consent
    : {
        taking_part: true,
        methods: { ring: true, camera: false },
        rule_check: true,
      };

  const rewardsPorts = getRouteDeps().rewardsPorts;
  const accountRes = await readAccount(
    session.actor,
    { patientId: session.actor.patientId },
    rewardsPorts
  );
  const account = accountRes.ok ? accountRes.value : null;

  return (
    <div className="space-y-12 sm:space-y-16">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle={`${session.participantCode ?? "Patient"} · gentle check-in view`} />
          <SessionContextPill expectedRole="patient" />
        </div>
        <ForestCanopyArtwork className="h-40 w-full" />
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">
            Gentle steps between check-ins
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-ink-secondary">
            Low-effort actions suggested only when check-ins dip or for gentle
            practice. Each step is completely optional. If you prefer to rest
            today, skipping is a normal answer.
          </p>
        </div>
      </header>

      <PatientSuggestionCard
        suggestion={suggestion}
        actionKey={suggestion?.actionKey}
      />

      {account ? (
        <p className="text-sm text-ink-secondary text-center">
          Simulated balance: {(account.balanceCents / 100).toFixed(2)} € ·{" "}
          <Link
            href="/rewards"
            className="inline-flex min-h-11 items-center px-1 text-accent-sage hover:underline"
          >
            See rewards
          </Link>
        </p>
      ) : null}

      <ForestDivider variant="grove" />

      <PatientConsentSection initialConsent={consent} />

      <p className="border-t border-border-hairline pt-6 text-sm leading-relaxed text-ink-secondary">
        Skipping a suggestion or a check-in is always fine, and nothing is
        counted against you. If you want to talk with someone directly, the TMS
        clinic nurse line and 24/7 crisis support are at the top of this screen.
      </p>
    </div>
  );
}
