export interface SimulatedBadgeProps {
  subtitle?: string;
  className?: string;
}

export function SimulatedBadge({
  subtitle = "8-week post-TMS simulation",
  className = "",
}: SimulatedBadgeProps) {
  return (
    <div
      data-testid="simulated-badge"
      className={`inline-flex flex-wrap items-center gap-2 rounded-full border border-amber-300/80 bg-amber-50/90 px-3 py-1 text-xs text-amber-950 ${className}`.trim()}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold tracking-wide">
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full bg-amber-700"
        />
        Simulated data
      </span>
      {subtitle ? (
        <span className="text-amber-900/80">· {subtitle}</span>
      ) : null}
    </div>
  );
}
