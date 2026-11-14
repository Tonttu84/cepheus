# EU-Hosted Verda + Gemma Nurse Pre-Call Brief (Trail #31)

This module adds an optional, **off-by-default** (`VERDA_AI_ENABLED="false"`) **EU-hosted open-weight Gemma formatter on Verda** while keeping deterministic math in charge of all clinical warnings, thresholds, and safety checks (Decision `D44`).

## What It Does

1. **Clinician Pre-Call Brief (`/clinic` → `POST /api/ai/nurse-brief`):**
   - Strips `participantCode` completely before any external call (only derived numbers, broad areas, and `sinceDate` leave the server; the local code prepends `Participant <code>:` after verification).
   - Formats shifts into 3 plain sentences plus 2–3 gentle phone-call openers.
   - Displays the **exact raw source numbers** right above the draft plus an AI-draft transparency notice and human-in-the-loop confirmation checkbox (countering automation bias per Trail #33 `docs/research/10-nurse-brief-model.md`, EU AI Act Art. 14/50, and MDR MDCG 2019-11).
   - **Never** called for `crisis_self_harm` (rejected with `400` at the schema boundary).
2. **Patient-Facing Step (`POST /api/ai/patient-step`):**
   - **Disabled by default** (`VERDA_PATIENT_STEP_ENABLED="false"` returns `403`, with no AI panel mounted on `/patient`) because the owner's approval on Trail #31 covered the nurse pre-call brief only.
   - If enabled later, output containing **any digit** (`forbidAllDigits: true`) or forbidden wording is rejected and falls back deterministically.

## Safety & Faithfulness Guardrails (`src/domain/ai-support/`)

- **Off by default (`VERDA_AI_ENABLED`):** Unless `VERDA_AI_ENABLED="true"` and Verda credentials are configured, no external inference request is ever made (`deterministic-fallback` runs locally).
- **Zero diagnostic, severity, or relapse claims:** `verifyOutputFaithfulness` blocks diagnosis, relapse, severity/risk-level/triage judgments, treatment recommendations, medication dosing, backfire prompts (`happy memory`, `sad music`, `cold water`), and streaks/scores.
- **Strict number grounding:** Every numeric token in a nurse pre-call brief must match a number present in the deterministic input metrics; otherwise the response is discarded and replaced automatically with a deterministic template (`fallbackUsed: true`).
- **Safe failure logging:** Network/HTTP/timeout/faithfulness fallbacks log `[verda] Inference fallback triggered` with status/error kind only (never patient IDs, prompts, or API keys).

## Environment Setup

```env
VERDA_AI_ENABLED="false"
VERDA_PATIENT_STEP_ENABLED="false"
VERDA_INFERENCE_URL="https://<your-verda-inference-endpoint>/v1/chat/completions"
VERDA_API_KEY="<your-verda-api-key>"
VERDA_GEMMA_MODEL="google/gemma-3-27b-it"
```
