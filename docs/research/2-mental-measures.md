# Mental and behavioural measures for repeated use at home

Checked 2026-11-13 with web search. This builds on `evidence-check.md` (sections 3, 5, 6, 13) and does not repeat it. Unless a line says "page read", figures come from search-result abstracts, repository records or indexing pages; full texts were not opened. "No source found" means this run found nothing, not that nothing exists. Bodily sensor signals and location/movement sensors are out of scope (another agent).

Verdict scale: **supported**, **partly supported**, **contested**, **unsupported**.

---

## A. Questionnaires and short ratings

| Measure | Length | Sensitivity to change / reliability | Shortest sensible interval | Notes |
|---|---|---|---|---|
| PHQ-9 | 9 items, about 1–2 min | Minimal detectable change (95%) about 6 points (5.72) in an individual-patient-data meta-analysis; Löwe 2004 put individual reliable change at 5 points; minimal important difference estimates 2–3.7 points | 2 weeks (the items ask about "the last 2 weeks"); weekly is used in trials but overlaps | Good for calibration and clinician hand-off, too coarse and too long for daily use |
| PHQ-2 | 2 items (low mood, anhedonia), under 30 s | MDC95 about 2.3 points on a 0–6 scale; screening AUC 0.88 vs semistructured interview (Levis 2020, 100 studies, n=44,318) | 1–2 weeks | The two core items carry most of the screening information: PHQ-2 ≥2 then PHQ-9 would spare 57% of full PHQ-9s with sensitivity 0.82 vs 0.86 |
| Single-item momentary affect (slider or Likert) | 1 item, 5 s | A preregistered ESM study (Psychol Assess 2023, N=153) found strong validity evidence for single-item momentary affect; a single depression item correlated 0.71–0.78 with BDI-21 in 812 anxiety patients | Several times a day to daily | Reliability of a single item cannot be computed internally; Dejonckheere et al. propose repeating an item within a prompt to estimate it |
| Momentary positive/negative affect sets | 8 or 18 items | Two correlated factors (PA, NA) at within- and between-person levels (Myin-Germeys/Viechtbauer group, 2021) | Several times a day | The ESM Item Repository is the item bank to pick wording from (not opened item by item) |
| State rumination | BSRI 8 items; Hoebeke 5 ESM items | BSRI validated as a state measure (Marchetti 2018); Hoebeke ESM items had "excellent within-person variability" in 40 adults, 4×/day for 14 days | Daily to several per day | One or two items ("I kept thinking about my problems", "hard to stop thinking") are enough for a daily check-in; no source found for a validated single item |
| Fatigue / energy, anhedonia, sleep single items | 1 item each | No source found in this run for a validated single fatigue item in repeated depression monitoring | Daily | Use ESM-style wording; treat as an untested choice |

**Measurement reactivity (does asking change the answer?).** No completed meta-analysis was found; a protocol for one lists depression among populations with reported reactivity. Findings are mixed: Eisele et al. 2023 (randomised, 151 students) found habituation (faster completion, less within-person variance) and decreasing positive affect over time; a 7-day study found no effect on emotions or depressive symptoms; one study in clinically depressed adults found a possible small *beneficial* effect of 6 weeks of affect EMA. Arslan et al. 2021 (daily diary, >1,300 people) found item order and first-presentation day biased answers and recommend randomising item order. The evidence-check (13c) found no evidence of harm from self-monitoring.

**Which single items carry most information:** low mood and loss of interest (the PHQ-2 pair), plus momentary positive affect, which is the outcome that fell most consistently after sleep loss (section C) and is the bias that persists most clearly in remitted people (interpretation and attention, section B). A rumination item adds the target of MBCT/RFCBT.

