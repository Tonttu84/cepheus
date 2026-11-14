# EU-Hosted Verda + Gemma Support (Trail #31)

This module adds an optional, **off-by-default** (`VERDA_AI_ENABLED="false"`) **EU-hosted open-weight Gemma formatter on Verda** while keeping deterministic math in charge of all clinical warnings, thresholds, and safety checks.

## What It Does

1. **Clinician Pre-Call Brief (`/clinic` → `POST /api/ai/nurse-brief`):**
   - Formats pseudonymous broad-area shifts (`check_in`, `sleep`, `daily_routine`) into 3 plain sentences plus 2–3 gentle phone-call openers.
   - Displays the **exact raw source numbers** right above the draft plus an AI-draft transparency notice and human-in-the-loop confirmation checkbox (countering automation bias per Trail #33 `docs/research/10-nurse-brief-model.md`, EU AI Act Art. 14/50, and MDR MDCG 2019-11).
   - **Never** called for `crisis_self_harm` (rejected with `400` at the schema boundary).
2. **Tailored Low-Effort Patient Step (`/patient` → `POST /api/ai/patient-step`):**
   - After deterministic baseline math identifies a mild dip, selects and calmly phrases **one** safe option (`short_walk`, `breathing_space`, `bright_light`, `social_contact`) using pseudonymous past outcomes and broad context.
   - Never displays scores, streaks, or mood labels.

## Safety & Faithfulness Guardrails (`src/domain/ai-support/`)

- **Off by default (`VERDA_AI_ENABLED`):** Unless `VERDA_AI_ENABLED="true"` and Verda credentials are configured, no external inference request is ever made (`deterministic-fallback` runs locally).
- **Zero diagnostic, severity, or relapse claims:** `verifyOutputFaithfulness` blocks diagnosis, relapse, severity/risk-level/triage judgments, treatment recommendations, medication dosing, backfire prompts (`happy memory`, `sad music`, `cold water`), and streaks/scores.
- **Strict number grounding:** Every numeric token in a nurse pre-call brief must match a number present in the deterministic input metrics; otherwise the response is discarded and replaced automatically with a deterministic template (`fallbackUsed: true`).

## Environment Setup

```env
VERDA_AI_ENABLED="false"
VERDA_INFERENCE_URL="https://<your-verda-inference-endpoint>/v1/chat/completions"
VERDA_API_KEY="<your-verda-api-key>"
VERDA_GEMMA_MODEL="google/gemma-3-27b-it"
```
