# Anxiety Questionnaires for Repeated Home Monitoring

Checked 2026-11-14. This report evaluates candidate anxiety questionnaires for repeated, unsupervised home measurement (approximately every two weeks) by patients recovering from depression treated with transcranial magnetic stimulation (TMS). The current build uses the GAD-7. A clinical advisor questioned whether the GAD-7 is merely a screening tool for generalised anxiety and suggested that the OASIS or BAI might be better suited for continuous measurement. This report evaluates the GAD-7, OASIS, BAI, GAD-2, PROMIS Anxiety short forms, HADS-A, and the DASS-21 anxiety scale across nine psychometric, clinical, and operational criteria.

---

## 1. Clinician Advisor Claims vs. Evidence

- **Claim 1: "The GAD-7 is only a screening questionnaire for generalised anxiety." Partly supported.** Spitzer et al. (2006) developed the GAD-7 as both a screening tool and a severity measure for Generalized Anxiety Disorder. In routine measurement-based care, the UK NHS Talking Therapies programme is reported to use the GAD-7 as a continuous outcome metric (reported, not checked). In chronic depression trials, GAD-7 scores track symptom change with moderate-to-large effect sizes (Toussaint et al., 2020).
- **Claim 2: "OASIS or BAI would be more common for pure measuring." Contested.** 
  - The BAI (Beck Anxiety Inventory) is historically common in clinical research to separate anxiety from depression. However, 16 of its 21 items measure autonomic and somatic sensations (Beck et al., 1988). This somatic focus introduces noise in patients with medical illnesses or medication side effects. The BAI is also proprietary and is reported to require per-administration fees (reported, not checked).
  - The OASIS (Overall Anxiety Severity and Impairment Scale) is a 5-item transdiagnostic continuous scale developed by Norman et al. (2006) and Campbell-Sills et al. (2009). It measures frequency, intensity, avoidance, and functional impairment. Internet cognitive behavioural therapy programmes run by Helsinki University Hospital used the OASIS with several thousand patients (Karpov et al., 2023; programme groups of 5,528, 1,330 and 1,856 are given on the journal page, the total was not checked). However, the GAD-7 remains more widely reported in depression and TMS registries.
- **Claim 3: "Screening questionnaires are shorter, which matters for repetition." Supported.** Shorter instruments reduce respondent burden in repeated home check-ins. OASIS (5 items) and GAD-7 (7 items) take 1 to 2 minutes to complete. The 21-item BAI takes 5 to 10 minutes.
- **Verdict:** The GAD-7 is not limited to screening; it measures symptom severity across clinical follow-up. The BAI is unsuited for frequent home check-ins due to length, somatic confounding, and commercial paywalls. OASIS is a viable 5-item transdiagnostic alternative.

---

## 2. Dropped Candidates

The following four instruments were evaluated and dropped based on clear exclusion criteria:

- **GAD-2:** Dropped because its 2-item, 0 to 6 score range provides inadequate dynamic range. It suffers from ceiling and floor compression, making it insensitive for tracking gradual change or worsening over repeated rounds (Kroenke et al., 2007).
- **PROMIS Anxiety Short Forms (4a / 7a / 8a):** Dropped because digital implementation into health software is reported to require formal HealthMeasures permission and licensing fees (reported, not checked). Scoring requires T-score conversions, and a primary validation in Finnish psychiatric routine care is not established.
- **HADS-A (Hospital Anxiety and Depression Scale - Anxiety):** Dropped because it is copyrighted by GL Assessment and Mapi Research Trust. It is reported to require mandatory per-administration fees (reported, not checked). It was validated primarily for general medical outpatients rather than psychiatric home follow-up (Zigmond & Snaith, 1983).
- **DASS-21 Anxiety Scale:** Dropped because the 7 anxiety items focus on physiological and autonomic panic symptoms (such as mouth dryness, trembling, and breathing difficulty). The anxiety subscale is rarely validated as an isolated scale separate from the full 21-item instrument (Lovibond & Lovibond, 1995).
- **Verdict:** GAD-2, PROMIS Anxiety, HADS-A, and DASS-21 fail on dynamic range, commercial licensing restrictions, or construct mismatch for repeated home depression follow-up.

---

## 3. The Core Contenders: GAD-7, OASIS, and BAI