Sources:
- Löwe B et al. 2004, Med Care, "Monitoring depression treatment outcomes with the PHQ-9". https://pubmed.ncbi.nlm.nih.gov/15550799/
- PHQ-9/8/2 minimal detectable change IPD meta-analysis (UTS repository). https://opus.lib.uts.edu.au/handle/10453/195941
- Levis B et al. 2020, JAMA 323(22), PHQ-2 alone and with PHQ-9. https://kclpure.kcl.ac.uk/portal/en/publications/accuracy-of-the-phq-2-alone-and-in-combination-with-the-phq-9-for/ (doi 10.1001/jama.2020.6504)
- Single-item momentary affect, Psychol Assess 2023 35(3):189, doi 10.1037/pas0001200. https://ifp.nyu.edu/2023/journal-article-abstracts/pas0001200/
- Dejonckheere E et al., reliability of single-item momentary affect. https://research.tilburguniversity.edu/en/publications/assessing-the-reliability-of-single-item-momentary-affective-meas/
- Myin-Germeys/Viechtbauer et al. 2021, affective structure in ESM. https://cris.maastrichtuniversity.nl/en/publications/affective-structure-measurement-invariance-and-reliability-across/
- ESM Item Repository. https://www.rug.nl/library/open-access/blog/the-esm-item-repository-30-09-2020
- Marchetti I et al. 2018, Cogn Ther Res, BSRI. https://arts.units.it/bitstream/11368/2935590.3/1/Marchetti%20et%20al%202018%20COTR%20-%20BSRI.pdf
- Hoebeke Y et al., ESM measure of rumination. https://research.dial.uclouvain.be/handle/2078.5/101758
- Eisele G et al. 2023, measurement reactivity to ESM (Assessment). https://research.tilburguniversity.edu/en/publications/a-mixed-method-investigation-into-measurement-reactivity-to-the-e/
- Reactivity overview and depressed-sample EMA benefit. https://pmc.ncbi.nlm.nih.gov/articles/PMC10798424

## B. Game-like tasks for negativity bias

Two cross-cutting facts frame everything below:
- **The reliability paradox** (Hedge 2018, Behav Res Methods): classic tasks that produce robust group effects often have test-retest reliability near 0 because people differ little; this undermines their use for tracking an individual.
- **Bias predicts later symptoms only weakly.** Vos et al. 2025 (Clin Psychol Rev; 81 longitudinal studies, n=17,709; page read): overall β=0.04; interpretation and memory biases predicted, **attention bias did not**.

| Task | Effect in current depression | Persists in remission? | Predicts relapse? | Reliability / practice | Phone fit | Verdict |
|---|---|---|---|---|---|---|
| **Interpretation of ambiguous scenarios / sentences** (incl. Scrambled Sentences Test) | g=0.72 overall (87 studies, n=9,443); g=0.88 direct measures, g=0.04 indirect | Yes: remitted g=0.59, similar to depressed (Everaert 2017) | Prospectively predicts symptoms, small (Vos 2025) | SST worry version had good split-half and test-retest; no depression-specific test-retest found | Good: 2–4 min, text or picture | **Best task candidate**, but only *direct* (explicit rating) versions show the effect |
| **Ambiguous / morphed face rating** | Consistent negative interpretive bias for faces in reviews; recognition accuracy deficit moderate (8 studies) | Remitted: response bias, not accuracy loss (BJP 2011, n=230) | Bouhuys 1999 (n=23): negative reading of *ambiguous* faces predicted relapse at 6 months; 1997 study: no prediction. Ruhé 2019 (n=69, 2.5 y): anger misclassifications predicted time to recurrence but added little over demographics/adversity | Pike 2024 ("ambiguous midpoint" task, n=58, ≥14 days): 0.18–0.49 | Good: 1–3 min; image quality and ambiguity shift answers in opposite directions (Perception 2021) | **Promising, the doctor's idea**; weekly, personal baseline, not a daily alarm |
| **Self-referential encoding (SRET)** | Endorsement count most strongly linked to severity | No source found in this run | No source found | Endorsement and drift-rate metrics: strong split-half and high 1-week test-retest (2018, three large samples); recall and RT metrics weak | Good: 2–3 min, 20–40 adjectives | **Promising**; use endorsement counts, not reaction times; words repeat, so rotate lists |
| **Memory bias** (recall of self-descriptions) | g=0.24 (153 studies) | Naturalistic g=0.13 n.s.; under mood/stress induction g=0.27 significant (Everaert 2022; page read) | Ruhé 2019: emotional memory performance linked to time to recurrence | High heterogeneity | Fair; needs a delay | Secondary |
| **Attention bias: dot-probe** | Eye-tracking meta-analyses: sustained gaze on dysphoric stimuli, no early-orienting bias | Wen 2023 (44 studies): more time on negative vs positive in past MDD | Not predictive (Vos 2025) | **Unreliable**: poor internal and test-retest (Kappenman 2014); "completely unreliable" in a 3-task comparison; unacceptable in high-risk children | Feasible, gamified versions exist (Dennis-Tiwary "Personal Zen" style ABMT; 2024 smartphone ABMT meta-analysis) | **Drop as a measure** |
| **Affective go/no-go** | Erickson 2005 (n=20+20): mood-congruent bias | No source found | No source found | Pike 2024 go/no-go: 0.18–0.49 | Feasible | Weak |
| **Reward learning (Probabilistic Reward Task)** | Reduced response bias in anhedonia | Reward deficits reported in remitted (evidence-check 9) | No source found | Test-retest r≈.50 (Santesso 2008, as cited); online version has lab-like psychometrics (Esfand 2024); reinforcement-learning tasks fair-to-low elsewhere | 5–10 min, ~200 trials | Too long and too noisy for frequent use |
| **Effort for reward (EEfRT-type)** | g=−0.28 (Pillny 2026, evidence-check 12b); more robust for physical effort | Mixed in remission | No source found | Online effort task validated for test-retest; circadian effects lower reliability | 5–10 min | Secondary; could be a weekly "game" |
| **Approach-avoidance task** | Reduced approach to positive stimuli | No source found | No source found | Test-retest .35–.77; a 2025 smartphone AAT had split-half 0.77–0.94 (RT) | 2–4 min | See section F |

