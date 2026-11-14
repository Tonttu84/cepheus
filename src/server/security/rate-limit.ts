/**
 * In-memory sliding-window rate limiter for ingestion & OAuth endpoints.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
  nowMs: number = Date.now()
): RateLimitResult {
  const cutoff = nowMs - windowMs;
  const existing = buckets.get(key) ?? { timestamps: [] };
  const active = existing.timestamps.filter((t) => t > cutoff);

  if (active.length >= maxRequests) {
    const oldest = active[0] ?? nowMs;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    buckets.set(key, { timestamps: active });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  active.push(nowMs);
  buckets.set(key, { timestamps: active });

  // Prevent unbounded map growth
  if (buckets.size > 2000) {
    for (const [k, b] of buckets.entries()) {
      if (b.timestamps.every((t) => t <= cutoff)) {
        buckets.delete(k);
      }
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - active.length),
    retryAfterSec: 0,
  };
}

export function _resetRateLimits(): void {
  buckets.clear();
}
