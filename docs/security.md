# Security Architecture & Hardening

This document summarizes the security controls implemented across Cepheus's web shell, Fitbit OAuth2 integration, and Arduino UNO Q ingestion pipeline.

## 1. OAuth2 PKCE & Encrypted Cookie Sessions (`src/server/security/crypto.ts`)

- **Authorization Code + PKCE (`S256`) & Strict Redirect URI:** `/api/fitbit/auth` generates a 48-byte CSPRNG `code_verifier`, SHA-256 `code_challenge`, and 32-byte `state` token. `FITBIT_REDIRECT_URI` must be explicitly configured (never derived from request `Host` headers).
- **Sealed `HttpOnly` Cookies (AES-256-GCM):** Both the transient PKCE state (`cepheus_fitbit_oauth_state`, 10-min TTL) and Fitbit token bundle (`cepheus_fitbit_session`) are encrypted and authenticated with AES-256-GCM before being stored in `HttpOnly`, `SameSite=Lax` (`Secure` in production) cookies. Tokens are never exposed to client JavaScript or `localStorage`.
- **Constant-Time Verification:** OAuth `state`, webhook signatures, and device tokens are compared in constant time (`timingSafeEqualString`, `verifyHmacSha256Signature`).

## 2. Access Rules, CSRF, Rate Limiting, and Hardware Auth (`src/server/security/`, `src/domain/access`)

- **Shared `decideAccess` Enforcement & Demo Scope:** All monitoring reads/writes invoke `decideAccess()` (`src/domain/access`) and enforce `D8` (clinic staff cannot read raw sensor numbers). Note: before Step 6 session auth merges, `/api/monitoring/summary` and ingest routes target the single pseudonymous demo participant (`demo-home-node-01`, no real patient data).
- **Same-Origin Verification:** Browser `POST` endpoints (`/api/fitbit/sync`, `/api/fitbit/disconnect`, `/api/monitoring/consent`) verify `Origin` / `Referer` host matches `Host` / `X-Forwarded-Host`.
- **Per-Device Hashed Credentials & Replay Protection:** `/api/arduino/ingest` supports per-device SHA-256 hashed, revocable credentials (`ARDUINO_DEVICE_KEYS_JSON`) plus `ARDUINO_INGEST_TOKEN` fallback, fails closed (`401`) in production if unconfigured, and enforces `timestampMs` freshness (`±5 min`) + single-use `nonce` replay rejection (`409`).
- **Health Connect Webhook Auth:** `/api/webhooks/health-connect` verifies `X-Signature: sha256=<HMAC-SHA256(secret, rawBody)>` or `Authorization: Bearer` / `X-Webhook-Token` against `HEALTH_CONNECT_WEBHOOK_SECRET`, failing closed (`401`) when missing or invalid.
- **Proxy-Safe Rate Limiting:** `getClientKey` ignores `x-forwarded-for` unless `TRUST_PROXY_HEADERS=true` is explicitly set behind a trusted reverse proxy, and keys hardware/device endpoints on a SHA-256 hash of `deviceId`.

## 3. Strict Input Validation & Raw-Media Refusal

- **Payload Size Caps:** `/api/arduino/ingest` rejects bodies over 16 KB (`413`), and `/api/webhooks/health-connect` rejects bodies over 512 KB (`413`).
- **Recursive Raw-Media Guard:** `src/domain/arduino/evaluate.ts` (`containsRawMediaFields`) rejects any JSON key associated with raw frames, images, or audio (`frame`, `imageBase64`, `video`, `audio`, `pcm`, etc.).
- **Zod 4 Strict Schemas:** API inputs reject unknown properties (`.strict()`) and invalid ranges.

## 4. Environment & Secret Hygiene (`src/server/env.ts`)

- Secrets are read only from environment variables (`.env.example` contains empty placeholders).
- `parseEnv` enforces PostgreSQL URLs, refuses local dev passwords in production, validates `FITBIT_REDIRECT_URI` protocol, enforces minimum lengths on `APP_SESSION_SECRET` (32+ chars) and `ARDUINO_INGEST_TOKEN` (16+ chars) in production, and **never prints secret values in exceptions**.

## 5. HTTP Security Headers (`next.config.ts`)

Every response includes:
- `Content-Security-Policy` (restricting `script-src` to `'self'`, `'wasm-unsafe-eval'` for local MediaPipe WASM, `connect-src` to `'self' https://api.fitbit.com`, `object-src 'none'`, `frame-ancestors 'none'`)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(), geolocation=(), interest-cohort=()`
- `Cross-Origin-Opener-Policy: same-origin`

## 6. Layer & Dependency Gates (`eslint.config.mjs`, `scripts/audit.mjs`)

- Pure domain modules (`src/domain/**`) cannot import DB, network, or React modules.
- Prisma (`@/lib/db`) may only be imported in `src/server/**`.
- `npm run check` runs TypeScript strict checks, ESLint layer checks, `npm audit` vulnerability gate, and Vitest unit tests.

## Known Production Follow-Ups (Outside Weekend Scope)

- Add clinic staff + pseudonymous patient authentication (`Better Auth`, per `docs/build-plan.md` step 6) and database row-level security before multi-user deployment.
- Terminate TLS at reverse proxy / host with HSTS enabled (`Strict-Transport-Security`) and use a Redis-backed rate limiter for multi-instance scaling.