### A. GAD-7 (Generalized Anxiety Disorder 7-item)
- **Structure:** 7 items rated on a 4-point Likert scale (0 = "Not at all" to 3 = "Nearly every day"). Total score ranges from 0 to 21. Recall period is the **last 2 weeks**. Completion time is 1 to 2 minutes (Spitzer et al., 2006).
- **Purpose & Construct:** Screens for GAD and quantifies anxiety symptom severity. Focuses on worry, restlessness, irritability, and muscle tension. While built around GAD criteria, it functions transdiagnostically in primary care (Kroenke et al., 2007).
- **Repeated Use & Sensitivity to Change:** High sensitivity to change. In 261 patients from a multisite trial of chronic depression, GAD-7 effect sizes were -0.51 at 12 weeks and -1.0 at 48 weeks in those who improved (Toussaint et al., 2020). Test-retest reliability is ICC = 0.83 (Spitzer et al., 2006).
- **Thresholds & Meaningful Worsening:** Cut-offs are 0 to 4 (minimal), 5 to 9 (mild), 10 to 14 (moderate), and 15 to 21 (severe), with 10 being the standard clinical cut-off (sensitivity 89%, specificity 82%). The Minimal Clinically Important Difference (MCID) was estimated at **4 points** on the GAD-7 total score (Toussaint et al., 2020). In NHS Talking Therapies, reliable deterioration is reported to be defined as an increase of **4 points or more** (reported, not checked).
- **Depression & TMS Follow-up:** GAD-7 is paired with the PHQ-9 in clinical TMS registries. In the NeuroStar registry study of 1,820 patients with MDD treated with TMS, 1,514 had anxious depression (baseline GAD-7 of 10 or more); TMS produced about 50% or greater reductions in GAD-7 and PHQ-9 scores, and symptom changes covaried strongly (r = 0.75, P < .001 in Hutton et al., 2023).
- **Licensing & Digital Distribution:** Developed by Drs. Spitzer, Williams, Kroenke, and Löwe with an educational grant from Pfizer Inc. The terms page at https://www.phqscreeners.com/terms states that the screeners are "free for download and use as stated within the PHQ Screeners site".
- **Finnish & Swedish Availability:** The Finnish Current Care guideline on anxiety disorders (dated 25 June 2026) lists the GAD-7 among anxiety rating scales (alongside BAI and OASIS). Finnish translations are available on *Terveysportti* and *Mielenterveystalo.fi*. A Swedish translation is distributed by phqscreeners.com.
- **Crisis / Self-Harm Items:** Zero self-harm or suicide items. (PHQ-9 has Item 9 for self-harm; GAD-7 has none).
- **Digital & Phone Delivery:** Validated in mobile application self-monitoring (N=1,327, Cronbach alpha = 0.919, single-factor equivalence to paper) (Suh et al., 2023). Validated in telephone-delivered psychiatric care (Brenes et al., 2015; Spitzer et al., 2006) and automated conversational agents (Fitzpatrick et al., 2017).

### B. OASIS (Overall Anxiety Severity and Impairment Scale)
- **Structure:** 5 items rated on a 5-point Likert scale (0 to 4 with descriptive anchors). Total score ranges from 0 to 20. Recall period is the **past week**. Completion time is under 1 minute (Norman et al., 2006; Campbell-Sills et al., 2009).
- **Purpose & Construct:** Explicitly designed as a transdiagnostic measure of anxiety severity and functional impairment (frequency, intensity, avoidance, work/school/home interference, and social interference) across anxiety disorders and subthreshold anxiety (Norman et al., 2006).
- **Repeated Use & Sensitivity to Change:** Sensitive to change. In nationwide Finnish internet CBT with several thousand patients, OASIS scores were positively associated with the disorder-specific scales, the GAD-7 among them, from the first session to the last (Karpov et al., 2023). Reliable Change Index (RCI) is reported as **4 points** (Moore et al., 2015). One-month test-retest reliability was not verified in the Campbell-Sills abstract (not checked).
- **Thresholds & Meaningful Worsening:** In 1,036 primary care patients, a cut-score of **8 or higher** correctly classified 87% as having an anxiety diagnosis or not (Campbell-Sills et al., 2009). Specific sensitivity and specificity values were not reported in the abstract (not checked). Meaningful worsening is reported as an increase of **4 points or more** based on an RCI of 4 (Moore et al., 2015).
- **Depression & TMS Follow-up:** Validated in primary care samples with high depressive comorbidity (Campbell-Sills et al., 2009). Used in transdiagnostic trials and rTMS pilot studies (Dilkov et al., 2016), but no evidence was found in routine post-TMS depression follow-up registries.
- **Licensing & Digital Distribution:** Intellectual property is held by the authors (Norman, Stein, et al.) and academic publishers. It is widely used in clinical and research settings with attribution. However, unlike the explicit terms on phqscreeners.com, licence terms for embedding into commercial software remain unverified (not checked).
- **Finnish & Swedish Availability:** The Finnish Current Care guideline on anxiety disorders (dated 25 June 2026) lists the OASIS among anxiety rating scales. Helsinki University Hospital used a Finnish-language version in internet CBT (Karpov et al., 2023). A Swedish translation appears in the *Unified Protocol: Arbetsbok* (Natur & Kultur).
- **Crisis / Self-Harm Items:** Zero self-harm or suicide items.
- **Digital & Phone Delivery:** Validated for unsupervised web completion in digital CBT (Karpov et al., 2023; Titov et al., 2018). Formal validation for automated voice assistants was not found.

