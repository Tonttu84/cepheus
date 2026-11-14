export type LifeDashboardSource = "health_connect" | "screen_time";

export interface LifeDashboardPairingParams {
  readonly webhookUrl: string;
  readonly secret: string;
  readonly name?: string;
  readonly sources?: readonly LifeDashboardSource[];
}

export interface HcWebhookAuthHeaders {
  readonly bearerHeader: string;
  readonly apiKeyHeader: string;
}

/**
 * Builds a `lifedashboard://pair#...` deep-link URI for 1-tap / 1-scan pairing
 * with the Life Dashboard Companion Android app.
 *
 * Uses `encodeURIComponent` (not `URLSearchParams`) so spaces encode as `%20`
 * and commas encode as `%2C`. Never emits third-party `github.io` URLs.
 */
export function buildLifeDashboardPairingUri(params: LifeDashboardPairingParams): string {
  const parts: string[] = [
    "v=1",
    `url=${encodeURIComponent(params.webhookUrl)}`,
    `secret=${encodeURIComponent(params.secret)}`,
  ];

  const name = params.name === undefined ? "Cepheus" : params.name;
  if (name.length > 0) {
    parts.push(`name=${encodeURIComponent(name)}`);
  }

  const sources =
    params.sources && params.sources.length > 0
      ? params.sources
      : (["health_connect"] as const);
  parts.push(`sources=${encodeURIComponent(sources.join(","))}`);

  return `lifedashboard://pair#${parts.join("&")}`;
}

export function buildHcWebhookAuthHeaders(secret: string): HcWebhookAuthHeaders {
  return {
    bearerHeader: `Authorization: Bearer ${secret}`,
    apiKeyHeader: `X-API-Key: ${secret}`,
  };
}
