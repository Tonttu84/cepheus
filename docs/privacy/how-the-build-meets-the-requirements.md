# How the Build Meets Data Protection Requirements

> **Draft for a hackathon demonstration. Written by an AI agent, not reviewed by a lawyer, not legal advice.**

This document provides a line-by-line compliance analysis of the Cepheus post-TMS wellbeing check-in system against key European and Finnish healthcare data protection principles. Every claim of technical enforcement is backed by real code paths and automated tests in this repository.

---

## 1. Requirements Checklist

| Requirement & Legal Source | What the Build Does (with Evidence) | What a Real Service Would Still Need |
| :--- | :--- | :--- |
| **Lawful Basis & Health Data**<br>*GDPR Article 6(1) & Article 9(1), (2)(a), (2)(h)* | Enforces a multi-tier consent model (`takingPart`, per-method `MeasurementConsent`, and `ruleCheckConsent`) backed by an immutable ledger of consent events (`prisma/schema.prisma` lines 128–161, `src/app/api/monitoring/consent/route.ts`). Code gates all sensor inputs behind explicit consent toggles (`src/domain/consent/__tests__/consent.test.ts`). | Legal determination by the healthcare provider whether the processing falls under Article 9(2)(h) (healthcare provision under national law) or Article 9(2)(a) (explicit consent for voluntary follow-up companion tools), with written patient enrolment agreements. |
| **Consent per Measuring Method & Withdrawal**<br>*GDPR Article 7 & Article 9(2)(a)* | Each measurement modality (`check_in`, `phq9`, `ring_rhythm`, `camera_expressivity`, `speech_rate`, `ambiguous_faces`, `home_routine`, `financial_routine`) has its own toggle in `MeasurementConsent` (decision D13, D21). A participant can disable any method at any time without terminating care; revoked methods halt collection immediately (`src/domain/consent/__tests__/consent.test.ts`, `src/usecases/update-consent.ts`). | Synchronization with the hospital's electronic health record (EHR) and national patient archive (Kanta-palvelut), so withdrawal in the app automatically informs clinical staff. |
| **Data Minimisation**<br>*GDPR Article 5(1)(c)* | 1. Raw camera frames and audio are rejected and never stored; only derived summary numbers leave the device (`src/domain/arduino/evaluate.ts`, `containsRawMediaFields`; `src/__tests__/no-raw-logging.test.ts`).<br>2. Questionnaire item responses 1–8 are kept in volatile server memory only during the round and cleared on completion, storing only the aggregate total (decision D45; `src/server/db/answer-store.ts`).<br>3. Clinic flags expose broad life areas only, never raw sensor graphs or scores (decision D8; `src/domain/access/decide.ts`).<br>4. Free-text clinical notes (`freeTextNote`) were removed from schema (`prisma/schema.prisma`). | Formal Data Protection Officer (DPO) validation of every derived metric to confirm clinical necessity, plus annual metric deprecation reviews. |
| **Purpose Limitation**<br>*GDPR Article 5(1)(b)* | Processing is strictly limited to post-treatment wellbeing monitoring, establishing personal baselines, and triggering nurse outreach. Verified by `src/usecases/__tests__/purpose-consistency.test.ts`, which asserts that every internal access request must state an approved purpose (`clinical_review`, `patient_check_in`, `system_rule_evaluation`). Zero advertising, marketing, or commercial tracking libraries. | Binding data processing agreements (DPAs) with clinic partners stipulating that data cannot be repurposed for commercial research without ethical board approval. |
| **Storage Limitation**<br>*GDPR Article 5(1)(e)* | 1. In-progress questionnaire answers held in server memory are wiped immediately when completed or if the server restarts (decision D45; `src/server/db/answer-store.ts`).<br>2. One-time enrolment codes carry strict expiration timestamps (`EnrolmentCode.expiresAt`, `prisma/schema.prisma` L122).<br>3. Zero data is cached on the client device or browser (`src/__tests__/no-local-storage.test.ts`). | Automated lifecycle purge jobs that delete or anonymize participant data 90 days after follow-up discharge, balanced against statutory Finnish medical record retention mandates. |
| **Accuracy**<br>*GDPR Article 5(1)(d)* | Validated clinical instruments with strict score boundaries (PHQ-9 0..27, GAD-7 0..21; `src/domain/instruments/phq9.ts`, `src/domain/instruments/gad7.ts`). Strict Zod parsing rejects out-of-range values (`src/lib/schemas.ts`). Missed or skipped rounds ("Not today") store null values and are never coerced to zero, preventing false health calculations (`src/domain/rounds/schedule.ts`, `src/usecases/submit-not-today.ts`). | Hardware sensor accuracy calibration protocols and wearable validation across diverse patient skin tones and movement profiles. |
| **Integrity & Confidentiality**<br>*GDPR Article 5(1)(f) & Article 32* | 1. Shared access decision engine (`src/domain/access/decide.ts`, tested by 126 unit tests in `src/domain/access/__tests__/access.test.ts`).<br>2. Immutable audit trail (`AccessLog` in `prisma/schema.prisma`, `src/usecases/__tests__/access-log-once.test.ts`).<br>3. Hardened security headers: CSP, X-Frame-Options DENY, strict referrer policy (`next.config.ts`, `src/server/security/__tests__/headers.test.ts`).<br>4. AES-256-GCM sealed session cookies (`src/server/security/crypto.ts`, `src/server/auth/session.ts`).<br>5. Pseudonymous identifiers (`Participant.participantCode`, decision D20). | Column-level encryption at rest in PostgreSQL, Hardware Security Module (HSM) for session key management, and third-party penetration testing. |
| **Rights of the Data Subject**<br>*GDPR Articles 15–21 (Access, Erasure, Portability, Objection)* | 1. **Access (Art. 15):** Patient can read their active data via `/api/monitoring/summary`.<br>2. **Erasure (Art. 17):** Database schema enforces cascading deletion (`onDelete: Cascade` on `Participant`, `prisma/schema.prisma`), deleting all patient rounds and readings while retaining pseudonymous access audit logs for accountability.<br>3. **Portability (Art. 20):** Summary data accessible via JSON endpoint.<br>4. **Objection (Art. 21):** Immediate per-method consent revocation. | Self-service one-click data export archive in FHIR or standardized format, and a formal clinical procedure for processing erasure requests while complying with medical records retention laws. |
| **Automated Decisions & Profiling**<br>*GDPR Article 22* | The warning rule (`src/domain/warning/index.ts`, `src/domain/warning/__tests__/warning.test.ts`) never makes a diagnosis, never prescribes a treatment, and never tells the patient that they have relapsed (decision D31). It produces a high-level notification (`ClinicFlag`) that alerts a human nurse or clinician. A qualified human professional decides whether to call and what steps to take (`NurseCallRecord`, `src/usecases/record-nurse-call.ts`). | Standard operating procedures (SOPs) for clinical staff investigating flags, and ongoing monitoring for algorithmic drift and false alarm rates. |
| **Data Protection by Design & Default**<br>*GDPR Article 25* | Privacy-preserving defaults: optional sensors off by default; processing on-device for cameras and audio (decisions D15, D41); zero localStorage (`src/__tests__/no-local-storage.test.ts`); strict layer isolation ensuring only `src/server/db/` touches the database (`src/__tests__/storage-boundary.test.ts`). | Automated continuous static analysis in CI/CD checking for accidental credential leaks or direct database calls, and privacy engineering peer reviews. |
| **Data Protection Impact Assessment (DPIA)**<br>*GDPR Article 35* | Threat analysis and security architecture documented in `docs/security.md` and `docs/privacy/`. Processing of sensitive mental health data is scoped strictly to post-TMS recovery follow-up. | A formal DPIA document submitted to and approved by the hospital's Data Protection Officer, and consultation with the Finnish Data Protection Ombudsman if residual risks are identified (Article 36). |
| **Processors & International Data Transfers**<br>*GDPR Articles 28 & 44–49* | Primary data resides in the EU (managed PostgreSQL in Helsinki, decision D17, D18). The optional AI nurse brief module (`src/server/verda/client.ts`, decision D44) is disabled by default (`VERDA_AI_ENABLED=false`), runs on EU confidential compute in Helsinki (Verda), strips participant codes before sending, and rejects hallucinated numbers (`src/server/verda/__tests__/verda.test.ts`). Zero transfers to US commercial AI clouds. | Formally signed Data Processing Agreements (DPAs) with Finnish hosting providers and secure network carrier agreements for SMS reminders. |
| **Personal Data Breach Notification**<br>*GDPR Articles 33 & 34* | Access logging (`AccessLog`) records unauthorized read attempts; rate limiting rejects brute force (`src/server/security/`); constant-time comparisons prevent timing attacks (`src/server/security/crypto.ts`). | Incident response playbook defining how the clinic's DPO notifies the Finnish Data Protection Ombudsman within 72 hours via `tietosuoja.fi/ilmoitus-tietoturvaloukkauksesta`, and notifies affected patients without undue delay. |
| **Children's Data**<br>*GDPR Article 8* | Out of scope. The product is designed strictly for adults (18+) who have completed clinical TMS therapy for depression. | Clinical onboarding protocol verifying that participants are at least 18 years of age prior to issuing an enrolment code. |

