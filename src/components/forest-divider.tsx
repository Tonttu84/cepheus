interface ForestDividerProps {
  variant?: "grove" | "treeline" | "clearing";
  label?: string;
}

export function ForestDivider({
  variant = "grove",
  label,
}: ForestDividerProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 sm:py-6">
      <div className="flex w-full items-center gap-4">
        <div className="h-px flex-1 border-t border-border-hairline" />

        <div className="shrink-0 text-accent-sage/85">
          {variant === "grove" && (
            <svg
              aria-hidden="true"
              width="160"
              height="44"
              viewBox="0 0 160 44"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Gentle rolling ground */}
              <path
                d="M8 38C36 35 60 36 80 37.5C102 39 128 36 152 38"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeOpacity="0.45"
              />

              {/* Left medium spruce */}
              <path
                d="M52 13L42 25H48L39 34H65L56 25H62L52 13Z"
                fill="currentColor"
                fillOpacity="0.12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M52 34V37"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />

              {/* Center tall spruce */}
              <path
                d="M80 6L69 19H75L66 28H73L64 36H96L87 28H94L85 19H91L80 6Z"
                fill="currentColor"
                fillOpacity="0.12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M80 36V39"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />

              {/* Right medium spruce */}
              <path
                d="M108 14L99 25H104.5L96 34H120L111.5 25H117L108 14Z"
                fill="currentColor"
                fillOpacity="0.12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M108 34V37"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          )}

          {variant === "treeline" && (
            <svg
              aria-hidden="true"
              width="220"
              height="48"
              viewBox="0 0 220 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Distant rolling hills */}
              <path
                d="M8 40C45 33 78 36 110 38C144 40 178 33 212 40"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeOpacity="0.35"
              />
              <path
                d="M20 42C60 39 100 41 140 40C170 39 190 40 206 42"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeOpacity="0.5"
              />

              {/* Far-left small pine */}
              <path
                d="M36 20L28 31H33L26 39H46L39 31H44L36 20Z"
                fill="currentColor"
                fillOpacity="0.09"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path
                d="M36 39V41"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />

              {/* Mid-left tall spruce */}
              <path
                d="M72 9L62 21H67.5L59 30H65.5L57 39H87L78.5 30H85L76.5 21H82L72 9Z"
                fill="currentColor"
                fillOpacity="0.13"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M72 39V42"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />

              {/* Center medium pine */}
              <path
                d="M110 15L101 26H106L98 36H122L114 26H119L110 15Z"
                fill="currentColor"
                fillOpacity="0.11"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M110 36V40"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />

              {/* Mid-right tall spruce */}
              <path
                d="M148 11L139 22H144L136 31H142L134 39H162L154 31H160L152 22H157L148 11Z"
                fill="currentColor"
                fillOpacity="0.13"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M148 39V42"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />

              {/* Far-right small pine */}
              <path
                d="M184 21L176 31H181L174 39H194L187 31H192L184 21Z"
                fill="currentColor"
                fillOpacity="0.09"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path
                d="M184 39V41"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          )}

          {variant === "clearing" && (
            <svg
              aria-hidden="true"
              width="160"
              height="44"
              viewBox="0 0 160 44"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Quiet open path / horizon */}
              <path
                d="M12 37C42 35 60 36 80 36C100 36 118 35 148 37"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeOpacity="0.45"
              />
              <path
                d="M68 38C74 35.5 86 35.5 92 38"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeOpacity="0.35"
              />

              {/* Left flanking pine */}
              <path
                d="M42 10L32 22H37.5L29 31H35L28 37H56L49 31H55L46.5 22H52L42 10Z"
                fill="currentColor"
                fillOpacity="0.12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M42 37V40"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />

              {/* Right flanking pine */}
              <path
                d="M118 11L108 23H113.5L105 31H111L104 37H132L125 31H131L122.5 23H128L118 11Z"
                fill="currentColor"
                fillOpacity="0.12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M118 37V40"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>

        <div className="h-px flex-1 border-t border-border-hairline" />
      </div>

      {label ? (
        <p className="font-display text-xs text-ink-muted">{label}</p>
      ) : null}
    </div>
  );
}

interface ForestCanopyArtworkProps {
  className?: string;
}

export function ForestCanopyArtwork({
  className = "",
}: ForestCanopyArtworkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 480 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-accent-sage ${className}`.trim()}
    >
      {/* Distant misty hills */}
      <path
        d="M0 92C70 68 140 76 210 86C290 97 375 66 480 88V120H0V92Z"
        fill="currentColor"
        fillOpacity="0.06"
      />
      <path
        d="M0 102C95 84 175 96 260 98C345 100 415 84 480 98V120H0V102Z"
        fill="currentColor"
        fillOpacity="0.09"
      />
      <path
        d="M0 92C70 68 140 76 210 86C290 97 375 66 480 88"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeOpacity="0.22"
      />

      {/* 1. Far-left background pine */}
      <path
        d="M36 44L22 68H30L18 88H54L42 68H50L36 44Z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.45"
        strokeLinejoin="round"
      />
      <path
        d="M36 88V100"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.45"
        strokeLinecap="round"
      />

      {/* 2. Left tall spruce */}
      <path
        d="M84 22L68 46H76L62 68H72L58 92H110L96 68H106L92 46H100L84 22Z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeOpacity="0.7"
        strokeLinejoin="round"
      />
      <path
        d="M84 92V105"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeOpacity="0.7"
        strokeLinecap="round"
      />

      {/* 3. Mid-left low pine */}
      <path
        d="M138 52L125 73H132L120 92H156L144 73H151L138 52Z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.5"
        strokeLinejoin="round"
      />
      <path
        d="M138 92V103"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.5"
        strokeLinecap="round"
      />

      {/* 4. Center-left tall spruce */}
      <path
        d="M196 16L179 42H187L172 66H182L168 94H224L210 66H220L205 42H213L196 16Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M196 94V108"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.8"
        strokeLinecap="round"
      />

      {/* 5. Center small distant pine */}
      <path
        d="M250 48L238 69H244L233 88H267L256 69H262L250 48Z"
        fill="currentColor"
        fillOpacity="0.07"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeOpacity="0.4"
        strokeLinejoin="round"
      />
      <path
        d="M250 88V99"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeOpacity="0.4"
        strokeLinecap="round"
      />

      {/* 6. Center-right medium spruce */}
      <path
        d="M304 30L289 53H296L283 74H292L279 95H329L316 74H325L312 53H319L304 30Z"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeOpacity="0.72"
        strokeLinejoin="round"
      />
      <path
        d="M304 95V106"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeOpacity="0.72"
        strokeLinecap="round"
      />

      {/* 7. Right tall pine */}
      <path
        d="M366 24L350 48H358L344 70H354L340 93H392L378 70H388L374 48H382L366 24Z"
        fill="currentColor"
        fillOpacity="0.13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeOpacity="0.65"
        strokeLinejoin="round"
      />
      <path
        d="M366 93V105"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeOpacity="0.65"
        strokeLinecap="round"
      />

      {/* 8. Far-right small spruce */}
      <path
        d="M428 46L415 68H422L410 89H446L434 68H441L428 46Z"
        fill="currentColor"
        fillOpacity="0.09"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.48"
        strokeLinejoin="round"
      />
      <path
        d="M428 89V101"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.48"
        strokeLinecap="round"
      />
    </svg>
  );
}
