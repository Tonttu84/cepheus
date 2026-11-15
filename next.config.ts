import os from "node:os";
import type { NextConfig } from "next";

function detectLocalDevHosts(): string[] {
  const hosts = new Set<string>([
    "localhost",
    "127.0.0.1",
    "*.localhost",
    "*.local",
    "192.168.*.*",
    "10.*.*.*",
  ]);
  for (let second = 16; second <= 31; second++) {
    hosts.add(`172.${second}.*.*`);
  }

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        hosts.add(entry.address);
      }
    }
  }
  return Array.from(hosts);
}

export function buildAllowedDevOrigins(): string[] {
  return detectLocalDevHosts();
}

// NOTE (CSP): 'unsafe-inline' is retained for Next.js App Router hydration and
// component inline styling. 'wasm-unsafe-eval' is required for local MediaPipe
// Face Landmarker WebAssembly execution on /camera.
// MediaPipe task models and wasm runtimes are self-hosted under /mediapipe.
// Fonts are self-hosted in /fonts. No external connections are allowed.
// In development, Next.js requires 'unsafe-eval' for Fast Refresh / error overlays
// and 'ws:' in connect-src for the hot module replacement (HMR) WebSocket.
export function buildContentSecurityPolicy(
  mode: string = process.env.NODE_ENV ?? "development"
): string {
  const isProduction = mode === "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self'",
    "font-src 'self'",
    `connect-src 'self'${isProduction ? "" : " ws:"}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://www.fitbit.com",
    "frame-ancestors 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  allowedDevOrigins: buildAllowedDevOrigins(),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy(process.env.NODE_ENV),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
