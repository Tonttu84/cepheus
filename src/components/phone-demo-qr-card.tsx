"use client";

import { useMemo, useState } from "react";
import { encodeQrMatrix } from "@/domain/health-connect/qr";
import type { LanAddressOption } from "@/server/demo/lan-origin";

interface PhoneDemoQrCardProps {
  originOptions: LanAddressOption[];
}

const TARGET_PATHS = [
  { path: "/check-in", label: "Check-in (2-tap)" },
  { path: "/patient", label: "Patient suggestion" },
  { path: "/monitoring", label: "Home sensors" },
] as const;

function buildQrPathData(url: string): { viewSize: number; d: string } | null {
  try {
    const matrix = encodeQrMatrix(url);
    const size = matrix.length;
    const quiet = 4;
    const parts: string[] = [];
    for (let r = 0; r < size; r += 1) {
      const row = matrix[r];
      if (!row) continue;
      appendQrRowParts(row, r + quiet, quiet, parts);
    }
    return { viewSize: size + quiet * 2, d: parts.join("") };
  } catch {
    return null;
  }
}

function appendQrRowParts(
  row: readonly boolean[],
  y: number,
  quiet: number,
  parts: string[]
): void {
  for (let c = 0; c < row.length; c += 1) {
    if (row[c]) parts.push(`M${c + quiet},${y}h1v1h-1z`);
  }
}

function QrSvg({ url }: { url: string }) {
  const pathData = useMemo(() => buildQrPathData(url), [url]);

  if (!pathData) {
    return (
      <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-border-hairline bg-surface-subtle p-4 text-center text-xs text-ink-secondary">
        URL too long for QR code
      </div>
    );
  }

  return (
    <svg
      data-testid="phone-demo-qr-svg"
      role="img"
      aria-label={`QR code to open ${url} on a phone`}
      width={220}
      height={220}
      viewBox={`0 0 ${pathData.viewSize} ${pathData.viewSize}`}
      shapeRendering="crispEdges"
      className="rounded-xl border border-border-hairline bg-white"
    >
      <rect
        x={0}
        y={0}
        width={pathData.viewSize}
        height={pathData.viewSize}
        fill="#ffffff"
      />
      <path d={pathData.d} fill="#11241b" />
    </svg>
  );
}

function PhoneDemoInstructions({ isLoopback }: { isLoopback: boolean }) {
  return (
    <>
      {isLoopback ? (
        <p className="rounded-xl border border-amber-300/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-[#451a03]">
          A phone cannot reach <code>localhost</code>. Pick your Wi-Fi IP above
          or run <code>npm run dev:lan</code> so the server listens on the network.
        </p>
      ) : null}

      <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-ink-secondary">
        <li>
          Start the laptop server with <code>npm run dev:lan</code> on the same
          Wi-Fi as your phone.
        </li>
        <li>
          Scan the QR code with the phone camera and tap{" "}
          <strong>Post-TMS participant (P-SIM-001)</strong> to sign in.
        </li>
        <li>
          Note: browser camera and voice capture on <code>/camera</code> require
          HTTPS or <code>localhost</code> on mobile browsers;{" "}
          <code>/check-in</code> taps, typed answers, <code>/patient</code>, and{" "}
          <code>/monitoring</code> work over plain Wi-Fi HTTP.
        </li>
      </ol>
    </>
  );
}

function normalizeOriginInput(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

export function PhoneDemoQrCard({ originOptions }: PhoneDemoQrCardProps) {
  const preferred =
    originOptions.find((opt) => opt.isPreferred) ?? originOptions[0];
  const [selectedOrigin, setSelectedOrigin] = useState(
    preferred?.url ?? "http://localhost:3000"
  );
  const [customOrigin, setCustomOrigin] = useState("");
  const [targetPath, setTargetPath] = useState<string>("/check-in");
  const [copied, setCopied] = useState(false);

  const normalizedCustom = normalizeOriginInput(customOrigin);
  const effectiveOrigin = (normalizedCustom || selectedOrigin).replace(
    /\/+$/,
    ""
  );
  const phoneUrl = `${effectiveOrigin}/sign-in?returnTo=${encodeURIComponent(targetPath)}`;
  const isLoopback = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(effectiveOrigin);

  async function handleCopy() {
    try {
      await navigator.clipboard?.writeText(phoneUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      aria-label="Open patient app on phone"
      data-testid="phone-demo-qr-card"
      className="rounded-2xl border border-border-hairline bg-surface-card p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex shrink-0 flex-col items-center gap-3">
          <QrSvg url={phoneUrl} />
          <span className="text-xs font-medium text-ink-muted">
            Scan with phone camera
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-semibold text-ink-primary">
              Pair a phone on the same Wi-Fi
            </h2>
            <p className="text-sm leading-relaxed text-ink-secondary">
              Keep this laptop on <strong>Clinic view</strong> and scan this QR
              code with a phone to tap through the patient flow live against the
              same database.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="demo-lan-origin"
                className="block text-xs font-medium text-ink-secondary"
              >
                Detected network address
              </label>
              <select
                id="demo-lan-origin"
                data-testid="phone-demo-origin-select"
                value={selectedOrigin}
                onChange={(e) => {
                  setSelectedOrigin(e.target.value);
                  setCustomOrigin("");
                }}
                className="min-h-11 w-full rounded-xl border border-border-tactile bg-surface-card px-3 py-2 text-sm text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
              >
                {originOptions.map((opt) => (
                  <option key={opt.url} value={opt.url}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="demo-custom-origin"
                className="block text-xs font-medium text-ink-secondary"
              >
                Custom host / IP override (optional)
              </label>
              <input
                id="demo-custom-origin"
                data-testid="phone-demo-custom-origin"
                type="text"
                value={customOrigin}
                onChange={(e) => setCustomOrigin(e.target.value)}
                placeholder="192.168.1.42:3000 or http://..."
                className="min-h-11 w-full rounded-xl border border-border-tactile bg-surface-card px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-ink-secondary">
              Open after patient sign-in
            </span>
            <div className="flex flex-wrap gap-2">
              {TARGET_PATHS.map((item) => {
                const active = targetPath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    data-testid={`phone-demo-target-${item.path.slice(1)}`}
                    onClick={() => setTargetPath(item.path)}
                    className={`min-h-11 cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
                      active
                        ? "border-accent-sage bg-accent-sage text-white"
                        : "border-border-tactile bg-surface-subtle text-ink-primary hover:bg-surface-card"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-ink-secondary">
              Phone link encoded in QR
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <code
                data-testid="phone-demo-url"
                className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-border-hairline bg-surface-subtle px-3 py-2.5 text-xs text-ink-primary"
              >
                {phoneUrl}
              </code>
              <button
                type="button"
                data-testid="phone-demo-copy-btn"
                onClick={() => void handleCopy()}
                className="min-h-11 shrink-0 cursor-pointer rounded-xl border border-border-tactile bg-surface-card px-4 py-2 text-xs font-semibold text-ink-primary transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>

          <PhoneDemoInstructions isLoopback={isLoopback} />
        </div>
      </div>
    </section>
  );
}