---

## 2. Not Done in This Build

To remain honest about the hackathon prototype status, the following controls are deliberately incomplete or simulated:

1. **Simulated Electronic Identification:** Patient authentication uses a simulated Finnish strong electronic identification provider (`src/server/auth/eid-provider.ts`, decision D34). A production service must integrate a certified Trust Service Provider (e.g., Suomi.fi e-Identification via Telia, Elisa, or OP bank ID) complying with the eIDAS Regulation.
2. **PostgreSQL Encryption at Rest:** The database connection uses standard PostgreSQL connection strings without database-level transparent data encryption (TDE) or column-level envelope encryption for sensitive health rows.
3. **Hardware MFA for Staff:** Clinic staff sign-in supports simulated or standard 6-digit TOTP (`src/server/auth/totp.ts`), but lacks FIDO2 / WebAuthn hardware security key enforcement (such as YubiKeys).
4. **Single-Node Rate Limiting:** Rate limiting uses an in-memory token bucket (`src/server/security/rate-limit.ts`) which does not synchronize across multi-container or serverless deployments (would require Redis).
5. **Kanta Archive Integration:** The prototype does not connect to the Finnish national patient data repository (Kanta-palvelut / Potilastiedon arkisto) nor does it generate HL7 FHIR clinical records.
6. **Statutory Retention Purging:** Automated cron workflows to purge expired cohorts after statutory retention periods are not implemented; data deletion is currently manual or triggered via cascade on participant deletion.

