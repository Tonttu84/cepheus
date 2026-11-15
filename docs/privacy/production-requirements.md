# Production Deployment Requirements

> **Draft for a hackathon demonstration. Written by an AI agent, not reviewed by a lawyer, not legal advice.**

This document defines what the Cepheus system architecture **requires of a real deployment** in a clinical healthcare environment under European and Finnish law (GDPR Regulation (EU) 2016/679, Tietosuojalaki 1050/2018, and Laki sosiaali- ja terveydenhuollon asiakastietojen käsittelystä 703/2023).

Each section specifies a formal deployment requirement alongside repository citations and an honest comparison of what the current hackathon demonstration does instead.

---

## 1. Hosting and Healthcare Infrastructure

The service and its database run on servers physically located within the European Union (EU) or European Economic Area (EEA) at an infrastructure provider possessing the security certifications and organisational safeguards that healthcare data calls for.

### Repository Citations
- **Primary Hosting Target (Finnish Provider):**
  - `docs/build-plan.md` line 44 (row B5): *"The product's target is a managed PostgreSQL in Helsinki from a Finnish-owned provider (UpCloud). Until an account or credits exist, the hosting is simulated: the app runs in production mode against a real PostgreSQL, configured as it would be when hosted | Company and data centre are both in Finland, so the contested question of US-owned providers in EU regions does not arise."*
  - `docs/decisions.md` line 24 (row D18): *"The product's hosting target is a managed PostgreSQL in Helsinki from a Finnish-owned provider; until an account or credits exist, hosting is simulated (production mode against a real PostgreSQL) | The owner, 14 Nov 2026: 'Or we at least simulate the hosting' and 'We can aim to host properly if we get credits' | A US-owned provider's EU region; paying before there is anything to host."*
- **Partner Providing EU Hosting for Optional Model Compute (Verda):**
  - `docs/decisions.md` line 50 (row D44): *"An isolated, off-by-default (`VERDA_AI_ENABLED=false`) EU-hosted Verda Gemma module may format derived summary numbers (with no participant ID sent off-server) into a nurse pre-call brief on `/clinic`, displaying the raw source metrics alongside the draft for human verification... formatting given numbers with EU confidential compute and HITL source verification avoids MDR Class IIa / automation-bias hazards."*
  - `docs/research/10-nurse-brief-model.md` line 34: *"All of Verda's data centres are in the EU (Finland) or the EEA (Iceland), under the GDPR (https://trust.verda.com/faq). Verda does not itself initiate transfers of stored data outside the EU/EEA, though some sub-processors may."*
  - `docs/research/10-nurse-brief-model.md` line 60: *"Verda is an EU-based cloud provider (NVIDIA Preferred Partner) offering GPU infrastructure powered by 100% renewable energy, with operational presence in Finland (Verda official site). All of Verda's data centres are in the EU (Finland) or the EEA (Iceland), under the GDPR (https://trust.verda.com/faq)."*
  - `docs/research/10-nurse-brief-model.md` line 61: *"Verda provides confidential computing featuring hardware-level isolation (including NVIDIA Blackwell architecture) that prevents host administrators and operators from accessing customer prompts and memory in plaintext."*
  - `docs/research/10-nurse-brief-model.md` line 62: *"Verda states it is ISO 27001 certified; the trust centre overview also lists GDPR, ISO 27017, ISO 27018, ISO 27701 and SOC 2 (reports on request, not seen) (https://trust.verda.com/faq)."*
  - `docs/research/10-nurse-brief-model.md` line 121: *"Verda's certification reports (ISO 27001, ISO 27017, ISO 27018, ISO 27701, and SOC 2), which are available on request and were not seen."*
  - `docs/general-plan.md` line 142: *"Verda 200 EUR; Modal 100 USD per participant."*
  - `docs/verda-gemma.md` lines 1–13: Specifications of the optional EU-hosted Verda Gemma integration.

In the demonstration: The service runs on a developer laptop using local embedded PostgreSQL (or SQLite), which is not an EU-certified healthcare hosting server.

---

## 2. No Transfer of Personal Data Outside the EU/EEA

The service transfers no personal data outside the EU/EEA; any automated or AI model operating on patient data is EU-hosted, off by default, and receives pseudonymous derived numbers only without patient identifiers.

