import React from "react";
import { requirePatientPageSession } from "@/server/auth";
import { getRouteDeps } from "@/server/api";
import { readTodayTask, readAccount, readPreferences } from "@/usecases/rewards";
import { getRewardsSettings } from "@/server/api/rewards-settings";
import { TodayTaskCard, PreferencesForm, PayoutSection } from "@/components/rewards/client";
import { MeadowArtwork } from "@/components/rewards/art";
import { TASK_LIST } from "@/domain/small-tasks/catalogue";
import type { RewardLedgerEntry } from "@/domain/rewards/types";
import { formatCentsToEuros } from "@/components/rewards/helpers";
import Link from "next/link";
import { SimulatedBadge } from "@/components/simulated-badge";
import { ForestCanopyArtwork, ForestDivider } from "@/components/forest-divider";

export default async function RewardsPage() {
  const session = await requirePatientPageSession();
  const actor = { ...session.actor, clinicId: session.actor.clinicId };
  
  const settings = getRewardsSettings();
  if (!settings.rewardsEnabled) {
    return (
      <main className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
        <p className="text-base leading-relaxed text-ink-secondary">
          This part of the check-in system is currently switched off.
        </p>
      </main>
    );
  }

  const { rewardsPorts } = getRouteDeps();
  
  const [taskRes, accountRes, prefsRes] = await Promise.all([
    readTodayTask(actor, { patientId: actor.patientId }, rewardsPorts),
    readAccount(actor, { patientId: actor.patientId }, rewardsPorts),
    readPreferences(actor, { patientId: actor.patientId }, rewardsPorts),
  ]);

  if (!accountRes.ok || !prefsRes.ok) {
    return <div>Loading...</div>;
  }

  const todayTask = taskRes.ok ? taskRes.value : null;
  const account = accountRes.value;
  const preferences = prefsRes.value;

  const showCounts = settings.countersEnabled;
  const walksCount = account.counts.walks ?? 0;
  const totalElements = account.counts.roundsAnswered + walksCount;

  return (
    <div className="space-y-12 sm:space-y-16 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Rewards view" />
          <Link
            href="/patient"
            aria-label="Back to Check-in"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full border border-border-hairline bg-surface-subtle px-4 py-2 text-xs font-medium text-ink-secondary hover:bg-surface-muted transition"
          >
            Back to Check-in
          </Link>
        </div>

        <div className="max-w-3xl space-y-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">
            Rewards and Small Tasks
          </h1>
          <p className="text-base leading-relaxed text-ink-secondary">
            A small reward is offered for completing your check-ins and small tasks. This tracks your balance.
          </p>
        </div>

        <ForestCanopyArtwork className="w-full pt-2 text-accent-sage" />
      </header>

      {/* 1. Today's small task */}
      <TodayTaskCard
        task={todayTask?.task}
        status={todayTask?.status}
        reason={todayTask?.reason}
        alreadyRewardedToday={todayTask?.alreadyRewardedToday}
      />

      <ForestDivider variant="grove" />

      {/* 2. Preferences */}
      <PreferencesForm
        allTasks={[...TASK_LIST]}
        initialPreferred={[...preferences.preferredTaskKeys]}
      />

      <ForestDivider variant="grove" />

      {/* 3. My balance */}
      <section aria-label="My balance">
        <h3 className="font-display text-xl font-semibold tracking-tight text-ink-primary mb-4">
          My balance
        </h3>
        <div className="flex flex-wrap items-baseline gap-3 mb-2">
          <div className="text-3xl font-semibold text-ink-primary">
            {formatCentsToEuros(account.balanceCents)}{" "}
            <span className="text-sm font-normal text-ink-secondary bg-surface-subtle px-2 py-0.5 rounded ml-2 border border-border-hairline align-middle inline-block">
              simulated
            </span>
          </div>
        </div>
        <p className="text-sm text-ink-secondary mb-4">
          Amounts and payouts are simulated in this demonstration and no real money is paid.
        </p>

        {account.entries.length > 0 && (
          <div className="space-y-2 mb-6">
            <h4 className="text-sm font-medium text-ink-secondary">Latest entries</h4>
            <ul className="space-y-2">
              {account.entries.slice(-5).reverse().map((entry: RewardLedgerEntry) => (
                <li key={entry.id} className="flex justify-between items-center text-sm border-b border-border-hairline pb-2">
                  <span className="text-ink-secondary">{entry.localDate || new Date(entry.createdAt).toISOString().split('T')[0]}</span>
                  <span className="text-ink-primary flex-1 px-4">
                    {entry.kind === 'answered_round' ? 'Answered round' : entry.kind === 'small_task' ? 'Small task' : 'Payout'}
                  </span>
                  <span className="font-medium text-ink-primary whitespace-nowrap">
                    {formatCentsToEuros(entry.amountCents)} <span className="text-xs font-normal text-ink-secondary ml-1 bg-surface-subtle px-1 rounded border border-border-hairline inline-block align-text-bottom">simulated</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <PayoutSection
          balanceCents={account.balanceCents}
          payoutThresholdCents={account.payoutThresholdCents}
          payoutAvailable={account.payoutAvailable}
        />
      </section>

      {/* 4. My picture */}
      {showCounts && (
        <>
          <ForestDivider variant="grove" />
          <section aria-label="My picture">
            <h3 className="font-display text-xl font-semibold tracking-tight text-ink-primary mb-4">
              My picture
            </h3>
            <div className="flex flex-col sm:flex-row gap-8 items-start">
              <div className="w-full sm:w-1/2 bg-surface-card border border-accent-sage-border rounded-xl overflow-hidden p-4">
                <MeadowArtwork
                  count={totalElements}
                  roundsAnswered={account.counts.roundsAnswered}
                  walks={walksCount}
                />
                <div className="sr-only">
                  Picture with {account.counts.roundsAnswered} rounds answered and {walksCount} walks.
                </div>
              </div>
              <div className="flex flex-col gap-4 w-full sm:w-1/2">
                <div className="bg-surface-subtle border border-border-hairline rounded-lg p-4">
                  <div className="text-2xl font-semibold text-ink-primary">{account.counts.roundsAnswered}</div>
                  <div className="text-sm text-ink-secondary">rounds answered</div>
                </div>
                <div className="bg-surface-subtle border border-border-hairline rounded-lg p-4">
                  <div className="text-2xl font-semibold text-ink-primary">{walksCount}</div>
                  <div className="text-sm text-ink-secondary">walks</div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}