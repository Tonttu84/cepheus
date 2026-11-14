# Feasibility and Rules for an LLM-Generated Nurse Brief

Checked 2026-11-14. This report evaluates using an open-weights large language model to compose a pre-call summary brief for a nurse using pseudonymous derived numbers. Every claim is checked against opened primary sources, or against abstracts where the Sources Cited list says so. Sources that could not be opened support nothing and their claims are moved to "Not checked".

**Key constraint:** The model is provided only derived numeric summaries (e.g. check-in score changes, missed round counts, sleep regularity metrics) and outputs plain descriptive sentences quoting those numbers alongside neutral conversation starters. It never computes risk scores, never alerts autonomously, never alters crisis workflows, and never interprets emotion from voice or facial video.

---

## 1. Faithfulness and Hallucination Guardrails

- **Hallucination Risk:** Generative language models frequently produce plausible but factually incorrect assertions to fill gaps or compensate for missing context (Lee et al., 2024). In clinical documentation, ungrounded assertions create direct safety hazards.
- **Omission Risk:** Models are prone to omitting critical items, particularly findings located at the end of input reports or records exceeding context limits (Lee et al., 2024). In a 5-case simulated clinical study of discharge letters, GPT-4 achieved zero hallucinations when constrained by explicit zero-shot guidelines, but wrote longer text (mean 276 words vs 155 words for junior clinicians) (Tung et al., 2024).
- **Architectural Guardrails:**
  - **Human-in-the-Loop (HITL) Verification:** Automation must not bypass human verification; systems must present the raw source numbers alongside the generated text to allow immediate discrepancy detection (Lee et al., 2024; Tung et al., 2024).
  - **Constrained Extraction & Prompt Engineering:** Using structured prompts and standardized rubrics (such as the SPeC framework) stabilizes outputs and reduces variability (Lee et al., 2024).
- **Verdict:** An LLM must never compute or extrapolate unprovided facts. The generation pipeline must strictly quote deterministic derived inputs and require nurse confirmation before use.

## 2. Clinical Utility, Automation Bias, and Over-trust

- **Documentation Parity & Utility:** In a blinded evaluation by senior primary care physicians (mean experience 34.4 years), letters drafted by an LLM scored higher in information provision (mean 4.32 vs 3.70 on a 5-point scale, P=.03) than those written by junior clinicians, demonstrating documentation feasibility for routine clinical summaries (Tung et al., 2024).
- **Automation Bias:** High risk across all clinician experience levels. In a controlled study of 27 radiologists reading 50 mammograms, incorrect AI suggestions caused accuracy to drop precipitously across every experience tier (Dratsch et al., 2023):
  - Inexperienced readers (n=11): accuracy dropped from 79.7% (with correct AI) to 19.8% (with incorrect AI).
  - Moderately experienced readers (n=11): accuracy dropped from 81.3% to 24.8%.
  - Very experienced readers (n=5): accuracy dropped from 82.3% to 45.5%.
- **Moral Crumple Zone:** Madeleine Clare Elish (2019) demonstrated that in automated systems, legal and moral liability is disproportionately attributed to human operators who have limited control over algorithmic decisions. If a model generates flawed summaries, the reviewing clinician bears the liability as the system's "moral crumple zone."
- **Patient Perceptions:** In a national survey of 11,004 US adults (Pew Research Center, 2023), 60% stated they would feel uncomfortable if their health care provider relied on AI to diagnose disease and recommend treatments. Furthermore, 79% opposed AI usage for mental health support, and 75% expressed concern that healthcare providers are moving too fast to deploy AI before risks are understood.
- **Verdict:** Clinicians are susceptible to automation bias even when experienced. Pre-call briefs must not offer diagnostic assessments or advice, ensuring the clinician exercises full clinical discretion without deferred liability.

## 3. Data Protection (GDPR and Finnish Law)

