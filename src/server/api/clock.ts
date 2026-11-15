import type { Clock } from "@/usecases/ports";
import { isDemoEnabled } from "./settings";

const MS_PER_DAY = 86_400_000;

let demoOffsetMs = 0;

export interface AdvanceDemoTimeResultSuccess {
  readonly ok: true;
  readonly offsetMs: number;
  readonly offsetDays: number;
  readonly now: string;
}

export interface AdvanceDemoTimeResultFailure {
  readonly ok: false;
  readonly error: string;
}

export type AdvanceDemoTimeResult =
  | AdvanceDemoTimeResultSuccess
  | AdvanceDemoTimeResultFailure;

export function getDemoOffsetMs(): number {
  return demoOffsetMs;
}

export function getDemoOffsetDays(): number {
  return Math.floor(demoOffsetMs / MS_PER_DAY);
}

export function resetDemoClock(): void {
  demoOffsetMs = 0;
}

export function advanceDemoTime(days: number): AdvanceDemoTimeResult {
  if (!isDemoEnabled()) {
    return { ok: false, error: "Demo mode is disabled; clock offset cannot be changed." };
  }

  if (typeof days !== "number" || !Number.isInteger(days) || days <= 0) {
    return { ok: false, error: "Days to advance must be a positive integer (offset can only grow)." };
  }

  demoOffsetMs += days * MS_PER_DAY;

  return {
    ok: true,
    offsetMs: demoOffsetMs,
    offsetDays: getDemoOffsetDays(),
    now: getDemoClock().now(),
  };
}

class DemoClockProvider implements Clock {
  now(): string {
    if (!isDemoEnabled()) {
      return new Date().toISOString();
    }
    return new Date(Date.now() + demoOffsetMs).toISOString();
  }
}

const singletonClock = new DemoClockProvider();

export function getDemoClock(): Clock {
  return singletonClock;
}
