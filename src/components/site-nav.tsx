"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link
          href="/"
          className="group inline-flex min-h-11 items-center gap-2.5 rounded-lg text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cepheus-icon.png"
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-cover ring-1 ring-border-hairline transition group-hover:opacity-90"
          />
          <span className="font-display text-xl font-semibold tracking-tight">
            Cepheus
          </span>
        </Link>

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
