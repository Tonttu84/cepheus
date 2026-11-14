import { describe, expect, it } from "vitest";
import nextConfig from "../../../../next.config";

describe("HTTP Security Headers Configuration (next.config.ts)", () => {
  it("defines security headers for all routes (/(.*))", async () => {
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
  });
});
