import { describe, expect, it, vi } from "vitest";
import nextConfig, { buildContentSecurityPolicy } from "../../../../next.config";

function parseDirectives(csp: string): Map<string, string> {
  const directives = csp.split(";").map((d) => d.trim()).filter(Boolean);
  const directiveMap = new Map<string, string>();
  for (const dir of directives) {
    const [name, ...values] = dir.split(/\s+/);
    directiveMap.set(name, values.join(" "));
  }
  return directiveMap;
}

describe("HTTP Security Headers Configuration (next.config.ts)", () => {
  it("defines security headers for all routes (/(.*))", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(nextConfig.headers).toBeDefined();
      const headerConfigs = await nextConfig.headers!();
      const globalConfig = headerConfigs.find((c) => c.source === "/(.*)");
      expect(globalConfig).toBeDefined();

      const headersMap = new Map<string, string>();
      for (const h of globalConfig!.headers) {
        headersMap.set(h.key, h.value);
      }

      // Required headers
      expect(headersMap.get("X-Content-Type-Options")).toBe("nosniff");
      expect(headersMap.get("Referrer-Policy")).toBe("no-referrer");
      expect(headersMap.get("X-Frame-Options")).toBe("DENY");
      expect(headersMap.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
      expect(headersMap.get("X-DNS-Prefetch-Control")).toBe("off");

      // Permissions-Policy: camera and microphone only for the app itself (self)
      const permissions = headersMap.get("Permissions-Policy");
      expect(permissions).toBeDefined();
      expect(permissions).toContain("camera=(self)");
      expect(permissions).toContain("microphone=(self)");
      expect(permissions).toContain("geolocation=()");
      expect(permissions).toContain("interest-cohort=()");

      // Content-Security-Policy
      const csp = headersMap.get("Content-Security-Policy");
      expect(csp).toBeDefined();

      const directives = csp!.split(";").map((d) => d.trim()).filter(Boolean);
      const directiveMap = new Map<string, string>();
      for (const dir of directives) {
        const [name, ...values] = dir.split(/\s+/);
        directiveMap.set(name, values.join(" "));
      }

      expect(directiveMap.get("default-src")).toBe("'self'");
      expect(directiveMap.get("object-src")).toBe("'none'");
      expect(directiveMap.get("base-uri")).toBe("'self'");
      expect(directiveMap.get("frame-ancestors")).toBe("'none'");

      // Fonts are self-hosted: only 'self'
      expect(directiveMap.get("font-src")).toBe("'self'");

      // Images: only 'self'
      expect(directiveMap.get("img-src")).toBe("'self'");

      // Connections: only 'self' (MediaPipe model/WASM are self-hosted in public/mediapipe)
      expect(directiveMap.get("connect-src")).toBe("'self'");

      // Scripts: 'self', 'unsafe-inline', 'wasm-unsafe-eval', but never 'unsafe-eval'
      const scriptSrc = directiveMap.get("script-src");
      expect(scriptSrc).toBeDefined();
      expect(scriptSrc).toContain("'self'");
      expect(scriptSrc).toContain("'unsafe-inline'");
      expect(scriptSrc).toContain("'wasm-unsafe-eval'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");

      // Styles: 'self', 'unsafe-inline'
      expect(directiveMap.get("style-src")).toBe("'self' 'unsafe-inline'");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  describe("buildContentSecurityPolicy pure function", () => {
    it("returns production policy with no 'unsafe-eval' and no ws:", () => {
      const csp = buildContentSecurityPolicy("production");
      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).not.toContain("ws:");

      const directiveMap = parseDirectives(csp);
      expect(directiveMap.get("default-src")).toBe("'self'");
      expect(directiveMap.get("object-src")).toBe("'none'");
      expect(directiveMap.get("base-uri")).toBe("'self'");
      expect(directiveMap.get("frame-ancestors")).toBe("'none'");
      expect(directiveMap.get("font-src")).toBe("'self'");
      expect(directiveMap.get("img-src")).toBe("'self'");
      expect(directiveMap.get("connect-src")).toBe("'self'");

      const scriptSrc = directiveMap.get("script-src");
      expect(scriptSrc).toBeDefined();
      expect(scriptSrc).toContain("'self'");
      expect(scriptSrc).toContain("'unsafe-inline'");
      expect(scriptSrc).toContain("'wasm-unsafe-eval'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");

      expect(directiveMap.get("style-src")).toBe("'self' 'unsafe-inline'");
      expect(directiveMap.get("worker-src")).toBe("'self' blob:");
      expect(directiveMap.get("media-src")).toBe("'self' blob:");
      expect(directiveMap.get("form-action")).toBe("'self' https://www.fitbit.com");
    });

    it("returns development policy containing 'unsafe-eval' and ws: while retaining all base directives", () => {
      const csp = buildContentSecurityPolicy("development");
      expect(csp).toContain("'unsafe-eval'");
      expect(csp).toContain("ws:");

      const directiveMap = parseDirectives(csp);
      expect(directiveMap.get("default-src")).toBe("'self'");
      expect(directiveMap.get("object-src")).toBe("'none'");
      expect(directiveMap.get("base-uri")).toBe("'self'");
      expect(directiveMap.get("frame-ancestors")).toBe("'none'");
      expect(directiveMap.get("font-src")).toBe("'self'");
      expect(directiveMap.get("img-src")).toBe("'self'");

      // Connections: 'self' plus ws: for HMR
      const connectSrc = directiveMap.get("connect-src");
      expect(connectSrc).toBeDefined();
      expect(connectSrc).toContain("'self'");
      expect(connectSrc).toContain("ws:");

      // Scripts: 'self', 'unsafe-inline', 'wasm-unsafe-eval', and 'unsafe-eval'
      const scriptSrc = directiveMap.get("script-src");
      expect(scriptSrc).toBeDefined();
      expect(scriptSrc).toContain("'self'");
      expect(scriptSrc).toContain("'unsafe-inline'");
      expect(scriptSrc).toContain("'wasm-unsafe-eval'");
      expect(scriptSrc).toContain("'unsafe-eval'");

      expect(directiveMap.get("style-src")).toBe("'self' 'unsafe-inline'");
      expect(directiveMap.get("worker-src")).toBe("'self' blob:");
      expect(directiveMap.get("media-src")).toBe("'self' blob:");
      expect(directiveMap.get("form-action")).toBe("'self' https://www.fitbit.com");
    });
  });

  it("configures development CSP on nextConfig.headers() outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const headerConfigs = await nextConfig.headers!();
      const globalConfig = headerConfigs.find((c) => c.source === "/(.*)");
      expect(globalConfig).toBeDefined();

      const headersMap = new Map<string, string>();
      for (const h of globalConfig!.headers) {
        headersMap.set(h.key, h.value);
      }

      const csp = headersMap.get("Content-Security-Policy");
      expect(csp).toBeDefined();
      const directiveMap = parseDirectives(csp!);

      expect(directiveMap.get("script-src")).toContain("'unsafe-eval'");
      expect(directiveMap.get("connect-src")).toContain("ws:");
      expect(directiveMap.get("default-src")).toBe("'self'");
      expect(headersMap.get("X-Content-Type-Options")).toBe("nosniff");
      expect(headersMap.get("Referrer-Policy")).toBe("no-referrer");
      expect(headersMap.get("X-Frame-Options")).toBe("DENY");
      expect(headersMap.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
      expect(headersMap.get("X-DNS-Prefetch-Control")).toBe("off");
      expect(headersMap.get("Permissions-Policy")).toContain("camera=(self)");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
