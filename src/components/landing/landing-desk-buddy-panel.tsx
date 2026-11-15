"use client";

import Image from "next/image";
import { useState } from "react";

type DeskBuddyView = "resting" | "inside";

const VIEW_CONTENT: Record<
  DeskBuddyView,
  {
    src: string;
    alt: string;
    caption: string;
  }
> = {
  resting: {
    src: "/desk-buddy-resting.webp",
    alt: "Cepheus Desk Buddy enclosure with physical flip-up privacy visor closed over the camera lens",
    caption:
      "At rest, the mechanical visor physically blocks the Ø 62 mm USB camera lens.",
  },
  inside: {
    src: "/desk-buddy-inside.webp",
    alt: "Exploded CAD view of Cepheus Desk Buddy showing the Arduino UNO Q board, USB camera, and lifted privacy visor",
    caption:
      "Inside, the Arduino UNO Q runs local voice check-ins over Bluetooth headphones and on-device facial movement summary numbers—rejecting raw audio and video.",
  },
};

const CONSENTED_CHANNELS = [
  {
    title: "Twice-weekly taps & fortnightly PHQ-9 / GAD-7",
    detail:
      "20-second home check-in compared against the person’s own first weeks after TMS; individual questionnaire item answers stay in memory only.",
  },
  {
    title: "Sleep & daily rhythm (Smart ring · Health Connect · Fitbit)",
    detail:
      "Passive circadian stability and wear-time corroboration (including detecting silence while the ring is still worn), paired locally via QR or OAuth2 PKCE.",
  },
  {
    title: "20-second browser camera check (MediaPipe)",
    detail:
      "Runs locally in WebAssembly; stores only derived head-pose and facial-expressivity summary numbers, never images or video.",
  },
  {
    title: "Desk Buddy bedside companion (Arduino UNO Q)",
    detail:
      "Physical privacy visor and local spoken check-in for days when picking up a phone feels heavy.",
  },
] as const;

export function LandingDeskBuddyPanel() {
  const [view, setView] = useState<DeskBuddyView>("resting");
  const current = VIEW_CONTENT[view];

  return (
    <section
      aria-label="Desk Buddy hardware and consented home channels"
      className="space-y-8"
    >
      <div className="max-w-3xl space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink-primary sm:text-3xl">
          On-device sensing and the Desk Buddy bedside unit
        </h2>
        <p className="text-sm leading-relaxed text-ink-secondary sm:text-base">
          Every home channel is consented independently and processed on the
          device. Only derived summary numbers leave the home—never raw video,
          audio, or individual questionnaire answers.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        <div className="rounded-2xl border border-border-hairline bg-surface-card p-6 lg:col-span-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-ink-primary">
              Desk Buddy (Arduino UNO Q)
            </h3>
            <div
              className="inline-flex rounded-xl border border-border-hairline bg-surface-subtle p-1"
              role="group"
              aria-label="Desk Buddy hardware view"
            >
              <button
                type="button"
                onClick={() => setView("resting")}
                aria-pressed={view === "resting"}
                className={`min-h-11 rounded-lg px-3.5 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
                  view === "resting"
                    ? "bg-accent-sage text-white"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                Privacy visor closed
              </button>
              <button
                type="button"
                onClick={() => setView("inside")}
                aria-pressed={view === "inside"}
                className={`min-h-11 rounded-lg px-3.5 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
                  view === "inside"
                    ? "bg-accent-sage text-white"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                Inside hardware
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border-hairline bg-surface-subtle">
            <Image
              src={current.src}
              alt={current.alt}
              width={800}
              height={600}
              className="h-auto w-full object-cover"
            />
          </div>

          <p className="text-sm leading-relaxed text-ink-secondary">
            {current.caption}
          </p>
        </div>

        <div className="rounded-2xl border border-border-hairline bg-surface-card p-6 lg:col-span-6">
          <h3 className="font-display text-lg font-semibold text-ink-primary pb-4">
            Four independently consented home channels
          </h3>
          <dl className="divide-y divide-border-hairline">
            {CONSENTED_CHANNELS.map((channel) => (
              <div key={channel.title} className="py-4 first:pt-2 last:pb-1">
                <dt className="text-sm font-semibold text-ink-primary">
                  {channel.title}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink-secondary">
                  {channel.detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
