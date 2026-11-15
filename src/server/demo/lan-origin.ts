import os from "node:os";

export interface LanAddressOption {
  address: string;
  interfaceName: string;
  url: string;
  label: string;
  isPreferred: boolean;
}

const VIRTUAL_IFACE_PATTERN =
  /vethernet|wsl|hyper-v|vmware|virtualbox|vbox|docker|br-|virbr|tailscale|wireguard|tun|tap|loopback/i;

const PHYSICAL_LAN_IFACE_PATTERN =
  /wi-?fi|wlan|wlp|en0|en1|eth|ethernet|enp/i;

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((segment) => Number(segment));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function extractHostname(hostOrOrigin: string): string {
  const trimmed = hostOrOrigin.trim().toLowerCase();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  try {
    return new URL(`http://${trimmed}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isPrivateLanHostname(hostOrOrigin: string): boolean {
  const host = extractHostname(hostOrOrigin);
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    return true;
  }
  if (host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }
  return isPrivateIpv4(host);
}

function rankInterface(interfaceName: string, address: string): number {
  let score = 0;
  if (PHYSICAL_LAN_IFACE_PATTERN.test(interfaceName)) score += 20;
  if (!VIRTUAL_IFACE_PATTERN.test(interfaceName)) score += 10;
  if (address.startsWith("192.168.")) score += 6;
  else if (address.startsWith("10.")) score += 4;
  return score;
}

export function detectLanIpv4Addresses(
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces()
): Array<{ address: string; interfaceName: string; score: number }> {
  const found = new Map<string, { address: string; interfaceName: string; score: number }>();

  for (const [interfaceName, entries] of Object.entries(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (entry.address.startsWith("169.254.")) continue;
      if (!isPrivateIpv4(entry.address)) continue;

      const score = rankInterface(interfaceName, entry.address);
      const existing = found.get(entry.address);
      if (!existing || score > existing.score) {
        found.set(entry.address, { address: entry.address, interfaceName, score });
      }
    }
  }

  return Array.from(found.values()).sort((a, b) => b.score - a.score);
}

export function buildPhoneDemoOriginOptions(params: {
  requestHost?: string | null;
  protocol?: "http" | "https";
  port?: number;
  interfaces?: NodeJS.Dict<os.NetworkInterfaceInfo[]>;
}): LanAddressOption[] {
  const protocol = params.protocol ?? "http";
  const defaultPort = params.port ?? 3000;
  const options: LanAddressOption[] = [];
  const seenUrls = new Set<string>();

  const reqHost = params.requestHost?.trim() ?? "";
  const reqHostname = extractHostname(reqHost);
  if (reqHost && reqHostname && reqHostname !== "localhost" && reqHostname !== "127.0.0.1") {
    const url = `${protocol}://${reqHost}`;
    seenUrls.add(url);
    options.push({
      address: reqHostname,
      interfaceName: "current-host",
      url,
      label: `Current address (${reqHost})`,
      isPreferred: true,
    });
  }

  const lanIps = detectLanIpv4Addresses(params.interfaces);
  for (const [idx, item] of lanIps.entries()) {
    const hostPort = `${item.address}:${defaultPort}`;
    const url = `${protocol}://${hostPort}`;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    options.push({
      address: item.address,
      interfaceName: item.interfaceName,
      url,
      label: `${item.interfaceName} (${hostPort})`,
      isPreferred: options.length === 0 && idx === 0,
    });
  }

  if (options.length === 0) {
    const fallbackHost = reqHost || `localhost:${defaultPort}`;
    options.push({
      address: reqHostname || "localhost",
      interfaceName: "loopback",
      url: `${protocol}://${fallbackHost}`,
      label: `Localhost (${fallbackHost}) — enter laptop Wi-Fi IP below for phone`,
      isPreferred: true,
    });
  }

  return options;
}