- **Pseudonymous Data under GDPR:** Under Regulation (EU) 2016/679 (GDPR) Article 4(5), pseudonymised health data remains personal data because it can be attributed to an individual with separate additional information.
- **Special Category Data:** Health metrics constitute special category data under GDPR Article 9(1). Processing for direct clinical care relies on GDPR Article 9(2)(h) (management of health or social care systems and services).
- **Processor Contracts & Safeguards:** Under GDPR Article 28(1) and 28(3), hosting an LLM on third-party cloud infrastructure requires a binding processor agreement specifying documented instructions, confidentiality, and technical/organisational safeguards; hosting alone does not satisfy Article 28. Article 35(1) and 35(3)(b) mandate a Data Protection Impact Assessment (DPIA) when processing health data on a large scale or with new technologies.
- **Data Location & Sub-processors:** All of Verda's data centres are in the EU (Finland) or the EEA (Iceland), under the GDPR (https://trust.verda.com/faq). Verda does not itself initiate transfers of stored data outside the EU/EEA, though some sub-processors may. Of Verda's 12 sub-processors (EU and US), Cloudflare (DNS) sits in front of all traffic, but none process inference inputs for language-model endpoints; Black Forest Labs handles only the FLUX.1 Kontext image model (https://trust.verda.com/subprocessors).
- **Inference Retention & Logging:** Endpoints "can be set up" so model inputs and outputs are never stored or are deleted as soon as processing is done; small requests are held in memory only, while large inputs such as video may be stored on disk temporarily during processing; asynchronous endpoints keep data until fetched; request metadata (non-identifying parameters) is kept for billing (https://trust.verda.com/faq). Linux system logs, including access logs, and connection metadata (IP addresses, packet counts) are kept for 365 days; transmitted data is not stored. Deleted storage volumes have a 96-hour grace period before permanent deletion, unless deleted permanently at once (https://trust.verda.com/faq).
- **Design Consequence:** We must configure the endpoint so inputs and outputs are not stored, use a synchronous endpoint, and treat the 365-day connection metadata (our server's IP address, not patient data) as acceptable. Hosting alone does not satisfy Article 28; a processor agreement is still needed.
- **Finnish Health Data Context:** The Finnish Act on the Secondary Use of Health and Social Data (Laki sosiaali- ja terveystietojen toissijaisesta käytöstä 552/2019) governs secondary use (research, statistics, teaching, development) under Findata oversight and requires certified secure environments (Section 20). Direct patient care by a treating healthcare provider is primary use, which falls under general healthcare client data legislation rather than Act 552/2019 secondary use permits.
- **Verdict:** Pre-call brief generation for direct care must operate under GDPR Article 9(2)(h), a signed Article 28 processor agreement (hosting alone does not suffice), and strict data minimisation (configuring synchronous endpoints with zero input/output retention and treating 365-day server connection metadata as acceptable). Any reuse for model fine-tuning or analytics triggers secondary use requirements under Finnish Act 552/2019.

## 4. Regulation: Medical Device and AI Act

- **EU Medical Device Regulation (MDR 2017/745):**
  - **Rule 11 (Annex VIII, Section 6.3):** Software intended to provide information used to take decisions with diagnosis or therapeutic purposes is classified as Class IIa (or higher if decisions could cause serious deterioration or death). Software intended to monitor physiological processes is Class IIa. All other software is Class I.
  - **MDCG 2019-11 Guidance:** Software whose function is limited to storage, archival, communication, or simple data retrieval without creating new medical information is not qualified as Medical Device Software (MDSW). To remain outside Class IIa MDSW qualification, the brief generator must strictly reformat existing numbers without diagnostic interpretation, risk stratification, or clinical triage recommendations.
- **EU AI Act (Regulation (EU) 2024/1689):**
  - **High-Risk Classification (Article 6(1)):** An AI system is high-risk if it is a product or safety component covered by EU harmonisation laws (Annex I, including MDR 2017/745) and requires a third-party conformity assessment (which applies to MDR Class IIa and above). Under Article 113(c), Article 6(1) obligations for Annex I products apply from 2 August 2027.
  - **Human Oversight (Article 14):** Systems must allow individuals overseeing the tool to fully understand limitations, disregard outputs, and intervene or stop processing.
  - **Transparency Obligations (Article 50):** Under Article 50(1), providers must ensure AI systems interacting with individuals inform them that they are interacting with AI. Under Article 50(3), deployers of emotion recognition or biometric categorisation must inform affected individuals. General application of the AI Act begins 2 August 2026 (Article 113).
- **Verdict:** The software must avoid generating diagnostic statements or triage advice to prevent triggering MDR Class IIa classification and subsequent AI Act Article 6(1) high-risk designation.

## 5. The Model (Gemma) and Host (Verda)

- **Gemma Licensing & Use Policy:**
  - Gemma models are governed by the Gemma Terms of Use open-weights license (Hugging Face model card).
  - The Google Gemma Prohibited Use Policy explicitly prohibits using the model for the illegal or unlicensed practice of professions, specifically medical practice, and forbids automated decision-making affecting individual well-being in healthcare without appropriate human oversight.
- **Inference Hardware & Memory Sizing:**
  - Memory requirements for model weights depend on parameter count and precision (Hugging Face Model Memory Anatomy): 16-bit precision requires 2 bytes per parameter (~8 GB for a 4B parameter model); 8-bit precision requires 1 byte per parameter (~4 GB); 4-bit precision requires 0.5 bytes per parameter (~2 GB).
  - A quantized (4-bit or 8-bit) 4B model requires approximately 2 GB to 4 GB for weights, leaving sufficient capacity for KV cache and context processing within 6 GB to 8 GB of GPU VRAM.
- **Cloud Infrastructure (Verda):**
  - Verda is an EU-based cloud provider (NVIDIA Preferred Partner) offering GPU infrastructure powered by 100% renewable energy, with operational presence in Finland (Verda official site). All of Verda's data centres are in the EU (Finland) or the EEA (Iceland), under the GDPR (https://trust.verda.com/faq). Verda does not itself initiate transfers of stored data outside the EU/EEA, though some sub-processors may.
  - Verda provides confidential computing featuring hardware-level isolation (including NVIDIA Blackwell architecture) that prevents host administrators and operators from accessing customer prompts and memory in plaintext.
  - Verda states it is ISO 27001 certified; the trust centre overview also lists GDPR, ISO 27017, ISO 27018, ISO 27701 and SOC 2 (reports on request, not seen) (https://trust.verda.com/faq).
  - Inference services: Endpoints "can be set up" so that model inputs and outputs are never stored or are deleted as soon as processing is done; small requests are held in memory only; large inputs such as video may be stored on disk temporarily during processing; asynchronous endpoints keep the data until the customer fetches it; request metadata (non-identifying parameters) is kept for billing (https://trust.verda.com/faq).
  - Logs and storage volumes: Linux system logs, including access logs, and connection metadata (IP addresses, packet counts) are kept for 365 days; transmitted data is not stored. Deleted storage volumes have a 96-hour grace period before permanent deletion, unless deleted permanently at once (https://trust.verda.com/faq).
  - Sub-processors: Verda lists 12 sub-processors, several in the EU and US (https://trust.verda.com/subprocessors). None of them processes inference inputs except Black Forest Labs, which handles only one image-model product (FLUX.1 Kontext), not the language-model endpoints; Cloudflare (DNS, EU and US) sits in front of all traffic.
  - Design consequence: We must configure the endpoint so inputs and outputs are not stored, use a synchronous endpoint, and treat the 365-day connection metadata (our server's IP address, not patient data) as acceptable. Hosting alone does not satisfy Article 28; a processor agreement is still needed.

## 6. What the Brief Must Never Contain

To comply with MDR boundaries, AI Act rules, and professional licensing limits, the generated text must never contain:
- Diagnostic impressions or clinical labels.
- Relapse predictions or probability estimates.
- Severity categorisations or algorithmic risk scores.
- Treatment recommendations or medication guidance.
- Inferred affect or emotional states from voice, video, or facial metrics.
- Autonomous scheduling, alerting, or triage decisions.

---

## Sources Cited

1. **Regulation (EU) 2016/679 (GDPR)**, Articles 4(5), 9, 28, 35, 89. EUR-Lex: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679 — *read in full*.
2. **Regulation (EU) 2017/745 (MDR)**, Annex VIII Rule 11. EUR-Lex: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32017R0745 — *read in full*.
3. **MDCG 2019-11 Rev. 1**, Guidance on Qualification and Classification of Software in Regulation (EU) 2017/745. European Commission: https://health.ec.europa.eu/document/download/6067380d-fccd-4934-886e-0407f3510ad4_en?filename=mdcg_2019-11_en.pdf — *read in full*.
4. **Regulation (EU) 2024/1689 (AI Act)**, Articles 6, 13, 14, 50, 113. EUR-Lex: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202401689 — *read in full*.
5. **Laki sosiaali- ja terveystietojen toissijaisesta käytöstä (552/2019)**, Finlex: https://www.finlex.fi/fi/lainsaadanto/2019/552 — *read in full*.
6. **Pew Research Center (2023)**, "60% of Americans Would Be Uncomfortable With Provider Relying on AI in Their Own Health Care", N=11,004. https://www.pewresearch.org/science/2023/02/22/60-of-americans-would-be-uncomfortable-with-provider-relying-on-ai-in-their-own-health-care/ — *read in full*.
7. **Tung JYM et al. (2024)**, "Comparison of the Quality of Discharge Letters Written by Large Language Models and Junior Clinicians", *J Med Internet Res*, 26:e57721, PMID: 39047282. https://www.jmir.org/2024/1/e57721/ — *read in full*.
8. **Lee C, Vogt KA, Kumar S. (2024)**, "Prospects for AI clinical summarization to reduce the burden of patient chart review", *Front Digit Health*, 6:1475092, PMID: 39575412. https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2024.1475092/full — *read in full*.
9. **Google Gemma Prohibited Use Policy**, Google AI for Developers: https://ai.google.dev/gemma/prohibited_use_policy — *read in full*.
10. **Google Gemma 2 2B Model Card**, Hugging Face: https://huggingface.co/google/gemma-2-2b — *read in full*.
11. **Hugging Face Transformers Documentation**, "Model Memory Anatomy": https://huggingface.co/docs/transformers/main/en/model_memory_anatomy — *read in full*.
12. **Verda Cloud Infrastructure Overview**, Verda: https://verda.com/ — *read in full*.
13. **Dratsch T et al. (2023)**, "Automation Bias in Mammography: The Impact of Artificial Intelligence BI-RADS Suggestions on Reader Performance", *Radiology*, 307(4):e222176, PMID: 37129447. https://pubs.rsna.org/doi/abs/10.1148/radiol.222176 — *abstract only* (full article requires institutional subscription).
14. **Elish MC (2019)**, "Moral Crumple Zones: Case Studies in High-Level Automation", *Engaging Science, Technology, and Society*, SSRN: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3251478 — *abstract only*.
15. **Medium (2024)**, "Mitigating hallucinations in LLM-generated clinical summaries" — *could not open* (article not found at URL or via index).
16. **Verda Privacy Policy & Data Retention Terms**, https://verda.com/privacy — *could not open* (HTTP 403 access restriction).
17. **Google Health / HAI-DEF Clinical License Terms**, https://health.google/ — *could not open* (access restrictions on terms portal).
18. **Google Gemma Terms of Use direct text**, https://ai.google.dev/gemma/terms — *could not open* (bot detection block on endpoint).
19. **Verda Trust Centre FAQ**, https://trust.verda.com/faq — *read in full (trust centre FAQ / subprocessor list, 14 Nov 2026)*.
20. **Verda Sub-processors**, https://trust.verda.com/subprocessors — *read in full (trust centre FAQ / subprocessor list, 14 Nov 2026)*.

---

## What this supports

- **Constrained descriptive summaries:** Using an open-weights LLM to translate verified numeric metric deltas into concise, structured sentences for clinician review is technically feasible and legally permissible, provided the model does not generate clinical diagnoses or treatment recommendations.
- **Hardware-isolated cloud execution:** Verda's documented confidential computing and certified infrastructure support technical safeguards for pseudonymous data when configured for zero-retention synchronous execution, subject to executing an Article 28 processor agreement (hosting alone does not satisfy Article 28) and reviewing the certification reports.
- **Human oversight safeguards:** Presenting raw input metrics alongside the AI draft supports compliance with EU AI Act Article 14 (human oversight) and directly counters automation bias.

## What this does not support

- **Autonomous clinical assessment:** Generating risk scores, severity judgments, or triage recommendations would qualify the system as Class IIa or higher under MDR Rule 11 and high-risk under AI Act Article 6(1), while violating the Gemma Prohibited Use Policy.
- **Unverified generation:** Relying on unconstrained generative prompts without deterministic validation is unsafe given proven omission and hallucination failure modes in clinical summarization.
- **Blind clinician reliance:** Presenting summaries without raw data risks severe accuracy drops due to automation bias across all clinician seniority levels.

## Not checked

- Claims from the unopened Medium (2024) article regarding specific schema-lock and semantic cross-referencing benchmarks.
- The text of Verda's data processing agreement (Article 28), which the trust centre does not publish (ask compliance@verda.com).
- Verda's certification reports (ISO 27001, ISO 27017, ISO 27018, ISO 27701, and SOC 2), which are available on request and were not seen.
- Specific contractual terms of Google's Health AI Developer Foundations (HAI-DEF) license.
- Licensing terms for Gemma 4 variants under Apache 2.0 (primary repository not opened).
- Empirical hallucination rates of a quantized 4B model specifically on psychiatric check-in metrics.
- Patient perception of AI-generated summaries in post-TMS clinical maintenance.