### Repository Citations
- `docs/decisions.md` line 50 (row D44): *"An isolated, off-by-default (`VERDA_AI_ENABLED=false`) EU-hosted Verda Gemma module may format derived summary numbers (with no participant ID sent off-server) into a nurse pre-call brief on `/clinic`, displaying the raw source metrics alongside the draft for human verification... Relaxes, for this switchable EU module only, the `docs/build-plan.md` protection line forbidding any outside AI service; deterministic rules still decide all warnings and crisis routing, and diagnostic/severity/triage/ungrounded output is rejected | ... Sending data to non-EU commercial AI APIs; sending participant identifiers off-server; letting AI decide warnings or invent numbers; keeping AI enabled by default."*
- `docs/verda-gemma.md` lines 5–8: Strips `participantCode` completely before sending any request to external inference; only derived numbers, broad areas, and `sinceDate` leave the server; rejects outputs for `crisis_self_harm`; remains disabled by default (`VERDA_AI_ENABLED="false"`).
- `docs/research/10-nurse-brief-model.md` lines 36 and 66: *"We must configure the endpoint so inputs and outputs are not stored, use a synchronous endpoint, and treat the 365-day connection metadata (our server's IP address, not patient data) as acceptable. Hosting alone does not satisfy Article 28; a processor agreement is still needed."*
- `docs/research/10-nurse-brief-model.md` line 65: Verda lists 12 sub-processors (EU and US); Cloudflare sits in front of DNS traffic, but none process language-model inference inputs.
- `docs/privacy/how-the-build-meets-the-requirements.md` line 24: *"Zero transfers to US commercial AI clouds."*

In the demonstration: External AI inference is disabled (`VERDA_AI_ENABLED=false`), and all nurse brief summaries are generated by local deterministic fallback code without outbound network calls.

---

## 3. Encryption, Secrets Management, and Backups

The service runs with encryption in transit (TLS 1.3 / HTTPS) and encryption at rest (transparent volume or database encryption for all databases and backup media); all application secrets, database credentials, and API keys reside exclusively in environment variables; and automated, encrypted backups are taken and retained according to a documented retention schedule.

### Repository Citations
- `docs/build-plan.md` line 44 (row B5): *"The service encrypts disks and backups (B5); the rows are pseudonymous (B3)."*
- `docs/build-plan.md` line 147: *"A lost or stolen database copy: The service encrypts disks and backups (B5); the rows are pseudonymous (B3)."*
- `AGENTS.md` ("Private data"): *"No secrets in the repository: event credit codes, API keys, passwords, tokens. Keys live in environment variables; commit the variable names with empty values."*
- `.env.example` lines 1–14: Environment variable declarations for database connections, authentication cookies, and optional inference credentials.
- `docs/privacy/how-the-build-meets-the-requirements.md` line 19: Session cookies sealed via AES-256-GCM (`src/server/security/crypto.ts`, `src/server/auth/session.ts`).
- `docs/privacy/how-the-build-meets-the-requirements.md` line 35: Acknowledges that database-level encryption at rest (TDE) is not configured in the hackathon codebase.

In the demonstration: The server runs locally over plain HTTP (`http://localhost:3000`), local database files are unencrypted on disk, secrets are loaded from a local `.env` file, and no automated database backup or retention schedule is configured.

---

## 4. Strong Patient Identification and Named, Audited Staff Accounts

The service authenticates patients via official Finnish strong electronic identification (eIDAS-compliant Suomi.fi e-Identification through certified Trust Service Providers such as Finnish banking credentials or mobile certificates), and restricts clinical administration to named, authenticated staff accounts protected by multi-factor authentication, with all access to patient records recorded in an immutable access log.

### Repository Citations
- `docs/decisions.md` line 40 (row D34): *"Patients are identified with Finland's official strong electronic identification. For the hackathon the identification service is simulated behind an interface, so that a real one can replace it. This answers the build plan's open question of whether an enrolment code is enough, and replaces the part of build-plan row B7 that says there is no sign-in through other services | The owner, 14 Nov 2026: a service that shows a person their health data should know who the person is with the country's standard means | An enrolment code alone."*
- `docs/decisions.md` line 26 (row D20): *"Patients are pseudonymous: a random code, no name, phone number, email, date of birth or identity number in our database; the clinic keeps the link; clinic staff are named accounts."*
- `docs/build-plan.md` line 42 (row B3): *"Patients are pseudonymous. Our database holds a random code for each patient and no name, phone number, email, date of birth or identity number. The clinic keeps the link between the code and the person in its own patient record. Clinic staff are named accounts."*
- `docs/build-plan.md` line 46 (row B7): Sign-in uses password and a second factor for staff; no sign-in through other services for staff.
- `docs/build-plan.md` line 114: `StaffUser`: *"The clinic; named staff accounts with a role | The only names in the database."*
- `docs/build-plan.md` line 119: `AccessLog`: *"Who read or changed which patient's data, for which purpose, and when | Holds no answers."*
- `src/server/auth/eid-provider.ts` lines 1–15: Implementation of the simulated Finnish strong electronic identification interface.
- `docs/privacy/how-the-build-meets-the-requirements.md` line 34: *"Patient authentication uses a simulated Finnish strong electronic identification provider (`src/server/auth/eid-provider.ts`, decision D34). A production service must integrate a certified Trust Service Provider (e.g., Suomi.fi e-Identification via Telia, Elisa, or OP bank ID) complying with the eIDAS Regulation."*
- `docs/privacy/mock-clinic-data-policy.md` lines 9–42: Clinic staff roles, access conditions, and immutable access logging.

