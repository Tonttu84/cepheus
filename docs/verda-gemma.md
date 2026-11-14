# EU-Hosted Verda + Gemma Support (Trail #31)

This module adds optional **EU-hosted open-weight Gemma inference on Verda** for two mental-health workflow helpers while keeping deterministic math in charge of all clinical alerts and safety checks.

## What It Does

1. **Tailored Low-Effort Patient Step (`/patient` → `POST /api/ai/patient-step`):**
   - After deterministic baseline math identifies a mild dip, selects and calmly phrases **one** safe option (`short_walk`, `breathing_space`, `bright_light`, `social_contact`) using pseudonymous past outcomes and broad context (e.g., low indoor daylight + stationary bout).
   - Never displays scores, streaks, or mood labels.
2. **Clinician Pre-Call Brief (`/clinic` → `POST /api/ai/nurse-brief`):**
   - Summarizes pseudonymous broad-area shifts (`check_in`, `sleep`, `daily_routine`) into 3 plain sentences plus 2–3 gentle phone-call openers.
   - **Never** called for `crisis_self_harm` (rejected with `400` at the schema boundary).

## Safety & Faithfulness Guardrails (`src/domain/ai-support/`)

- **Zero diagnostic or relapse claims:** `verifyOutputFaithfulness` blocks any output mentioning diagnosis, relapse, predictions, medication dosing, backfire prompts (`happy memory`, `sad music`, `cold water`), or streaks/scores.
- **Strict number grounding:** Every numeric token in a nurse pre-call brief must match a number present in the deterministic input metrics; otherwise the response is discarded and replaced automatically with a deterministic template (`fallbackUsed: true`).
- **Graceful offline fallback:** When `VERDA_INFERENCE_URL` / `VERDA_API_KEY` are empty or Verda times out (> 8s), the app falls back to `selectDeterministicPatientStep` / `buildDeterministicNurseBrief`.

## Environment Setup

```env
VERDA_INFERENCE_URL="https://<your-verda-inference-endpoint>/v1/chat/completions"
VERDA_API_KEY="<your-verda-api-key>"
VERDA_GEMMA_MODEL="google/gemma-3-27b-it"
```
