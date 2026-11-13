import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Overview", testId: "nav-overview" },
  { href: "/check-in", label: "Check-in", testId: "nav-check-in" },
  { href: "/camera", label: "Camera check", testId: "nav-camera" },
  { href: "/patient", label: "Patient view", testId: "nav-patient" },
  { href: "/clinic", label: "Clinic view", testId: "nav-clinic" },
] as const;

export function SiteNav() {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-stone-900 hover:text-stone-700"
          >
            Cepheus
          </Link>
          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
            Beyond the Clinic · Post-TMS Home Follow-Up
          </span>
        </div>

        <nav
          aria-label="Primary navigation"
          className="flex flex-wrap items-center gap-1.5 sm:gap-2"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