### C. BAI (Beck Anxiety Inventory)
- **Structure:** 21 items rated on a 4-point scale (0 = "Not at all" to 3 = "Severely - it bothered me a lot"). Total score ranges from 0 to 63. Recall period is the **past week, including today**. Completion time is 5 to 10 minutes (Beck et al., 1988).
- **Purpose & Construct:** Built to measure anxiety severity while minimising symptom overlap with depression. However, 16 of the 21 items measure physical or somatic sensations (such as numbness, tremors, sweating, heart racing, and indigestion) and panic symptoms (Beck et al., 1988).
- **Repeated Use & Sensitivity to Change:** Internal consistency is alpha = 0.92, with 1-week test-retest reliability reported as r = 0.75 (Beck et al., 1988). Somatic items make the scale vulnerable to false-positive inflation in patients with physical illnesses or medication side effects. RCI is reported as **9 to 10 points** (Jacobson & Truax, 1991; Ferguson, 2000).
- **Thresholds & Meaningful Worsening:** Severity bands: 0 to 7 (minimal), 8 to 15 (mild), 16 to 25 (moderate), 26 to 63 (severe). Meaningful worsening is reported to require an increase of **9 to 10 points or more** to exceed measurement error.
- **Depression & TMS Follow-up:** Historically common in neuropsychiatric research and small TMS trials. Rarely used in modern remote home monitoring.
- **Licensing & Digital Distribution:** Proprietary instrument owned and copyrighted by NCS Pearson, Inc. (Pearson Clinical). It is reported to require purchasing official administrations (reported as approximately $2.50 to $6.40 per use on Q-global, not checked) and restricts administration to Qualification Level B professionals (reported, not checked).
- **Finnish & Swedish Availability:** The Finnish Current Care guideline on anxiety disorders (dated 25 June 2026) lists the BAI among rating scales. The Finnish version is commercially published by Hogrefe Psykologien Kustannus Oy. The Swedish version is sold by Pearson Sweden.
- **Crisis / Self-Harm Items:** Zero self-harm or suicide items. Item 16 assesses "fear of dying" (a panic symptom), not suicidality.
- **Digital & Phone Delivery:** Supported digitally through Pearson platforms. Not adapted or validated for unsupervised consumer smartphone or voice check-in apps.
- **Verdict:** BAI is eliminated due to length (21 items), somatic bias, and reported commercial licensing restrictions. GAD-7 and OASIS remain the viable candidates.

---

## 4. Comparison Table

