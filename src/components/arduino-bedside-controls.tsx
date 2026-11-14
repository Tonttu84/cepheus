"use client";

import { useState } from "react";

export function ArduinoBedsideControls({
  onFeedback,
}: {
  onFeedback: (msg: { kind: "ok" | "error"; text: string }) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleSimulateVoiceCheckIn() {
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/arduino/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "unoq-home-demo",
          date: today,
          isSimulated: true,
          kind: "taps",
          mood: 3,
          interest: 3,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        roundNumber?: number | null;
      };
      if (!res.ok || !json.ok) {
        onFeedback({
          kind: "error",
          text: json.error ?? "Bedside voice check-in failed.",
        });
      } else {
        onFeedback({
          kind: "ok",
          text: `Saved simulated UNO Q bedside voice check-in (round ${json.roundNumber ?? 1}, 0 bytes audio stored).`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      data-testid="arduino-simulate-voice"
      disabled={busy}
      onClick={handleSimulateVoiceCheckIn}
      className="min-h-11 cursor-pointer rounded-xl border border-border-tactile bg-surface-card px-4 py-2 text-xs font-semibold text-ink-primary transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-50"
    >
      {busy ? "Saving..." : "Simulate UNO Q voice check-in"}
    </button>
  );
}
