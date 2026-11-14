import crypto from "node:crypto";
import { getEnv } from "@/server/env";

/**
 * HTTP request security helpers (CSRF origin verification, bearer extraction,
 * and proxy-safe rate-limit bucket keying).
 */

export function verifySameOrigin(request: Request): boolean {
  const hostHeader =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!hostHeader) return false;

  const expectedHost = hostHeader.split(",")[0].trim().toLowerCase();
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");

  const candidate = originHeader ?? refererHeader;
  if (!candidate) {
    return false;
  }

  try {
    const parsed = new URL(candidate);
    return parsed.host.toLowerCase() === expectedHost;
  } catch {
    return false;
  }
}

export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match ? match[1].trim() : null;
}

/**
 * Derives a rate-limit key without blindly trusting spoofable `x-forwarded-for`.
 * Uses a hashed verified identity/token hint when present, or `x-forwarded-for`
 * ONLY when `TRUST_PROXY_HEADERS=true` is explicitly configured behind a proxy.
 */
export function getClientKey(
  request: Request,
  prefix: string,
  identityHint?: string | null
): string {
  if (identityHint && identityHint.trim().length > 0) {
    const digest = crypto
      .createHash("sha256")
      .update(identityHint.trim(), "utf8")
      .digest("hex")
      .slice(0, 16);
    return `${prefix}:id:${digest}`;
  }

  const trustProxy = getEnv().TRUST_PROXY_HEADERS;
  if (trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "";
    if (ip.length > 0) {
      return `${prefix}:ip:${ip}`;
    }
  }

  const realIp = trustProxy ? request.headers.get("x-real-ip")?.trim() : null;
  if (realIp) {
    return `${prefix}:ip:${realIp}`;
  }

  return `${prefix}:direct`;
}