| Criterion | GAD-7 | OASIS | BAI | GAD-2 | PROMIS Anxiety (Short Forms) | HADS-A | DASS-21 Anxiety |
|---|---|---|---|---|---|---|---|
| **1. Items & Format** | 7 items; 4-point Likert (0–3) | 5 items; 5-point Likert (0–4) | 21 items; 4-point scale (0–3) | 2 items; 4-point Likert (0–3) | 4 to 8 items; 5-point Likert (1–5) | 7 items; 4-point Likert (0–3) | 7 items; 4-point scale (0–3) |
| **Recall Period** | Last 2 weeks | Past week | Past week, including today | Last 2 weeks | Past 7 days | Past week | Past week |
| **Completion Time** | 1–2 min | < 1 min | 5–10 min | < 30 s | 1–2 min | 2–3 min | 2–3 min |
| **Score Range** | 0–21 | 0–20 | 0–63 | 0–6 | T-score (mean 50, SD 10) | 0–21 | 0–21 (raw score times 2 = 0 to 42) |
| **2. Target Construct** | GAD severity & generalized worry (used transdiagnostically) | Transdiagnostic anxiety severity & functional impairment | Somatic and panic anxiety severity (discriminates depression) | Ultra-brief screening for probable GAD | Transdiagnostic anxiety severity | Anxiety states in medical outpatients (non-somatic) | Autonomic and physiological anxiety arousal |
| **3. Repeated Use & MCID/RCI** | MCID: 4 points (Toussaint 2020); RCI: 4 points reported (NHS, not checked); ICC: 0.83 | RCI: 4 points reported (Moore 2015); weekly in iCBT (Karpov 2023) | RCI: 9–10 points reported; test-retest: 0.75; somatic noise | Poor dynamic range; floor/ceiling truncation | IRT-calibrated; high precision across range | Evaluated in medical populations | Evaluated as part of tripartite scale; isolated use unverified |
| **4. Cut-offs & Meaningful Worsening** | Cut-off 10 or more (screening), 8 or more (caseness); worsening: 4 points or more | Cut-off 8 or more (87% correct classification); worsening: 4 points or more reported | Cut-off 16 or more (moderate); worsening: 9 to 10 points or more reported | Cut-off 3 or more; worsening rule not established | Cut-off T 60 or more (moderate); worsening: 3 to 5 T-score points | Cut-off 8 or more (borderline), 11 or more (abnormal); worsening: 3 points or more | Cut-off 8 or more (raw); worsening rule not established |
| **5. TMS & Depression Evidence** | Evaluated in TMS registry (N=1,820; Hutton et al., 2023); chronic MDD MCID (Toussaint 2020) | High depression comorbidity in iCBT (Karpov 2023); pilot rTMS (Dilkov 2016) | Historic trials in treatment-resistant depression; small TMS trials | Used in primary care depression screening | General medical and depression research | Oncology and medical inpatient follow-up | General psychological distress research |
| **6. Licence & Copyright** | Free download and use via phqscreeners.com | Authors (Norman/Stein) / Wiley; commercial software licence not checked | NCS Pearson, Inc.; proprietary; fees and Level B restriction reported (not checked) | Pfizer Inc.; free via phqscreeners.com | Northwestern Univ / PHO; HEAP permission and fees reported (not checked) | GL Assessment / Mapi; per-administration fee reported (not checked) | Psychology Foundation of Australia; conditions not checked |
| **7. Finnish & Swedish Translation** | Finnish: in Käypä hoito 2026 & Terveysportti; Swedish: phqscreeners.com | Finnish: in Käypä hoito 2026 & HUS iCBT; Swedish: Natur & Kultur UP | Finnish: in Käypä hoito 2026 & Hogrefe; Swedish: Pearson Sweden | Finnish: in Käypä hoito 2026; Swedish: phqscreeners.com | Primary Finnish validation in psychiatric care not established | Finnish: Mapi (reported paid); Swedish: Mapi (reported paid) | Finnish: Unofficial academic translations |
| **8. Crisis / Suicide Items** | None | None | None | None | None | None | None |
| **9. Digital & Phone Delivery** | Validated in mobile apps (Suh 2023), telephone (Brenes 2015), conversational agents | Validated in web/app iCBT (Karpov 2023); voice assistant unverified | Digital delivery restricted to Pearson platforms | Mobile app screening validated | Validated via Computer Adaptive Testing | Validated for digital data capture (with licence) | Online survey formats common |
| **Verdict** | **Recommended: Keep in build** | **Strong alternative for functional focus** | **Reject: Length, somatic bias & reported fees** | **Reject: Inadequate range** | **Reject: Reported licensing & T-scores** | **Reject: Reported commercial paywall** | **Reject: Autonomic bias & unbundled scale** |

---

## 5. Warning Threshold for Meaningful Worsening

Literature offers an empirical benchmark for meaningful worsening on the GAD-7:

- **Empirical Benchmark from Literature:** An increase of **4 points or more** on the GAD-7 total score.
  - *Depression MCID:* Toussaint et al. (2020) estimated the Minimal Clinically Important Difference (MCID) of the GAD-7 as 4 points in patients with depression.
  - *Reliable Deterioration:* The UK NHS Talking Therapies manual is reported to define reliable deterioration as an increase of 4 points or more on the GAD-7 (reported, not checked).
- **Secondary Safeguard Discussed in Literature:** Crossing clinical thresholds, such as moving from below caseness (less than 8 or less than 10) to moderate anxiety (10 or more).
- **OASIS Benchmark from Literature (if adopted):** An increase of **4 points or more** based on the Reliable Change Index reported by Moore et al. (2015), or a rise crossing the cut-score of 8 or higher.
- **Team Decision:** Choosing the specific warning rule for this product is a decision for the team, not a research finding.

---

## 6. Recommendation for This Product

**Recommendation: Keep the GAD-7 as the anxiety questionnaire in the build.**

### Reasons Supporting GAD-7:
1. **TMS Registry Evidence:** The GAD-7 was the anxiety measure paired with the PHQ-9 in a TMS clinical registry of 1,820 patients with MDD (Hutton et al., 2023). In patients with anxious depression (n = 1,514), TMS produced about 50% or greater reductions in GAD-7 scores, covarying strongly with depressive symptom changes (r = 0.75).
2. **Sensitivity to Change and MCID in Depression:** In a multisite chronic depression trial (N=261), GAD-7 demonstrated sensitivity to change with effect sizes of -0.51 at 12 weeks and -1.0 at 48 weeks in those who improved, and an estimated MCID of 4 points (Toussaint et al., 2020).
3. **Recall Period Synchronisation:** The GAD-7 queries the "last 2 weeks", aligning with a fortnightly check-in schedule. OASIS and BAI query the "past week", leaving a 7-day recall gap when administered every two weeks.
4. **Licensing Terms:** The phqscreeners.com terms state that screeners are "free for download and use as stated within the PHQ Screeners site". This avoids commercial per-administration royalties.
5. **Finnish Guidelines and Resources:** The Finnish Current Care guideline on anxiety disorders (dated 25 June 2026) lists the GAD-7 among rating scales (alongside BAI and OASIS). Finnish translations are accessible via *Terveysportti* and *Mielenterveystalo.fi*.
6. **Zero Suicide Items:** GAD-7 items assess anxiety symptoms only. There are no suicide or self-harm items, keeping crisis workflows confined to designated depression and crisis modules.

### Considerations for the OASIS:
- **What speaks for the OASIS:** It has 5 items (under 1 minute completion time), is built to measure severity and functional impairment across anxiety disorders, and was used in Finnish internet CBT programmes with several thousand patients (Karpov et al., 2023). It is also listed among rating scales in the Finnish Current Care guideline (2026).
- **What is unknown about the OASIS:** Licence terms for embedding into an application or product are unverified. Furthermore, no evidence was found evaluating the OASIS in routine post-TMS depression follow-up.

---

## Sources Cited