**Practice effects in phone cognitive testing.** In a 10-day smartphone study (JMIR 2024, n=393), 9 of 12 scores had good-to-excellent test-retest reliability; practice effects appeared in fewer scores; iOS and newer Android performed better (device confound). Practice effects were found in 5 tests in a bipolar sample. So daily repetition is feasible for simple cognitive tests, but bias tasks with emotional stimuli lose ambiguity as stimuli get familiar (no source found that measured this directly).

**Commercial or gamified versions found:** smartphone attention-bias modification games (anxiety; Dennis et al., Clin Psychol Sci; 2024 meta-analysis). No commercial interpretation-bias *measurement* game for depression found.

Sources:
- Hedge C et al. 2018, Behav Res Methods 50(3):1166. https://orca.cardiff.ac.uk/id/eprint/102138/
- Vos LMW et al. 2025, Clin Psychol Rev 116:102552 (page read). https://research.tilburguniversity.edu/en/publications/do-cognitive-biases-prospectively-predict-anxiety-and-depression-/
- Everaert J et al. 2017, Clin Psychol Rev, interpretation bias meta-analysis. https://research.tilburguniversity.edu/en/publications/a-comprehensive-meta-analysis-of-interpretation-biases-in-depress-2/
- Everaert J et al. 2022, Psychol Bull 148:435, memory bias (page read). https://research.tilburguniversity.edu/en/publications/a-meta-analytic-review-of-the-relationship-between-explicit-memor/
- Krahé C et al. 2022, worry SST reliability. https://researchonline.ljmu.ac.uk/id/eprint/17493/1/Krahe2022.pdf
- Bouhuys AL, Geerts E, Gordijn MC 1999, J Nerv Ment Dis, facial perception and relapse. https://scilit.com/publications/792ea97ad791ca6f41286e257bad55ab
- Anderson IM et al. 2011, Br J Psychiatry, state-dependent face recognition. https://research.manchester.ac.uk/en/publications/state-dependent-alteration-in-face-emotion-recognition-in-depress/
- Ruhé HG et al. 2019, Front Psychiatry 10:145. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6447719/
- Pike AC et al. 2024, Comput Psychiatry 8(1):217. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11661199/
- Perception 2021, ambiguity vs image quality. https://journals.sagepub.com/doi/10.1177/03010066211000270
- SRET reliability (2018, Psychol Assess, doi 10.1037/pas0000602). https://zendy.io/title/10.1037/pas0000602
- Kappenman ES et al. 2014, dot-probe reliability. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4255626/
- Dot-probe in high-risk children, 2020. https://link.springer.com/10.1007/s10578-020-01105-2
- Eye-tracking meta-analysis 2023, Front Psychol. https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.1089654/full
- Wen A et al. 2023, J Psychopathol Clin Sci (APA release). https://www.apa.org/news/press/releases/2023/08/formerly-depressed-patients-negative
- Erickson K et al. 2005, Am J Psychiatry 162:2171. https://ajp.psychiatryonline.org/doi/full/10.1176/appi.ajp.162.11.2171
- Esfand SM et al. 2024, J Affect Disord, online PRT. https://depressioninstitute.uci.edu/wp-content/uploads/sites/37/Esfand_JAD24.pdf
- Influenca smartphone reward-learning preprint (cites Santesso 2008 r=.50). https://storage.prod.researchhub.com/uploads/papers/2025/11/22/2021.04.27.441601v1.full.pdf
- Smartphone ABMT meta-analysis 2024, JMIR Ment Health. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11406109/
- Dennis TA, O'Toole L, Clin Psychol Sci 2014, gamified ABMT. https://www.psychologicalscience.org/news/releases/reducing-anxiety-with-a-smartphone-app.html
- Smartphone cognitive tests, JMIR 2024 (n=393). https://www.jmir.org/2024/1/e51978/

