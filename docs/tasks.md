# Pre-Review Task List (Prioritised Top-Down)

Updated against `main` (`4f9794f`) and active open trails (**#52**, **#53**, **#54**) on 14 Nov 2026.

## Current Snapshot (`main` + Open Trails)

Already merged on `main`:
- PostgreSQL + Prisma schema & transactional storage ports (`src/server/db/`, Trail #47)
- Domain rules: instruments (PHQ-9, GAD-7, 2-tap), rounds, baselines, classification, warning rule, crisis trigger, flags, consent, signal maths, camera kinematics, rotating extra question (`D25`), and `D45` answer-handling tests (Trail #51)
- Patient & clinic use cases (`src/usecases/`), EU Verda Gemma client (`off` by default, `D44`), Arduino UNO Q kiosk/edge monitor (`hardware/uno-q/`), and 3D-printable enclosure (`hardware/enclosure/` `stl/` + `slt2/`, Trail #45)

In open trails (`phase: building`, not yet merged):
- **Trail #52** (`feat/rewards-and-small-tasks`): rewards ledger & 5 small tasks logic (`D48`) — logic only, no DB/routes/UI
- **Trail #53** (`feat/header-auth`): sealed `cepheus_session` cookie, `SimulatedFinnishEidProvider`, staff password + 6-digit code, `/sign-in`, `HeaderAuthControl`, `SessionContextPill`
- **Trail #54** (`feat/storage-follow-up`): `STORE_ITEM_ANSWERS=false` (`D45` in-memory store), `Gad7Assessment` repo, `ConsentEvent` audit rows, `isSimulated` propagation

---

## P0 — Fix Logged-Out Auth, Role-Scoped Nav & API Route Protection (Do First)

Even with Trail #53, **logged-out users still see all patient/clinic navigation and unprotected pages/APIs**, and Trail #53 is 3 commits behind `main` (overwriting the new `/cepheus-icon.png` header mark).

- [x] **P0.1 — Hide patient & clinic navigation when logged out (`src/components/site-nav.tsx`, `src/app/page.tsx`)**
  - Pass session/actor state from server layout into `SiteNav`.
  - When **logged out**: render only `Overview` (`/`), `Sign in`, and the always-visible `CrisisHelpBar` — **no** `/check-in`, `/camera`, `/monitoring`, `/patient`, or `/clinic` links in `SiteNav` OR in `ExploreViewsGrid()` on `/` (`src/app/page.tsx`), and **no** sensitive/patient data.
  - When **patient** is signed in: show only patient nav (`/check-in`, `/camera`, `/monitoring`, `/patient`).
  - When **clinic staff** is signed in: show only `/clinic`.
  - Keep `main`'s `/cepheus-icon.png` brand mark when merging/rebasing Trail #53.
- [x] **P0.2 — Gate protected pages & redirect when logged out or wrong role (`src/app/**`)**
  - Require a valid session on `/patient`, `/check-in`, `/camera`, `/monitoring` (patient role) and `/clinic` (staff role); redirect logged-out visitors to `/sign-in` and refuse wrong-role access instead of only showing `SessionContextPill` over full views.
  - Clean up `/` (`src/app/page.tsx`): remove direct `getPrisma()` participant query when logged out and hide `ExploreViewsGrid` / `DemoTimelinePreview` patient/clinic details unless signed in (or replace with a static, zero-PII public overview + Sign-in CTA).
- [x] **P0.3 — Protect all patient/clinic API routes (`src/app/api/**`)**
  - Enforce session + role (`decideAccess`) on:
    - `/api/monitoring/summary` (patient or staff D8 view)
    - `/api/monitoring/consent` (patient only)
    - `/api/ai/nurse-brief` (staff only)
    - `/api/ai/patient-step` (patient only)
    - `/api/fitbit/auth`, `/api/fitbit/status`, `/api/fitbit/sync`, `/api/fitbit/disconnect` (patient only)
  - Lock or remove `/api/demo` for unauthenticated callers; leave `/api/health` (status only, zero patient data), `/api/auth/*`, and signed/token-verified machine routes (`/api/webhooks/health-connect`, `/api/arduino/*`) properly scoped.
- [x] **P0.4 — Add logged-out nav & route-matrix tests**
  - Assert in Vitest + Playwright (`e2e/auth.spec.ts`) that a logged-out browser sees zero patient/clinic nav links (in `SiteNav` and on `/`), gets redirected from `/patient`, `/check-in`, `/camera`, `/monitoring`, and `/clinic` to `/sign-in`, and receives `401` on all protected API endpoints.

---

## P1 — Wire Real Patient & Clinic Loops to PostgreSQL (`src/usecases/`)

Pages currently call `generateSimulatedPersonWeeks()` instead of the real use cases and PostgreSQL storage built in Trails #47 and #54.

- [ ] **P1.1 — Connect `/check-in` and `/patient` to real check-in use cases**
  - Wire `getCheckInState`, `submitTaps`, `submitNotToday`, `submitPhq9Answer`, and `submitExtraAnswer` through authenticated routes/server actions.
  - Fix `src/usecases/get-check-in-state.ts:168` so `getCheckInState` no longer reports PHQ-9 as due after `Not today` (flagged in Trail #46/#51).
  - Connect per-method consent switches to `savePatient` (`ConsentEvent` from Trail #54).
- [ ] **P1.2 — Connect `/clinic` to real flags, crisis alerts, nurse calls & enrolment**
  - Read real `ClinicFlag` rows (area + date only, `D8`) and unacknowledged `CrisisEvent` alerts.
  - Wire nurse-call recording (`NurseCallRecord`, restarting the warning rule) and one-time `EnrolmentCode` issuance UI for staff.
- [ ] **P1.3 — Unify UNO Q bedside kiosk onto shared check-in routes (`D43`)**
  - Replace separate bedside storage in `src/app/api/arduino/check-in/route.ts` and `src/server/monitoring/bedside.ts` with calls to the shared check-in use cases (authenticated by device token).
  - Close Trail #44/#54 follow-ups: ignore extra items after completion, allow crisis button while check-in consent is paused, and add an in-process per-patient lock around post-commit `answer-store` updates.
- [ ] **P1.4 — Default passive monitoring consent switches to off and separate device status (`src/server/monitoring/store.ts`, `src/components/monitoring/consent-section.tsx`)**
  - Default `ring_rhythm`, `camera_expressivity`, and `home_routine` in `ensureHomeDemoParticipant` to `enabled: false` (Paused) until explicitly opted in, matching `D13` and `INITIAL_CONSENT_STATE`.
  - Show device connection status (connected / not connected) separately from consent permission on `/monitoring`, and update `monitoring.dbtest.ts` / `e2e/monitoring.spec.ts` accordingly.

---

## P2 — Missing Features, Hardening & Full Gate

- [ ] **P2.1 — Wire GAD-7 UI (`D35`) & simulated sample patients**
  - Surface GAD-7 check-in flow for patients with anxiety enabled and verify both sample patients (depression-only and depression + anxiety).
- [ ] **P2.2 — Wire Rewards & Small Tasks (`D48`, Trail #52) + optional patient note (`D26`)**
  - Add Prisma tables/ports, routes, and patient UI for Trail #52's rewards ledger & daily small tasks (if included in demo scope), plus optional free-text note to clinic (`D26`, `D33`) and toggleable walk/round counters (`D38`, `D42`).
- [ ] **P2.3 — Security & compliance hardening (`docs/build-plan.md` Step 10)**
  - Add per-request CSP headers, cross-origin checks on all mutating routes, `isSimulated` support on patient creation + Zod validation on `triggerKind`/`callPosition` casts (Trail #54 limits), and verify logs contain zero answers or participant codes.
- [ ] **P2.4 — Pass full gate**
  - Run `npm run check && npm run test:db && npm run build && npm run test:e2e` (including `e2e/camera.spec.ts` once Chromium binary is available).

---

## P3 — Trail Merges & Pre-Review Rehearsal

- [ ] **P3.1 — Review, rebase & merge Trails #53, #54, #52 (and new P0/P1 trails) onto `main`**
- [ ] **P3.2 — End-to-end demo rehearsal**
  - Test enclosure (`hardware/enclosure/slt2/`) + UNO Q bedside flow + logged-out protection -> patient sign-in -> check-in / PHQ-9 -> warning -> staff sign-in -> clinic call flow.