---

## 3. Finnish and EU Regulatory Landscape (Beyond GDPR)

A real healthcare service operating this product in Finland would need to verify compliance with several additional statutes beyond the GDPR:

1. **Finnish Data Protection Act (Tietosuojalaki 1050/2018):**  
   Specifies national exceptions and powers of the Data Protection Ombudsman, including processing of special categories of personal data in healthcare under Section 6. *(To be checked by a professional.)*
2. **Client and Patient Data Act (Laki sosiaali- ja terveydenhuollon asiakastietojen käsittelystä 703/2023):**  
   Governs the recording, retention, information security classification (A- and B-class systems), and Kanta integration requirements for all information systems handling patient records in Finland. *(To be checked by a professional.)*
3. **Act on the Secondary Use of Health and Social Data (Laki sosiaali- ja terveystietojen toissijaisesta käytöstä 552/2019):**  
   Regulates using aggregated or pseudonymous health data for research, statistics, or algorithmic model development through the data permit authority Findata. *(To be checked by a professional.)*
4. **EU Medical Device Regulation (Regulation (EU) 2017/745, MDR) & MDCG 2019-11 Rev. 1:**  
   Software providing clinical decision support, warning flags, or relapse risk assessment for healthcare professionals may qualify as Medical Device Software (MDSW) under Annex VIII Rule 11 (typically Class IIa), requiring conformity assessment by a Notified Body before clinical deployment. *(To be checked by a professional.)*

---

## 4. Sources

1. **Regulation (EU) 2016/679 (General Data Protection Regulation)**  
   *EUR-Lex URI:* https://eur-lex.europa.eu/eli/reg/2016/679/oj  
   *Article 5(1)(c):* "Personal data shall be: [...] (c) adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed (‘data minimisation’);"  
   *Article 9(1):* "Processing of personal data revealing [...] data concerning health [...] shall be prohibited."  
   *Article 22(1):* "The data subject shall have the right not to be subject to a decision based solely on automated processing [...] which produces legal effects concerning him or her or similarly significantly affects him or her."
2. **Tietosuojalaki (1050/2018)**  
   *Finlex URI:* https://www.finlex.fi/fi/lainsaadanto/2018/1050  
   *Section 1:* "Tällä lailla täsmennetään ja täydennetään [...] yleistä tietosuoja-asetusta [...] ja sen kansallista soveltamista."
3. **Laki sosiaali- ja terveydenhuollon asiakastietojen käsittelystä (703/2023)**  
   *Finlex URI:* https://www.finlex.fi/fi/lainsaadanto/2023/703  
   *Section 1:* "Tämän lain tarkoituksena on yhdenmukaistaa asiakastietojen käsittelyä sosiaali- ja terveydenhuollossa sekä sosiaali- ja terveyspalveluita järjestettäessä ja toteutettaessa."
4. **Laki sosiaali- ja terveystietojen toissijaisesta käytöstä (552/2019)**  
   *Finlex URI:* https://www.finlex.fi/fi/lainsaadanto/2019/552  
   *Section 1:* "Tämän lain tavoitteena on mahdollistaa sosiaali- ja terveystietojen tehokas ja tietoturvallinen käsittely toissijaisissa käyttötarkoituksissa."
5. **Regulation (EU) 2017/745 (Medical Device Regulation)**  
   *EUR-Lex URI:* https://eur-lex.europa.eu/eli/reg/2017/745/oj  
   *Article 2(1):* Medical device means any instrument, apparatus, software intended by the manufacturer to be used for human beings for diagnosis, prevention, monitoring, prediction, prognosis, treatment or alleviation of disease.
6. **Office of the Data Protection Ombudsman (Tietosuojavaltuutetun toimisto)**  
   *Contact Information:* https://tietosuoja.fi/en/contact-information  
   *Notification of Personal Data Breach:* https://tietosuoja.fi/ilmoitus-tietoturvaloukkauksesta
