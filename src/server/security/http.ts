/**
 * HTTP request security helpers (CSRF origin verification & bearer extraction).
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

export function getClientKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "local";
  return `${prefix}:${ip}`;
}