## C. The doctor's claims

**(1) After poor sleep a person is rated less attractive, less healthy, less trustworthy. Partly supported.** Axelsson et al. (BMJ 2010, 23 people photographed twice) were rated less healthy, more tired and less attractive after sleep deprivation; Sundelin et al. (R Soc Open Sci 2017, 25 people, 122 raters) replicated less attractive, less healthy and more sleepy, and raters were less willing to socialise with them, but **trustworthiness did not differ**.
*Researcher sentence:* "Experimental sleep loss makes faces look less healthy and attractive to strangers, and lowers their willingness to socialise, but did not change perceived trustworthiness."

**(2) Poor sleep makes a person interpret faces and social signals more negatively. Partly supported.** Palmer et al. (Psychol Bull 2024; 154 studies, n=5,717): the robust effects are *loss of positive affect* (SMD −0.27 to −1.14) and higher anxiety; negative affect and valence ratings of emotional stimuli were mixed, though REM loss gave more negative valence ratings (SMD 0.35). Face studies are small and inconsistent on which emotion is affected (van der Helm 2010: impaired judgement of anger and happiness; Killgore 2017: happiness and sadness); an eye-tracking study found faces rated less trustworthy and attractive after sleep loss.
*Researcher sentence:* "Sleep loss reliably reduces positive affect and blunts emotional reactivity, while evidence for a specifically negative reading of faces is small-sample and inconsistent across emotions."

**(3) The same negative shift occurs in depression and in pain. Partly supported.** Depression: supported (interpretation bias g=0.72; persists in remission g=0.59). Pain: Schoth & Liossi (Health Psychol 2016) meta-analysis found greater interpretation bias in chronic pain, but toward *pain- and illness-related* meanings, not general social negativity; adolescents with chronic pain endorse fewer benign interpretations (Heathcote 2017).
*Researcher sentence:* "Negative interpretation bias is well established in depression and persists in remission; chronic pain shows an analogous but content-specific bias toward pain and illness meanings."

**(4) Anxiety increases startle to loud sounds. Partly supported.** Grillon's reviews: startle is potentiated by sustained, unpredictable threat (anxiety-potentiated startle) more than by cued fear, and panic disorder and PTSD are more sensitive to it; elevated *baseline* startle is inconsistent and disappears in safe contexts. A correlational study of 111 women linked greater general startle to anxiety. No meta-analysis across anxiety disorders was found. (Startle is a sensor measure; noted only because the doctor raised it.)
*Researcher sentence:* "Startle is reliably potentiated in anxious people under unpredictable threat, whereas baseline startle elevation in anxiety disorders is inconsistent."

