import Link from "next/link";
import React from "react";
import { PRIVACY_PAGE_DATA } from "./privacy-page-data";

export function PrivacyContent() {
  const { demonstrationNotice, hero, sections, footerNote } = PRIVACY_PAGE_DATA;

  return (
    <article
      data-testid="privacy-page"
      className="mx-auto w-full max-w-3xl space-y-8 px-1 sm:px-0"
    >
      {/* Prominent Demonstration Notice */}
      <aside
        data-testid="demonstration-notice"
        role="note"
        aria-label="Demonstration notice"
        className="rounded-2xl border-2 border-[#b45309] bg-[#fffbeb] p-4 text-sm font-medium leading-relaxed text-[#78350f] shadow-xs sm:p-5"
      >
        <p className="flex items-start gap-2.5">
          <span aria-hidden="true" className="shrink-0 text-base">
            ⚠️
          </span>
          <span>{demonstrationNotice}</span>
        </p>
      </aside>

      {/* Header / Hero */}
      <header className="space-y-3 pt-2">
        <span
          data-testid="simulated-badge"
          className="inline-block rounded-full border border-border-tactile bg-surface-subtle px-3 py-1 text-xs font-semibold tracking-wide text-ink-secondary"
        >
          {hero.badge}
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">
          {hero.title}
        </h1>
        <p className="text-base leading-relaxed text-ink-secondary">
          {hero.description}
        </p>
      </header>

      {/* Core Summary Sections */}
      <div className="space-y-6">
        {sections.map((section, sectionIdx) => (
          <section
            key={section.id}
            id={section.id}
            data-testid={`privacy-section-${section.id}`}
            aria-labelledby={`heading-${section.id}`}
            className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-xs sm:p-8"
          >
            <div className="space-y-2">
              <span className="font-mono text-xs font-semibold tracking-wider text-accent-sage uppercase">
                Section 0{sectionIdx + 1}
              </span>
              <h2
                id={`heading-${section.id}`}
                className="font-display text-2xl font-semibold text-ink-primary"
              >
                {section.title}
              </h2>
              <p className="text-sm leading-relaxed text-ink-secondary">
                {section.summary}
              </p>
            </div>

            <ul
              role="list"
              className="mt-6 divide-y divide-border-hairline/60 border-t border-border-hairline/60 text-sm leading-relaxed"
            >
              {section.facts.map((fact) => (
                <li key={fact.label} className="py-3.5 first:pt-4 last:pb-1">
                  <span className="block font-semibold text-ink-primary">
                    {fact.label}
                  </span>
                  <span className="mt-1 block text-ink-secondary">
                    {fact.detail}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Actions & Navigation (at least 44px touch targets) */}
      <footer className="space-y-6 border-t border-border-hairline pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-accent-sage px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
          >
            ← Return to Overview
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border-tactile bg-surface-card px-5 py-2.5 text-sm font-medium text-ink-primary transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
          >
            Sign in to Cepheus
          </Link>
        </div>
        <p className="text-sm leading-relaxed text-ink-muted">{footerNote}</p>
      </footer>
    </article>
  );
}
