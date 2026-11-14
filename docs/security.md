# Security Architecture & Hardening

This document summarizes the security controls implemented across Cepheus's web shell, Fitbit OAuth2 integration, and Arduino UNO Q ingestion pipeline.

## 1. OAuth2 PKCE & Encrypted Cookie Sessions (`src/server/security/crypto.ts`)

- **Authorization Code + PKCE (`S256`):** `/api/fitbit/auth` generates a 48-byte CSPRNG `code_verifier` and SHA-256 `code_challenge`, plus a 32-byte `state` token.
- **Sealed `HttpOnly` Cookies (AES-256-GCM):** Both the transient PKCE state (`cepheus_fitbit_oauth_state`, 10-min TTL) and Fitbit token bundle (`cepheus_fitbit_session`) are encrypted and authenticated with AES-256-GCM before being stored in `HttpOnly`, `SameSite=Lax` (`Secure` in production) cookies. Tokens are never exposed to client JavaScript or `localStorage`.
- **Constant-Time Verification:** OAuth `state` and `ARDUINO_INGEST_TOKEN` comparisons use `timingSafeEqualString` over SHA-256 digests so timing leaks neither contents nor length.

## 2. CSRF, Rate Limiting, and Hardware Auth (`src/server/security/http.ts`, `rate-limit.ts`)

- **Same-Origin Verification:** Browser `POST` endpoints (`/api/fitbit/sync`, `/api/fitbit/disconnect`, `/api/monitoring/consent`) verify `Origin` / `Referer` host matches `Host` / `X-Forwarded-Host`.
- **Hardware & Webhook Authentication:**
  - `/api/arduino/ingest` requires `Authorization: Bearer <ARDUINO_INGEST_TOKEN>` when configured and **fails closed (`401`) in production** if `ARDUINO_INGEST_TOKEN` is unset.
  - `/api/webhooks/health-connect` verifies `X-Signature: sha256=<HMAC-SHA256(secret, rawBody)>` (Life Dashboard Companion) or `Authorization: Bearer` / `X-Webhook-Token` against `HEALTH_CONNECT_WEBHOOK_SECRET` in constant time (`verifyHmacSha256Signature` / `timingSafeEqualString`), failing closed (`401`) when missing or invalid.
- **Sliding-Window Rate Limiting:** OAuth, sync, consent, webhook, and hardware ingest routes enforce per-IP sliding-window limits with `429` + `Retry-After`.

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