**(5) Negativity bias rises with stress and poor sleep. Contested.** Stress: an experiment with an arithmetic stressor found stressful *life events* went with more negative interpretations, but **acute induced stress did not** shift them (PMC9350455); cortisol *reactivity* went with more negative ratings of surprised faces. Sleep: see (2). Daily diaries show better-than-usual sleep predicts lower next-day negative affect within person (>1,000 adults). No study was found that tracked a bias task within the same person across days of good and bad sleep or stress.
*Researcher sentence:* "Chronic stress and sleep loss are associated with more negative affect, but whether an individual's interpretation bias rises on stressed or sleep-deprived days has not been tested directly, and acute stress inductions have not reliably shifted it."

**(6) In people with a history of depression, a rise in negative bias or low mood reactivates negative thinking. Partly supported.** The differential activation hypothesis (Teasdale): recovered patients show more negative thinking than never-depressed people when mildly dysphoric but not when euthymic; Segal 2006 found mood-provoked dysfunctional attitudes predicted relapse over 18 months, and the greatest increase in negative thinking under dysphoria predicted relapse over 30 months. But a 2013 study (n=187, 5.5 years) found cognitive reactivity did **not** predict relapse while *mood reactivity* to the induction and unprimed attitudes did; the DAS-change measure is unreliable. Memory bias in remitted people appears only under mood or stress induction (g=0.27). Bouhuys 1999 is the one small study linking negative face perception to relapse.
*Researcher sentence:* "Sad mood reveals latent negative cognition in formerly depressed people, consistent with differential activation, but the evidence that this reactivity predicts relapse is inconsistent across prospective studies."

Sources:
- Axelsson J et al. 2010, BMJ 341:c6614. https://pmc.ncbi.nlm.nih.gov/articles/PMC3001961
- Sundelin T et al. 2017, R Soc Open Sci 4:160918. https://doaj.org/article/98e2dc7b6a6d46e39e01920966529f86
- Palmer CA et al. 2024, Psychol Bull 150(4):440. https://ueaeprints.uea.ac.uk/id/eprint/93044
- Sleep and face-emotion studies (van der Helm 2010; Killgore 2017; eye tracking). https://pmc.ncbi.nlm.nih.gov/articles/PMC8912122 ; https://scholar.usuhs.edu/en/publications/sleep-deprivation-impairs-recognition-of-specific-emotions/ ; https://www.psypost.org/2022/10/eye-tracking-study-finds-sleep-deprived-people-spend-less-time-attending-to-faces-which-could-harm-social-interactions-64123
- Schoth DE, Liossi C 2016, Health Psychol (doi 10.1037/hea0000342). https://eprints.soton.ac.uk/386891
- Heathcote LC et al. 2017, Pain. https://researchportal.bath.ac.uk/en/publications/biased-interpretations-of-ambiguous-bodily-threat-information-in-/
- Grillon C 2008, Psychopharmacology, "Models and mechanisms of anxiety: evidence from startle". https://pmc.ncbi.nlm.nih.gov/articles/PMC2711770 ; Grillon 2002 Biol Psychiatry https://www.psychiatry.wisc.edu/courses/Nitschke/seminar/grillon%202002%20bio%20psychiatry.pdf
- Startle and anxiety in 111 women. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4319476/
- Stressful life events vs acute stress and interpretation. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9350455/
- Daily sleep and next-day affect (COVID diary). https://pmc.ncbi.nlm.nih.gov/articles/PMC8554789
- Segal ZV et al. 2006. https://cih.ucsd.edu/sites/cih.ucsd.edu/files/mbpti/Cognitive%20Reactivity%20to%20Sad%20Mood%20Provocation%20and%20the%20prediction%20to%20depressive%20relapse.pdf
- 2013 study of 187 remitted patients (van Rijsbergen et al.). https://pmc.ncbi.nlm.nih.gov/articles/PMC3336865
- Differential activation summary (Romero et al. 2014). https://pmc.ncbi.nlm.nih.gov/articles/PMC3947655

