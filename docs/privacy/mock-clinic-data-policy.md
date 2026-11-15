# Clinic Data Protection Policy (Mock)

> **Draft for a hackathon demonstration. Written by an AI agent, not reviewed by a lawyer, not legal advice.**

This policy governs clinical and administrative staff using the Cepheus post-TMS wellbeing monitoring system at `[Clinic Name]`.

---

## 1. Staff Roles and Authorisation

Access to patient monitoring data is strictly role-based and requires two-factor authentication (TOTP):

- **Staff Nurse (`nurse`):** Authorized to review open clinical flags, acknowledge crisis events, and conduct telephone outreach calls for assigned patients.
- **Treating Clinician / Physician (`clinician`):** Authorized to review flagged patient trajectories, decide on TMS booster clusters or referrals, and supervise follow-up care.
- **Clinic Administrator (`admin`):** Authorized to manage staff accounts, configure clinic settings, and inspect system audit logs. Administrators have no access to clinical flags or patient health records.

Staff may only access records for patients under their direct clinical responsibility. Casual browsing of participant trajectories without a clinical reason is strictly prohibited.

---

## 2. When Staff May Open a Patient Flag

A staff member may open a participant's flag view only under the following conditions:

1. **Automated Warning Flag:** The system has raised a `ClinicFlag` because a participant's check-in answers dropped below baseline for two consecutive rounds, or two consecutive rounds went unanswered while passive sensors remained active (decision D7).
2. **Urgent Crisis Event:** A `CrisisEvent` was generated due to a positive response on PHQ-9 item 9 (thoughts of self-harm), requiring immediate clinical review and outreach (decision D9).
3. **Scheduled Clinical Review:** Conducting an agreed weekly or fortnightly follow-up check during the post-TMS window.

Every opening of a patient record is automatically evaluated by the access control engine (`src/domain/access/decide.ts`) and permanently recorded.

---

## 3. The Access Audit Log

All access decisions—both permitted and refused—are recorded in an immutable audit ledger (`AccessLog` in `prisma/schema.prisma` lines 265–285):

- **Logged Fields:** Actor ID, staff role, pseudonymous `patientCode`, action (`read`, `write`, `delete`), resource kind, declared clinical purpose, timestamp, and decision result (`allowed: true/false`).
- **Zero Health Data in Log:** The access log records only that a record was inspected; it never contains questionnaire answers, scores, or sensor numbers.
- **Permanent Retention:** The audit log survives participant record deletion to satisfy statutory healthcare accountability requirements under GDPR Article 5(1)(f) and the Finnish Client and Patient Data Act (703/2023).
- **Audit Reviews:** The Data Protection Officer regularly reviews access logs for unauthorized access patterns or out-of-hours lookups.

---

## 4. What Staff Never See (Data Boundaries)

By design, the application hides raw and sensitive metrics from clinical staff (decisions D8, D45):

- **No Individual Questionnaire Answers:** Staff cannot view item-by-item answers (e.g. items 1–8 of PHQ-9). Staff see only the aggregate total score and whether a flag or crisis was triggered.
- **No Raw Sensor Numbers or Graphs:** Staff see only broad affected life areas (such as `sleep regularity`, `daily routine`, or `check-in consistency`) and the onset date (`sinceDate`). Raw step numbers, hourly activity floats, and actigraphy charts are not displayed to clinic staff.
- **No Camera Video or Audio:** Video frames and audio streams are processed exclusively on the patient's device and are never transmitted to or viewable by the clinic.
- **No Free-Text Clinical Narratives:** The app does not support open-ended text notes. Detailed psychiatric consultation notes must be entered directly into the hospital's certified electronic health record (EHR / Kanta archive), not in this monitoring tool.

---

## 5. Post-Call Documentation and Clinical Outcomes

Following a nurse phone outreach triggered by a flag, the nurse must record the structured outcome in the system within one working day (`NurseCallRecord`, `src/usecases/record-nurse-call.ts`):

- **Call Status:** `completed` or `unreachable`.
- **Outcome Tier:** Must be categorized as one of: `rough_patch`, `sustained_decline`, `full_relapse`, `crisis`, or `false_alarm`.
- **Action Taken:** Structured clinical action: `advice_and_medication_check`, `booster_tms_cluster`, `new_tms_course_referral`, `urgent_care`, or `none`.
- **Medication Checked:** Boolean verification that current psychiatric medications were discussed.
- **Planned Boosters:** Number of booster TMS sessions scheduled, if indicated.

This structured workflow prevents unstructured personal health notes from accumulating in the monitoring database.

---

## 6. Data Retention and Archiving

- **Active Monitoring Episode:** Data is retained during the 8-to-12-week post-TMS monitoring episode.
- **Discharge:** Upon completion or withdrawal, active monitoring flags are resolved.
- **Medical Records Archive:** Clinical summary outcomes are transferred to the clinic's primary electronic medical record. Monitoring micro-data is purged or anonymized in accordance with the clinic's data retention schedule and Finnish healthcare archival regulations.

---

## 7. Incident Response (What to Do When Something Goes Wrong)

Any suspected data breach, unauthorized access, or loss of an administrative device must be reported immediately:

1. **Internal Notification:** Report the incident immediately to the Clinic Information Security Officer and Data Protection Officer at `[dpo@clinic-domain.example]`.
2. **Containment:** The system administrator must immediately revoke affected session cookies, rotate device webhook credentials, and temporarily suspend compromised staff accounts.
3. **72-Hour Authority Notification:** If personal data is compromised and presents a risk to patients, the DPO must notify the Office of the Data Protection Ombudsman (*Tietosuojavaltuutetun toimisto*) within 72 hours via the official notification portal (`https://tietosuoja.fi/ilmoitus-tietoturvaloukkauksesta`) under GDPR Article 33.
4. **Patient Notification:** If the breach presents a high risk to patients' rights (such as compromised psychiatric records), affected individuals must be notified without undue delay under GDPR Article 34.