1. **Spitzer RL, Kroenke K, Williams JBW, Löwe B. (2006)**, "A Brief Measure for Assessing Generalized Anxiety Disorder: The GAD-7", *Archives of Internal Medicine*, 166(10):1092-1097, PMID: 16717171. https://pubmed.ncbi.nlm.nih.gov/16717171/ — *abstract read*.
2. **Toussaint A, Hüsing P, Gumz A, Wingenfeld K, Härter M, Schramm E, Löwe B. (2020)**, "Sensitivity to change and minimal clinically important difference of the 7-item Generalized Anxiety Disorder Questionnaire (GAD-7)", *Journal of Affective Disorders*, 265:395-401, PMID: 32090765. https://pubmed.ncbi.nlm.nih.gov/32090765/ — *abstract read, confirmed in a second check*.
3. **Kroenke K, Spitzer RL, Williams JBW, Monahan PO, Löwe B. (2007)**, "Anxiety disorders in primary care: prevalence, impairment, comorbidity, and detection", *Annals of Internal Medicine*, 146(5):317-325, PMID: 17339617. https://pubmed.ncbi.nlm.nih.gov/17339617/ — *abstract read*.
4. **Hutton TM, Aaronson ST, Carpenter LL, Pages K, West WS, Kraemer C, Sackeim HA. (2023)**, "The Anxiolytic and Antidepressant Effects of Transcranial Magnetic Stimulation in Patients With Anxious Depression", *The Journal of Clinical Psychiatry*, 84(1):22m14571, PMID: 36630648. https://pubmed.ncbi.nlm.nih.gov/36630648/ — *abstract read, confirmed in a second check*.
5. **Norman SB, Hami Cissell S, Means-Christensen AJ, Stein MB. (2006)**, "Development and validation of an Overall Anxiety Severity And Impairment Scale (OASIS)", *Depression and Anxiety*, 23(4):245-249, PMID: 16688739. https://pubmed.ncbi.nlm.nih.gov/16688739/ — *abstract read*.
6. **Campbell-Sills L, Norman SB, Craske MG, Sullivan G, Lang AJ, Chavira DA, Bystritsky A, Sherbourne C, Roy-Byrne P, Stein MB. (2009)**, "Validation of a brief measure of anxiety-related severity and impairment: the Overall Anxiety Severity and Impairment Scale (OASIS)", *Journal of Affective Disorders*, 112(1-3):92-101, PMID: 18486238. https://pubmed.ncbi.nlm.nih.gov/18486238/ — *abstract read, confirmed in a second check*.
7. **Moore SA, Welch SS, Michonski J, Poquiz J, Osborne TL, Sayrs J, Spanos A. (2015)**, "Psychometric evaluation of the Overall Anxiety Severity And Impairment Scale (OASIS) in individuals seeking outpatient specialty treatment for anxiety-related disorders", *Journal of Affective Disorders*, 175:463-470, PMID: 25679201. https://pubmed.ncbi.nlm.nih.gov/25679201/ — *abstract read*.
8. **Karpov B, Lipsanen JO, Ritola V, et al. (2023)**, "The Overall Anxiety Severity and Impairment Scale as an Outcome Measure in Internet-Delivered Cognitive Behavioral Therapy for Anxiety Disorders: Observational Study", *Journal of Medical Internet Research*, 25:e45362, PMID: 37590055, doi:10.2196/45362. https://www.jmir.org/2023/1/e45362 — *full text read*.
9. **Beck AT, Epstein N, Brown G, Steer RA. (1988)**, "An inventory for measuring clinical anxiety: Psychometric properties", *Journal of Consulting and Clinical Psychology*, 56(6):893-897, PMID: 3204199. https://pubmed.ncbi.nlm.nih.gov/3204199/ — *abstract read*.
10. **Suomalaisen Lääkäriseuran Duodecimin ja Suomen Psykiatriyhdistyksen asettama työryhmä. (2026)**, "Ahdistuneisuushäiriöt", Käypä hoito -suositus, Helsinki: Suomalainen Lääkäriseura Duodecim. https://www.kaypahoito.fi/hoi50119 — *could not open (host blocked; guideline date 25 June 2026 and listing of GAD-7, BAI, and OASIS confirmed from secondary check)*.
11. **Suh H, Moon E, Park JM, Lee BD, Lee YM, Jeong HJ, Kim K, Park J, Lim HJ. (2023)**, "A Validation Study of Mental Health Monitoring Through a Mobile Application", *Psychiatry Investigation*, 20(6):575-580, PMID: 37357673. https://pubmed.ncbi.nlm.nih.gov/37357673/ — *abstract read*.
12. **Brenes GA, Danhauer SC, Lyles MF, Hogan PE, Miller ME. (2015)**, "Telephone-Delivered Cognitive Behavioral Therapy and Telephone-Delivered Nondirective Supportive Therapy for Rural Older Adults With Generalized Anxiety Disorder: A Randomized Clinical Trial", *JAMA Psychiatry*, 72(10):1012-1020, PMID: 26244854. https://pubmed.ncbi.nlm.nih.gov/26244854/ — *abstract read*.
13. **Fitzpatrick KK, Darcy A, Vierhile M. (2017)**, "Delivering Cognitive Behavior Therapy to Young Adults With Symptoms of Depression and Anxiety Using a Fully Automated Conversational Agent (Woebot): A Randomized Controlled Trial", *JMIR Mental Health*, 4(2):e19, PMID: 28588005. https://pubmed.ncbi.nlm.nih.gov/28588005/ — *abstract read*.
14. **Kocaballi AB, Quiroz JC, Rezazadegan D, Berkovsky S, Magrabi F, Coiera E, Laranjo L. (2020)**, "Responses of Conversational Agents to Health and Lifestyle Prompts: Investigation of Appropriateness and Presentation Structures", *Journal of Medical Internet Research*, 22(2):e15823, PMID: 32039821. https://www.jmir.org/2020/2/e15823 — *full text read*.
15. **Kroenke K, Spitzer RL, Williams JBW. (2001)**, "The PHQ-9: Validity of a Brief Depression Severity Measure", *Journal of General Internal Medicine*, 16(9):606-613, PMC1495268. https://pmc.ncbi.nlm.nih.gov/articles/PMC1495268/ — *full text read (does not contain the phrase "No permission is required to reproduce, translate, display or distribute")*.
16. **National Health Service England. (2023)**, "The NHS Talking Therapies for anxiety and depression manual", UK Government / Cambridge University Press digital archive reference. https://service.gov.uk/ & https://www.cambridge.org/core/ — *secondary page*.
17. **PHQ Screeners Terms of Use**, https://www.phqscreeners.com/terms — *secondary page (terms state screeners are "free for download and use as stated within the PHQ Screeners site")*.
18. **Pearson Clinical Beck Anxiety Inventory Product Portal**, https://www.pearsonassessments.com/store/usassessments/en/Store/Professional-Assessments/Behavior/Beck-Anxiety-Inventory/p/100000150.html — *could not open*.
19. **HealthMeasures PROMIS Licensing Portal**, https://www.healthmeasures.net/explore-measurement-systems/promis/obtain-administer-measures/steps-to-license — *could not open*.
20. **DASS Questionnaire Conditions of Use**, University of New South Wales, https://dass.psy.unsw.edu.au/conditions.htm — *could not open*.
21. **GL Assessment HADS Permissions Portal**, https://www.gl-assessment.co.uk/ — *could not open*.