## D. Non-response as data

**What the evidence supports:**
- **Negative states precede missed prompts.** In 260 young adults, higher stress, negative affect and feeling "upset" at one prompt predicted missing the *next* prompt (Murray et al.); another study found momentary stress predicted lower completion of later prompts.
- **Depressed people answer less.** Compliance was lowest in currently depressed adults versus remitted and controls (Seidman et al.; overall 91%). Reviews list depression among predictors of lower adherence and warn this biases results.
- **Answer speed.** Response latencies are logged easily (mindLAMP), but the link with severity is not linear: in a mobile CESD study, reaction time related to scores by a *quadratic* trend (Chung 2019). No prospective study found slower answering predicting worsening.
- **Free-text length:** no source found.

**What argues against a naive signal:**
- RADAR-MDD found **no association between baseline depression severity and data availability** (80% completion of main outcomes).
- Much missingness is technical: in one EMA study, phone switched off or the prompt expiring made up 93% of missing items.
- Everyone fades: compliance declined linearly by about 1–2% a week over a 9-week protocol (2%/week for morning prompts), faster in younger, full-time employed participants and those who later dropped out. In real-world use, median 30-day retention of mental health apps was 3.3% (Baumel 2019, 93 apps).
- **No study was found that used compliance itself as a validated predictor of depressive relapse while controlling for prior symptom scores.** A 2026 JMIR paper states that disengagement has been associated with severity or relapse risk but that the signal is rarely modelled explicitly; its cited sources were not checked.

Sources:
- Murray AL et al., prompt-level predictors of compliance (n=260). https://eprints.lancs.ac.uk/id/eprint/204987
- Seidman AJ et al., EMA compliance in depression-prone vs controls. https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_2662546091
- Time-varying completion and stress. https://pmc.ncbi.nlm.nih.gov/articles/PMC10698810/
- Henson P, Torous J et al., mindLAMP latencies. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7301285/
- Chung K et al. 2019, JMIR mHealth, response time as self-schema indicator. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6779024/
- RADAR-MDD retention and data availability (Matcham et al. 2022). https://pubmed.ncbi.nlm.nih.gov/35189842/
- Technical causes of missing EMA, JMIR Form Res 2021. https://formative.jmir.org/2021/9/e31421/PDF
- EMA compliance decline over 9 weeks, JMIR 2023 25:e43826. https://www.jmir.org/2023/1/e43826
- Baumel A et al. 2019, JMIR 21(9):e14567. https://jmir.org/2019/9/e14567/PDF
- 2026 JMIR Formative paper on missingness as signal. https://formative.jmir.org/2026/1/e99204/PDF

## E. Design consequences

