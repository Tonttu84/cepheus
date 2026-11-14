import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/openapi.json/route";
import { API_ROUTES, getOpenApiDocument } from "@/server/openapi";

const API_DIR = path.resolve(__dirname, "../..");

/**
 * Route files that belong to other parts of the product and are not part of
 * the check-in API yet. A new route file must be added either to the
 * document or, knowingly, here.
 */
const NOT_IN_THE_DOCUMENT = new Set([
  "/api/ai/nurse-brief",
  "/api/ai/patient-step",
  "/api/arduino/check-in",
  "/api/arduino/ingest",
  "/api/demo",
  "/api/fitbit/auth",
  "/api/fitbit/callback",
  "/api/fitbit/disconnect",
  "/api/fitbit/status",
  "/api/fitbit/sync",
  "/api/health",
  "/api/monitoring/consent",
  "/api/monitoring/summary",
  "/api/webhooks/health-connect",
]);

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

function apiPathOf(file: string): string {
  const relative = path.relative(API_DIR, path.dirname(file)).split(path.sep).join("/");
  return `/api/${relative}`.replace(/\[([^\]]+)\]/g, "{$1}").replace(/\/$/, "");
}

describe("GET /api/openapi.json", () => {
  it("serves an OpenAPI 3.1 document", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const doc = await res.json();
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths).length).toBe(new Set(API_ROUTES.map((r) => r.path)).size);
  });

  it("names only routes that exist, with the method the route file exports", () => {
    const doc = getOpenApiDocument();
    for (const [apiPath, item] of Object.entries(doc.paths ?? {})) {
      const dir = apiPath.replace(/^\/api\//, "").replace(/\{([^}]+)\}/g, "[$1]");
      const source = readFileSync(path.join(API_DIR, dir, "route.ts"), "utf8");
      for (const method of Object.keys(item ?? {})) {
        expect(source, `${method.toUpperCase()} ${apiPath}`).toMatch(
          new RegExp(`export async function ${method.toUpperCase()}[(]`)
        );
      }
    }
  });

  it("contains every route file, apart from the ones knowingly left out", () => {
    const documented = new Set(Object.keys(getOpenApiDocument().paths ?? {}));
    for (const file of routeFiles(API_DIR)) {
      const apiPath = apiPathOf(file);
      expect(documented.has(apiPath) || NOT_IN_THE_DOCUMENT.has(apiPath), apiPath).toBe(true);
    }
  });

  it("documents the request schemas and the system route's path parameter", () => {
    const paths = getOpenApiDocument().paths ?? {};
    expect(paths["/api/check-in/phq9"]?.post?.requestBody).toBeDefined();
    const evaluate = paths["/api/patients/{patientId}/evaluate"]?.post;
    expect(evaluate?.parameters?.some((p) => "name" in p && p.name === "patientId" && p.in === "path")).toBe(true);
  });
});
