import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Route Inventory & Authentication Boundary Audit
 *
 * Ensures that every route under `src/app/api/` is explicitly accounted for:
 * 1. Protected by `requireApiSession` from `@/server/auth`.
 * 2. On an explicit, commented allow-list:
 *    - Health check: `/api/health` (zero-PII system health monitoring)
 *    - Public authentication routes: `/api/auth/*` (`sign-in`, `sign-out`, `session`)
 *    - Hardware / device ingest with own key: `/api/arduino/*` (`ingest`, `check-in` authenticated with device tokens)
 *    - Phone webhook: `/api/webhooks/*` (`health-connect` authenticated with HMAC-SHA256 signature)
 */

const EXPLICIT_ALLOW_LIST = [
  // Health check: zero-PII system health and uptime endpoint
  "/api/health",
  // Public authentication and session management endpoints
  "/api/auth/sign-in",
  "/api/auth/sign-out",
  "/api/auth/session",
  // Hardware/device ingest endpoints authenticating with dedicated device keys
  "/api/arduino/ingest",
  "/api/arduino/check-in",
  // External mobile health connect companion webhook authenticating with HMAC signature
  "/api/webhooks/health-connect",
] as const;

function findRouteFiles(dir: string, baseDir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") {
        results.push(...findRouteFiles(fullPath, baseDir));
      }
    } else if (entry.name === "route.ts" || entry.name === "route.js") {
      results.push(fullPath);
    }
  }

  return results;
}

function filePathToApiRoute(filePath: string, apiRoot: string): string {
  const relative = path.relative(apiRoot, filePath).replace(/\\/g, "/");
  const routePath = relative.replace(/\/route\.(ts|js)$/, "");
  return `/api/${routePath}`;
}

describe("Route Inventory & Protection Audit", () => {
  const apiRoot = path.resolve(__dirname, "..");
  const routeFiles = findRouteFiles(apiRoot, apiRoot);

  it("finds all existing route.ts files in src/app/api/", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(14);
  });

  for (const file of routeFiles) {
    const routePath = filePathToApiRoute(file, apiRoot);

    it(`verifies protection boundary for ${routePath}`, () => {
      // 1. Check if route is on the explicit, commented allow-list
      const isAllowListed = EXPLICIT_ALLOW_LIST.some(
        (allowed) => routePath === allowed
      );

      if (isAllowListed) {
        const content = fs.readFileSync(file, "utf8");
        if (routePath.startsWith("/api/arduino/")) {
          // Device ingest with dedicated key/token
          expect(content).toMatch(/verifyArduinoDeviceCredential|extractBearerToken|deviceToken|deviceId/i);
        } else if (routePath.startsWith("/api/webhooks/")) {
          // Webhook with cryptographic HMAC signature
          expect(content).toMatch(/verifyHmacSha256Signature|x-signature|x-webhook-token/i);
        } else if (routePath === "/api/health") {
          // System health check contains zero PII
          expect(content).not.toMatch(/participantId|email|password|patientId/i);
        } else if (routePath.startsWith("/api/auth/")) {
          // Public auth endpoint
          expect(content).toMatch(/NextResponse/);
        }
        return;
      }

      // 2. All other routes MUST be guarded with requireApiSession
      const content = fs.readFileSync(file, "utf8");
      const guardsApiSession =
        content.includes("requireApiSession") &&
        (content.includes("@/server/auth") || content.includes("@/server/auth/guards"));

      expect(
        guardsApiSession,
        `Route ${routePath} (${file}) must be guarded with requireApiSession or placed on the explicit allow-list.`
      ).toBe(true);
    });
  }
});