1. **Daily: 3–4 items, under 30 seconds.** Mood (slider), interest/enjoyment, energy/tiredness, one rumination item; randomise item order (Arslan 2021). Compliance in studies is about 80% and the number of prompts did not predict dropout (evidence-check 6), but real-world retention is far lower, so start with one prompt a day.
2. **Weekly: PHQ-9 (or PHQ-8) every 1–2 weeks** for calibration; flag change of ≥6 points as reliable, 3–5 as "watch".
3. **Weekly: one 2–3 minute "game"** (ambiguous faces or scenarios, explicit rating; SRET endorsement). Interpret only against the person's own baseline over several weeks; never as a single-day alarm, because reliability is 0.2–0.5.
4. **Treat a missed answer as a typed event, not a zero.** Log: prompt delivered? phone used that day (another agent's passive data)? time since last answer? last answers trending worse?
5. **Telling "too unwell" from "bored":**
   - *Bored*: gradual decline that starts early, steady or improving last answers, normal phone use, answers return after a reminder.
   - *Unwell*: abrupt drop relative to the person's own rate, preceded by worsening mood or higher stress in the last answers (Murray), with passive data still flowing (RADAR: 44.6% of those who stopped surveys still shared Fitbit data).
   - Offer a **one-tap "not today"** answer so non-response converts into data, and after 2–3 missed days ask a single-item "How are you, 1–5?" instead of the full set.
   - This rule set is a design inference; no study validated it.

## F. Avoidance and narrowing of life range

**(1) Validated scales.**
- **BADS** (25 items) and **BADS-SF** (9 items, 0–54, "past week including today"): the long form tracks weekly change (d=0.86 in CBT); the short form was used at 4-week intervals in trials (WILLOW: 18.8 → 27.7 over 12 weeks). This run found no reliability or responsiveness figures for the short form (Manos et al. 2011 not opened).
- **Cognitive-Behavioral Avoidance Scale** (CBAS, Ottenbreit & Dobson 2004): four factors (cognitive/behavioural × social/non-social); German version (n=657) reliable and related to depression after controlling for anxiety; Spanish version rho=.36 with depression. No prospective prediction found.
- No validated single-item avoidance or activation measure found.

**(2) Self-report life range.**
- The UAB Life-Space Assessment (older adults) is linked to depressive symptoms cross-sectionally (n=848, aged 75–90), and change in depressive symptoms mediated change in life-space over 2 years.
- Within-person daily diaries in diagnosed depression: daily fluctuations in being alone, doing nothing/resting, talking and physical activity predicted end-of-day depressive symptoms beyond the previous day's symptoms (Maastricht).
- Daily social interaction quantity went with lower depressed mood within person (75 days, n=515).
- But daily *activity diversity* (number of activity types) was unrelated to affect on average in older adults, with large individual differences.
- **No source found** showing a shrinking self-reported range precedes relapse.

**(3) Game-like approach/avoidance.**
- Approach-avoidance task: depressed people show reduced approach to positive stimuli; test-retest .35–.77; a 2025 smartphone AAT had split-half 0.77–0.94 (internal, not test-retest).
- Effort-for-reward: small deficit (g=−0.28), more robust for physical effort.
- Exploration versus staying put: a 2025 systematic review of 46 studies found no consistent direction in depression (both less switching and over-exploration reported).

**(4) The doctor's claims.**
- **Avoidance in depression is generalised rather than specific: contested.** Behavioural activation theory (Ferster) treats avoidance broadly, and avoidance is described as transdiagnostic; but scales separate social from non-social and cognitive from behavioural avoidance, and 2025 work on specific avoidance types calls findings mixed. *Researcher sentence:* "Avoidance is a broad, transdiagnostic feature of depression, but whether it is generalised rather than domain-specific has not been established."
- **Doing anything else interrupts the thoughts: partly supported.** In 76 formerly hospitalised depressed patients after a negative mood induction, distraction and mindful self-focus both improved mood relative to rumination, and habitual distraction predicted a better long-term course (Huffziger & Kuehner 2009). Effects are short-term (see evidence-check 4). *Researcher sentence:* "Distraction and mindful self-focus interrupt rumination-driven negative mood in the short term in formerly depressed patients; long-term effects of the act itself are not shown."
- **Self-punishment and difficulty judging what is good for them: partly supported for reward valuation, no source for self-punishment.** Reviews find *wanting* and reward *learning* impaired with *liking* relatively intact; effort-for-reward is reduced. Eshel & Roiser (Biol Psychiatry 2010) review altered reward and punishment processing (abstract only). Self-criticism predicts poorer therapy outcome (evidence-check 11). *Researcher sentence:* "Depression impairs anticipation of and learning from reward more than enjoyment itself; 'self-punishment' as a behavioural tendency was not checked against data in this run."

Sources:
- BADS-SF trial use (WILLOW, MOBA). https://clinicaltrials.gov/study/NCT03221556 ; https://clinicaltrials.gov/study/NCT04892147
- BADS sensitivity d=0.86 (trial listing). https://clinicaltrials.gov/study/NCT02314624
- Ottenbreit ND, Dobson KS 2004, CBAS. https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_80176372 ; German version https://mijn.bsl.nl/a-psychometric-evaluation-of-the-cognitive-behavioral-avoidance-/572184 ; Spanish version https://www.doi.org/10.1017/sjp.2017.16
- Life-space and depressive symptoms (Polku et al. 2015, Aging Ment Health). https://jyx.jyu.fi/jyx/Record/jyx_123456789_49896
- Daily behaviours and depression, within-person. https://cris.maastrichtuniversity.nl/en/publications/change-in-daily-life-behaviors-and-depression-within-person-and-b
- Activity diversity in older adults. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11075729/
- Approach-avoidance reliability and smartphone AAT. https://link.springer.com/content/pdf/10.3758/s13428-022-01804-9.pdf ; https://mhealth.jmir.org/2025/1/e69033
- Exploration-exploitation review 2025, BMC Psychiatry. https://pubmed.ncbi.nlm.nih.gov/40287643/
- Behavioural activation and avoidance (Ferster). https://pmc.ncbi.nlm.nih.gov/articles/PMC2223147 ; specific avoidance 2025 https://www.eneuro.org/content/12/9/ENEURO.0034-25.2025
- Huffziger S, Kuehner C 2009, Behav Res Ther. https://sources.mandala.library.virginia.edu/node/67276
- Wanting vs liking review. https://pmc.ncbi.nlm.nih.gov/articles/PMC4356228
- Eshel N, Roiser JP 2010, Biol Psychiatry 68(2):118. https://pubmed.ncbi.nlm.nih.gov/20303067/

---

## Ranked table

| Rank | Measure | Time per use | How often | Within-person evidence | Reliability | Verdict |
|---|---|---|---|---|---|---|
| 1 | Daily 3–4 item check-in (mood slider, interest, energy, rumination) | 20–30 s | Daily | Strong: ESM mood items vary within person and carry early-warning signals (evidence-check 1) | Single-item validity good; reliability not directly computable | **Core** |
| 2 | Engagement paradata (missed prompts, latency, "not today" taps) | 0 s | Continuous | Negative affect/stress precede missed prompts; no relapse validation | Unknown; confounded by fatigue and technical causes | **Core, as a modifier, not an alarm** |
| 3 | PHQ-9 / PHQ-8 | 1–2 min | Every 1–2 weeks | Good; MDC about 6 points | Good | **Core calibration** |
| 4 | Ambiguous faces or scenarios, explicit rating | 2–3 min | Weekly | Persists in remission; small prospective prediction; one small relapse study (faces) | 0.18–0.49 for one face task; unknown for scenarios | **Best game candidate; trend only** |
| 5 | Weekly activity/social range (count of activity types, people, places outside home) or BADS-SF | 30 s – 2 min | Daily count or weekly BADS-SF | Daily aloneness and inactivity predict same-day symptoms; no relapse data | BADS-SF not checked | **Good fit for doctor's "territory" idea; untested for relapse** |
| 6 | PHQ-2 | 15 s | Weekly between PHQ-9s | Good screening AUC 0.88 | MDC about 2.3 of 6 | Useful filter |
| 7 | SRET endorsement count | 2–3 min | Weekly | Associated with severity | High 1-week test-retest for endorsement | Promising |
| 8 | Approach-avoidance task (smartphone) | 2–4 min | Weekly | Reduced approach to positive in depression | Test-retest .35–.77 | Experimental |
| 9 | Effort-for-reward game | 5–10 min | Monthly | Small group deficit | Moderate | Experimental |
| 10 | Brief state rumination (BSRI) | 1 min | Weekly or on a low day | Good within-person variability | Validated | Optional |
| 11 | Probabilistic reward task | 5–10 min | Rarely | Anhedonia link | r≈.50 | Too long |
| 12 | Affective go/no-go | 3–5 min | — | Small studies | 0.18–0.49 | Weak |
| 13 | Dot-probe | 5 min | — | Not predictive | Near zero | **Drop** |

## Not checked

- Full texts were not opened except two repository pages; several figures come from search summaries (marked above).
- No source for: free-text length as a marker; a validated single item for fatigue or avoidance; BADS-SF psychometrics; within-person daily bias tasks across good and bad sleep or stress; compliance as a relapse predictor controlling for symptoms; practice effects specific to emotional bias tasks repeated daily; any measure studied after TMS.