In the demonstration: Patient electronic identification is simulated via mock identity provider presets (`src/server/auth/eid-provider.ts`), staff sign in using simulated preset accounts with a fixed TOTP code (`123456`), and hardware security keys (FIDO2/WebAuthn) are not enforced.

---

## 5. Processor Agreements, Impact Assessment, Named Governance, Breach Procedures, and System-Enforced Retention

The service operates under a signed Data Processing Agreement (DPA) under GDPR Article 28 with every processor; a completed Data Protection Impact Assessment (DPIA) under GDPR Article 35 approved prior to clinical go-live; a named data protection contact (such as an appointed Data Protection Officer); an operational personal data breach procedure with 72-hour supervisory authority notification under GDPR Articles 33–34; and clinical retention periods enforced automatically by the system.

### Repository Citations
- `docs/research/10-nurse-brief-model.md` line 33: *"Under GDPR Article 28(1) and 28(3), hosting an LLM on third-party cloud infrastructure requires a binding processor agreement specifying documented instructions, confidentiality, and technical/organisational safeguards; hosting alone does not satisfy Article 28. Article 35(1) and 35(3)(b) mandate a Data Protection Impact Assessment (DPIA) when processing health data on a large scale or with new technologies."*
- `docs/research/10-nurse-brief-model.md` line 38: *"Pre-call brief generation for direct care must operate under GDPR Article 9(2)(h), a signed Article 28 processor agreement (hosting alone does not suffice), and strict data minimisation... Any reuse for model fine-tuning or analytics triggers secondary use requirements under Finnish Act 552/2019."*
- `docs/research/10-nurse-brief-model.md` line 120: *"The text of Verda's data processing agreement (Article 28), which the trust centre does not publish (ask compliance@verda.com)."*
- `docs/privacy/how-the-build-meets-the-requirements.md` lines 16, 21, 24, 25, 39: Documents requirements for DPAs, DPIAs, breach reporting via `tietosuoja.fi/ilmoitus-tietoturvaloukkauksesta`, and statutory retention purging.
- `docs/privacy/mock-clinic-data-policy.md` lines 70–88: Defines breach incident management steps, 72-hour notification to the Finnish Data Protection Ombudsman, and retention periods (8–12 weeks active follow-up, clinical audit archive).

In the demonstration: Processing agreements and DPIAs are represented by mock planning documents (`docs/privacy/`), no actual Data Protection Officer is appointed, breach notification is an unexecuted operational playbook, and data purging relies on manual resets rather than automated cron workflows.

---

## 6. Real Patient Data Strictly Prohibited in Non-Production Environments

The service strictly isolates production patient data: real patient data is never loaded, imported, processed, or stored in development, staging, testing, or demonstration environments.

### Repository Citations
- `AGENTS.md` ("Rules of the problem"): *"No real patient data. Use open datasets or simulated data, and label simulated data as simulated wherever it is shown."*
- `docs/security.md` line 13: *"All monitoring reads/writes invoke `decideAccess()` (`src/domain/access`) and enforce `D8` (clinic staff cannot read raw sensor numbers). Note: before Step 6 session auth merges, `/api/monitoring/summary` and ingest routes target the single pseudonymous demo participant (`demo-home-node-01`, no real patient data)."*
- `prisma/seed.ts` lines 1–100: Synthetic participant generator creating fictional sample trajectories (such as `P-SIM-ANX-01` and `P-SIM-REM-02`) flagged with `isSimulated: true`.
- `src/components/simulated-badge.tsx`: Renders visual simulated data indicators across all patient- and staff-facing views.

In the demonstration: All records are synthetic mock participants generated by seed scripts (`prisma/seed.ts`) and explicitly marked with simulated badges throughout the interface.