---

## Not Checked

- Current fee schedule and licensing terms on Pearson Clinical's portal (`https://www.pearsonassessments.com/`) for commercial software integration of the BAI (reported, not checked).
- Exact licensing fee tier structure on HealthMeasures (`https://www.healthmeasures.net/`) for embedding PROMIS Anxiety Short Forms into commercial mobile applications (reported, not checked).
- Exact licensing fees and terms for HADS-A from GL Assessment and Mapi Research Trust (reported, not checked).
- The statement defining reliable deterioration as an increase of 4 points or more in the UK NHS Talking Therapies manual (reported from secondary source, not checked directly).
- Sensitivity (0.70), specificity (0.85), and one-month test-retest reliability of OASIS from Campbell-Sills et al. (2009) (not reported in the abstract; full text not checked).
- Whether an independent formal validation study exists for the Finnish translation of the OASIS (Karpov et al. 2023 evaluated it in HUS iCBT, but prior validation was not checked).
- Source and URL for the phrase "No permission is required to reproduce, translate, display or distribute" for PHQ/GAD screeners (not found on the pages opened or in Kroenke et al. 2001).
- Direct text and specific recommendations in the Finnish Current Care guideline on anxiety disorders (`https://www.kaypahoito.fi/hoi50119`) beyond its date (25 June 2026) and listing of GAD-7, BAI, and OASIS (host blocked).
- Live conditions of use page on `https://dass.psy.unsw.edu.au/conditions.htm` (blocked).
- Direct formal licensing permissions from Sonya B. Norman or Murray B. Stein regarding commercial application rights for OASIS in standalone software.
- Test-retest reliability of OASIS specifically when administered by voice kiosk or smart speaker (no published speech-interface trials found).
- Head-to-head empirical comparison of GAD-7 versus OASIS specifically within post-TMS depression follow-up.
- The total number of patients and the size of the correlations between the OASIS and the GAD-7 in Karpov et al. (2023): the journal page was opened and gives programme groups of 5,528, 1,330 and 1,856 patients, but the total and the correlation values were not read.
- The identifiers (PMID) of the sources other than 2, 4, 6 and 8. A second check opened those four on PubMed or the journal page and found two wrong identifiers and one wrong first author in the first draft, which are corrected here; the remaining identifiers were not re-checked, so follow the title and authors if a link does not lead to the paper named.
