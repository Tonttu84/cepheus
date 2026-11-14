"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderAuthControl } from "@/components/header-auth-control";

const NAV_ITEMS = [
  { href: "/", label: "Overview", testId: "nav-overview" },
  { href: "/check-in", label: "Check-in", testId: "nav-check-in" },
  { href: "/camera", label: "Camera check", testId: "nav-camera" },
  { href: "/monitoring", label: "Home sensors", testId: "nav-monitoring" },
  { href: "/patient", label: "Patient view", testId: "nav-patient" },
  { href: "/clinic", label: "Clinic view", testId: "nav-clinic" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border-hairline bg-surface-card/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="group inline-flex min-h-11 items-center gap-2.5 rounded-lg text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-sage text-white transition group-hover:bg-accent-sage-hover"
          >
            {/* Minimal Cepheus constellation house-pentagon mark */}
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 4L5.5 10.5L7.5 19H16.5L18.5 10.5L12 4Z" />
              <circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="5.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
              <circle cx="18.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
              <circle cx="7.5" cy="19" r="1.1" fill="currentColor" stroke="none" />
              <circle cx="16.5" cy="19" r="1.1" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Cepheus
          </span>
        </Link>

        <HeaderAuthControl />

        <nav
          aria-label="Primary navigation"
          className="flex flex-wrap items-center gap-1 rounded-xl border border-border-hairline bg-surface-subtle p-1"
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={item.testId}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
                  isActive
                    ? "bg-accent-sage text-white"
                    : "text-ink-secondary hover:bg-surface-card hover:text-ink-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
