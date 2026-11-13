# Learning which quick response helps one person: data and methods

Checked 2026-11-14 with web search. Builds on `3-state-shifters.md` (sections A and E) and `../plan.md`; does not repeat them. Each figure says where it came from: **abstract**, **full text**, **dataset page** (or dataset documentation), or **secondary** (a search summary, news, a thesis or slides). Most figures in this run are from abstracts or search summaries; few full texts could be opened (several sites refused automated fetches). "No source found" means this run found nothing, not that nothing exists. Nothing was downloaded.

## The answer in one paragraph

**Yes, but not soon and not finely.** No open dataset records one quick response being offered repeatedly to the same depressed person together with mood before and after, so nothing ready-made can tell us which response helps whom. The closest open data are diaries: one depressed person rated mood, activity, company and physical activity ten times a day for 239 days (Kossakowski et al. 2017), and a growing open catalogue of experience-sampling studies (openESM, about 60 datasets). These show how mood moves with activity *within* a person, but only as association, not as the effect of a suggestion. The data that could answer the question must be collected by the product itself: each time a suggestion is offered, record which one was chosen at random from a small vetted set, the mood just before, and one tap afterwards. With the product's rhythm (questions twice a week, suggestions only on small dips) one person yields perhaps 1 to 3 such trials a week. By the arithmetic in `3-state-shifters.md` §E that is enough after about three months to say, for a few people with large effects, "this response seems to help you more than nothing", and never enough to rank several responses for one person. What the collected data *can* do well is estimate the average effect of each response across all patients, and how it varies with context; per-person learning should start from that group estimate and move only slowly toward the person's own data. For the weekend: a labelled simulation plus an observational look at the open single-patient diary, not a working personaliser.

---

## A. Open datasets

### Table

| Dataset | What it holds | People × observations | Activity / intervention items | Access, licence | Could show | Could not show |
|---|---|---|---|---|---|---|
| **Kossakowski et al. 2017**, single-patient diary (JOPD 5(1), doi 10.5334/jopd.29) | Momentary ESM 10×/day, morning and evening diaries, weekly SCL-90-R depression items, during a double-blind antidepressant taper | **1 person** with MDD, 1,478 measurements over 239 consecutive days (abstract); the `emaph` R package copy has 1,476 rows and 85 variables (dataset documentation) | Main activity before the beep, second activity, effort, skill and enjoyment of the activity; who the person is with (three fields), whether doing something together, pleasantness of company; physically active since last beep; event pleasantness and importance (see list below) | Open, CC BY 4.0 (abstract record and OSF record via search summary); also inside the `emaph` R package | Within-person associations: mood at the next beep after being physically active, in company, or doing an enjoyed activity; time-series methods; autocorrelation in real depressed data | Any causal effect; any effect of a *suggestion*; generalisation beyond one person, who was also tapering medication |
| **openESM** (Siepe, Haslbeck, Fried et al., Behav Res Methods 2026) | Harmonised catalogue of openly shared ESM datasets, observational and experimental, some with passive sensing | About 60 datasets, >16,000 people, >740,000 observations (talk slides and abstract record, secondary); a "depression" group of N=243 appears on slides (secondary, unclear) | Varies by dataset; searchable by construct | Website openesmdata.org, R and Python packages, metadata on GitHub/Zenodo; licence set per dataset (site text) | The best place to find more single-person-rich mood + activity series; testing whether the analysis method generalises | The dataset list did not load in this run, so **no specific depression dataset with activity items was confirmed** |
| **StudentLife** (Dartmouth, Wang et al. 2014) | Phone sensing, EMA (mood, stress, PAM affect grid and others), pre/post PHQ-9, academic data | 48 students, 10 weeks (CRAN package readme); about 32,000 self-reports (search summary of dataset page); the 2014 paper reports 60 enrolled, 48 completing (secondary) | Sensed activity, conversation, location; EMA activity and social items (not itemised in this run) | Public anonymised download (~5 GB); **licence not found**; dataset page refused connection in this run | Within-person mood vs sensed activity and sociality in a non-clinical group; missing-data patterns | Depressed people; any intervention; few mood ratings per person per day |
| **HeartSteps V1** micro-randomised trial (Klasnja et al. 2019) | Activity suggestions randomised up to 5×/day for 6 weeks | 44 adults (abstract; 37 completers per a methods paper, secondary) | Randomised walking vs anti-sedentary vs no suggestion | **No public release found**; the R package `MRTAnalysis` ships a *synthetic* dataset that mimics its structure (7,770 rows, 9 variables; package docs) | How to analyse a micro-randomised trial; the synthetic copy is a ready template for the demo | **No mood outcome** (outcome is steps in the next 30 min) |
| **Intern Health Study MRT** (NeCamp et al. 2020, JMIR 22(3):e15033) | Weekly randomisation to mood, activity, sleep or no notifications for 6 months; daily mood rating | 1,565 medical interns (abstract) | Notification category | **No open data found**; later cohorts registered (NCT05106439, NCT06465680) | The closest published design to ours with a mood outcome (see B) | Not available to us |
| **UNE SuperBetter multiple single-case** (University of New England) | Daily distress ratings (SUDS) and DASS-21 at four points while using an app | 4 participants (repository record, secondary) | App use phase vs baseline | Listed on researchdata.edu.au; licence not checked | A tiny example of an AB single-case design with daily ratings | Anything general; n=4 |
| Open n-of-1 trial data in mental health | — | — | — | **No other source found** | — | — |

### Kossakowski 2017: the variables
From the `emaph` package documentation (dataset documentation; the JOPD codebook itself could not be opened in this run). Several items were recoded from −3…3 to 1…7; which ones is not stated.
- Design: `phase` (taper phase), `concentrat` (antidepressant concentration), `dayno`, `beepno`, `date`, beep and response times, `resp_abort`.
- **Mood** (12): relaxed, down, irritated, satisfied, lonely, anxious, enthusiastic, suspicious, cheerful, guilty, indecisive, strong. Plus restlessness/worry (restless, agitated, worry, can concentrate) and self-esteem (like myself, ashamed, doubt myself, can handle anything).
- **Company**: `soc_who1`–`soc_who3` (who is present), `soc_enjoy_alone`, `soc_prefcomp`, `soc_prefalone`, `soc_belong` (label duplicated in the docs), `soc_pleasant` (company pleasant), `soc_together` (doing something together).
- **Physical**: hungry, tired, pain, dizzy, dry mouth, nauseous, headache, sleepy, and **`phy_physact`: physically active since the last beep**.
- **Activity**: **`act_what1`** (main activity just before the beep), `act_what2`, `act_difficul` (activity takes effort), `act_well` (good at it), `act_enjoy` (like doing it).
- Events: pleasantness, importance, cause, concern, frequency, whom it pertained to, beep disturbed.
- Evening: ordinary day, nice day, questionnaire influenced mood, would have done otherwise without the device, worked, took medication. Morning: sleep onset, awakenings, lying awake, sleep quality, looking forward to the day, medication.
- Weekly SCL-90-R depression items including **item 15, thoughts of ending one's life**, and a depression mean score.

Sources (A):
- Kossakowski JJ et al. 2017, JOPD, doi 10.5334/jopd.29: https://doaj.org/article/2d3bc156907841ae9b21c5ae2027d0ad ; https://dare.uva.nl/id/eff3ee9e-17c3-4956-86c5-c70eee4fefea ; variables: https://rdrr.io/github/jruwaard/emaph/man/csd.html ; handbook chapter https://jruwaard.github.io/aph_ema_handbook/csd.html ; OSF record (search summary) https://osf.io/j4fg8 ; original letter Wichers & Groot 2016, doi 10.1159/000441458
- openESM: https://openesmdata.org ; https://github.com/openesm-project ; https://link.springer.com/article/10.3758/s13428-026-03112-y ; slides https://bsiepe.github.io/talks/2025-11-17-introducing-openesm/openESM-Talk-AMPC-Siepe.pdf
- StudentLife: https://studentlife.cs.dartmouth.edu/dataset.html ; https://www.stats.bris.ac.uk/R/web/packages/studentlife/readme/README.html ; https://www.cs.columbia.edu/~xia/publication/ubicomp14-studentlife/ubicomp14-studentlife.pdf
- HeartSteps: Klasnja P et al. 2019, Ann Behav Med 53(6):573, https://pubmed.ncbi.nlm.nih.gov/30192907/ ; NCT03225521 https://clinicaltrials.gov/study/NCT03225521 ; synthetic copy https://www.rdocumentation.org/packages/MRTAnalysis/versions/0.2.0/topics/data_mimicHeartSteps ; methods paper https://arxiv.org/pdf/1812.10800
- Intern Health Study MRT: NeCamp T et al. 2020, https://doaj.org/article/90ad92c2698f4522b2416dfe445f512d ; https://clinicaltrials.gov/study/NCT05106439
- UNE single-case: https://researchdata.edu.au/can-smartphone-app-case-design/1594512

---

## B. Methods that fit small personal data

| Method | Needs | Gives | Pitfalls | Published mental-health example |
|---|---|---|---|---|
| **N-of-1 / single-case design** (alternate conditions, e.g. ABAB or randomised blocks) | Repeated outcome per person, conditions that wash out quickly, many switches | A personal effect with an honest uncertainty | Carry-over, time trends (recovery, seasons), autocorrelated ratings, missing answers, too few switches (median 3 treatment pairs in reviews) | Kronish et al. review: few, small depression N-of-1 trials (abstract, via `3-state-shifters.md` §E). Bright-light N-of-1 series in 9 cancer survivors: benefit in some, none or harm in others (abstract) |
| **Multilevel model with person-specific (random) effects** | Many people, several observations each | Group effect plus each person's deviation | Assumes effects come from one common distribution; over-shrinks people who really differ; needs the pre-score as a covariate to handle regression to the mean | No mood example retrieved in this run |
| **Bayesian shrinkage / hierarchical n-of-1** | A prior from group evidence, the person's own trials | A personal estimate that starts at the group value and moves toward the person's data as trials accumulate | Same over-shrinkage; clustering variants reduce it (secondary). Prior must not be overconfident | Methods papers combine series of n-of-1 trials (arXiv 1911.00878; chronic pain thesis, Brown). **No mental-health example with individual estimates found** |
| **Micro-randomised trial (MRT)** | Randomise at each decision point (suggest or not, which one), record the probability | Causal *proximal* effect averaged over people, and how it changes with context and time (habituation) | Proximal effects are small; per-person estimates still need many trials; availability rules must be pre-set | **Intern Health Study** (n=1,565; weekly randomisation to notification type): previous week's low mood moderated the effect on this week's mood, estimate −0.052, p=.001, i.e. notifications helped more when mood had been low (abstract). Because the comparison week was also randomised, this is not just regression to the mean. HeartSteps (activity, not mood): walking suggestion +24% steps in next 30 min, p=.02 (abstract) |
| **Bandits** (Thompson sampling, contextual) | A reward per trial, a prior, and enough trials | Shifts choices toward what seems to work while still exploring | Optimises whatever reward is given (engagement if careless); confounds time trends with arms unless probabilities are logged; small per-person N | Kumar et al. 2024 (AAAI): bandit text messages to 1,100 users, reported engagement, **no mood outcome in abstract**. IntelligentPooling (Thompson sampling pooling across users; physical activity). Deakin bandit (between-person, `3-state-shifters.md` §E) |

### Pitfalls specific to this product
- **Regression to the mean.** A suggestion is triggered by a low score, so the next score is expected to rise anyway. A before/after change says nothing on its own. It needs a randomised comparison, or at minimum the pre-score as a covariate and a comparison taken at similar pre-scores. The Intern Health Study shows the right way: compare randomised notification vs none *at the same prior mood*.
- **Effect differs with state.** The same study found a larger effect when mood was low. So trials run while the person is well estimate a *different* (likely smaller) quantity than the effect during a dip.
- **Habituation.** Repeated prompts lose effect: an 8-week messaging study named habituation from predictable messages as a leading cause of declining responsiveness (preprint abstract, secondary); MRT methods papers list deterioration over days as a target of analysis (secondary). The claim that HeartSteps' effect itself fell over days could not be confirmed (search summary only).
- **Missing after-taps.** People skip the follow-up most when they feel worst; treating missing as "no change" biases toward zero, dropping it biases toward benefit. Record it and analyse it as its own outcome.
- **Autocorrelation and time trends.** Mood drifts over weeks after TMS; a response tried mostly in week 2 and another in week 10 are confounded with time unless choice is randomised throughout.

### The simplest honest method (implementable)
Per person *p* and response *r*, keep a normal–normal posterior for the **adjusted change** *y* = after-tap − before-score − expected rebound.
1. **Expected rebound** from the pre-score: fit once on pooled control data (or, for the demo, set from simulation): rebound = *a* + *b* × (person baseline − pre-score). Until enough control data exist, use a conservative prior for *b*.
2. **Prior** for each response from group evidence: mean μ₀,r (e.g. walking > breathing > nothing, scaled to the tap scale), SD τ (wide, e.g. equal to the trial-to-trial SD of change σ).
3. **Update** after *n* trials with mean adjusted change ȳ: posterior precision = 1/τ² + *n*/σ²; posterior mean = (μ₀,r/τ² + *n*·ȳ/σ²) / precision. σ is estimated pooled across people.
4. **Choose** with Thompson sampling: draw one value per response from its posterior, offer the highest — but with a **floor** (each vetted response at least 20%), and **log the probability** of the option shown.
5. **Settle** when one response has posterior probability > 0.8 of being best *and* at least 12 trials; keep the floor so drift and habituation can still be seen.
6. Group parameters (μ₀, *b*, σ) are re-estimated from all patients' randomised data; that pooled estimate is the scientifically defensible output.

This is shrinkage plus a bandit with logged randomisation; it does not claim a personal effect until the posterior is clearly away from zero, and by construction it says "group default" for most people for a long time.

Sources (B):
- Kronish review https://pmc.ncbi.nlm.nih.gov/articles/PMC5904006 ; bright-light N-of-1 series https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7151038/
- Bayesian n-of-1 methods: https://arxiv.org/pdf/1911.00878 ; https://repository.library.brown.edu/studio/item/bdr:1129426 ; https://digitalscholar.lsuhsc.edu/etd_sph/17
- NeCamp 2020 (above); Klasnja 2019 (above); MRT analysis methods https://arxiv.org/pdf/2004.10241 ; https://arxiv.org/pdf/2107.03544
- Habituation in messaging: https://arxiv.org/pdf/2502.09776 ; MRT engagement review https://pmc.ncbi.nlm.nih.gov/articles/PMC9276848
- Bandits: Kumar et al. 2024 https://mlanthology.org/aaai/2024/kumar2024aaai-using ; IntelligentPooling https://link.springer.com/10.1007/s10994-021-05995-8

---

## C. Does personalising help?

- **Personalised vs standardised psychotherapy.** Nye, Delgadillo & Barkham 2023 (J Consult Clin Psychol; 9 pooled RCTs, N=5,134): d=0.22 (95% CI 0.05–0.39) in favour of personalised treatment; smaller after removing high-risk-of-bias studies (search summary of the preprint; exact adjusted value not retrieved). Adolescents (Li 2024, 7 studies): d=0.21 (secondary). These personalise *treatment selection*, not quick responses.
- **Adaptive assignment of self-help modules.** Deakin bandit trial (`3-state-shifters.md` §E): context-based, between people; no per-person learning.
- **Personalised ESM feedback in depression.** Kramer et al. 2014 (World Psychiatry; 102 medicated outpatients with MDD, three arms): weekly feedback on personal positive-affect patterns was associated with a decline in depressive symptoms (secondary summary). The follow-up (Hoek/Kramer et al. 2015, PLOS ONE) found **no** larger increase in momentary positive affect in the feedback arm than in pseudo-feedback or control (abstract). Note this gave patients graphs and feedback, which our product rules out.
- **Do people's beliefs about what helps them match their data?** **No direct source found** comparing beliefs with ESM-measured effects. Indirect: people with MDD report blunted *anticipated* pleasure in daily life (Wu et al., ESM, 41 MDD vs 39 controls; abstract), while mood brightening shows the payoff when reached is not blunted (`3-state-shifters.md` §A) — so a person's prediction may undervalue an activity. Sad-music listeners *said* it helped while scores worsened (`3-state-shifters.md` §A). Users of an n-of-1 app followed their interpretation of results more than the results (same file, §E). Conclusion: do not let stated preference stand in for measured effect, but let people exclude options (see D).
- **Harm from self-tracking.** Systematic review in JMIR Mental Health 2025 (77 studies of mood monitoring/ambulatory assessment in depression): 15 reported adverse events, pooled prevalence 0.04; most common were burden/stress and mood worsening; underreporting likely; causality unclear (abstract). A meta-analysis of RCTs found no robust evidence that mood monitoring raises or lowers symptoms in unipolar depression (abstract, as quoted in search summary). **No source found** on harm from self-*experimentation* specifically.

Sources (C):
- Nye A et al. 2023 preprint https://eprints.whiterose.ac.uk/198062/8/Personalized_therapy_meta-analysis_pre-print_2023.pdf ; Li 2024 https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1470817/full
- Kramer 2014 / 2015 https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4452775/
- Wu H et al., anticipatory and consummatory pleasure in MDD https://profiles.wustl.edu/en/publications/anticipatory-and-consummatory-pleasure-and-displeasure-in-major-d/ ; dysphoria 2019 https://frontiersin.org/articles/10.3389/fpsyg.2019.02124/pdf
- Adverse events of mood monitoring https://mental.jmir.org/2025/1/e79500 ; https://research-information.bris.ac.uk/en/publications/adverse-events-of-mood-monitoring-and-ambulatory-assessment-in-de/

---

## D. A design that fits the product

### The trial unit
- **Before:** the twice-weekly check-in that detected the small dip *is* the before score. No extra question.
- **Suggestion:** one response, one button ("Start" / "Not now"). Whether "Start" was tapped is recorded.
- **After:** one optional tap 60–90 minutes later, the same face scale as the check-in ("How are you now?"). If unanswered, it is not asked again; missingness is recorded as data.
- Nothing else is asked. No scores or graphs are shown.

### How many candidates
**Two or three**, all from the supported list in `3-state-shifters.md` §A: e.g. a 10-minute walk (best acute evidence in depressed people), 3 minutes of mindful breathing (supported vs rumination in remitted patients), and a low-effort contact (text one named person). Never options with documented backfire (positive-memory recall, self-chosen sad music, cold water). More options split too few trials.

### Team idea 1: rotating the suggestion ("pseudo-randomising the one tap")
- **For variety:** the hedonic adaptation prevention model argues variety slows adaptation to positive activities, and a kindness study found varied acts adapted less than repeated ones (Sheldon, Boehm & Lyubomirsky 2012; the kindness result via secondary summary). Repetitive, predictable messages lost responsiveness in an 8-week messaging study (preprint, secondary).
- **Against variety:** in over 200,000 users of a happiness app, using a *wider* variety of positive activities went with *smaller* well-being gains (Okabe-Miyamoto, Margolis & Lyubomirsky 2023; correlational; abstract via search). Habit forms by repeating the same behaviour in the same context (Lally 2010: 96 people, median ≈66 days, range 18–254; about half not automatic at 84 days; missing one day did not matter — abstract/secondary), and context stability predicts automaticity (2022 study, secondary). When effort is impaired (`3-state-shifters.md` §D2), a fixed routine removes a decision.
- **What makes learning valid:** yes — choosing the option *at random with a known probability* is what turns each dip into a micro-randomised trial; a fixed suggestion can never be compared with anything, and a hand-picked rotation confounds the option with time and mood.
- **Recommendation: rotate first, then settle, never fully.** Weeks 1–6: random among 2–3 options with equal probability. Then Thompson sampling with a 20% floor per option. The cue (the prompt on a dip) stays fixed, which keeps the habit-forming part stable even if the response varies. **Let the person exclude an option** once, with one tap ("not for me"): forcing a disliked option wastes a trial and costs trust; exclusions are logged and are themselves information.

### Team idea 2: suggesting while well
- **Evidence that practice while well helps later:** continued skill practice after CT/MBCT lowered relapse indirectly through decentering (2019 JCCP, `3-state-shifters.md` §B/§D4). Regular leisure exercise of any intensity was associated with less future depression in 33,908 initially healthy adults over 11 years, most benefit within the first hour a week (Harvey et al. 2018, HUNT; abstract; observational). **Against:** an 8-week relapse-prevention programme after internet BA or physical activity added nothing over control in depression-free trajectories (Hlynsson et al. 2025, n=119 vs 143; abstract via search). Rehearsal also makes the response familiar before it is needed in a dip (plausible; no direct source found).
- **As a comparison for learning:** this is the ethical place to randomise *suggest vs nothing*, because nothing is withheld from someone who is low. But it estimates the effect *while well*, which the Intern Health Study suggests is smaller than the effect after low mood. So well-time trials give a lower-bound control and a rebound baseline, not the dip-time effect itself.
- **Cost:** answering fades 1–2% a week even among willing people (`plan.md`, citing `2-mental-measures.md`); burden/stress is the most common adverse event of mood monitoring (JMIR 2025 review). Each well-time suggestion adds one optional after-tap.
- **Recommendation:** at most **once a week**, only on a scheduled check-in day when the answer is at or above baseline, attached to that check-in (no new notification), randomised 50/50 suggest vs not, same after-tap. Turn it off for anyone whose answer rate drops.

### The "nothing suggested" comparison, without withholding help
1. **Well days:** randomised suggest vs nothing (above).
2. **Dips:** never withhold. Randomise *which* active response, and compare against the expected rebound estimated from (1) and from pooled data at similar pre-scores.
3. **"Not now" taps** are not a control (self-selected); log them, do not compare.

### Timing, stopping and what can be claimed
Assume about 1 dip-trial every 1–2 weeks plus 1 well-trial a week, i.e. roughly 1.5 trials a week, and some after-taps missing.

| After | Trials per person (rough) | What can honestly be said about *one* person | What can be said across patients |
|---|---|---|---|
| 4 weeks | ~4–6 | Nothing about effect. Only uptake: which option they start, which they exclude | Feasibility: tap-through and after-tap rates |
| 8 weeks | ~10–12 | Still the group default for almost everyone; can flag "never started" options | First pooled proximal effect estimate if many patients; rebound size |
| 12 weeks | ~15–18 | For a person with a very large effect (d≈1, needs ~16 per arm), "this response seems better than nothing for you"; ranking two active options: no | Pooled effects with credible intervals; whether effect is larger on dips; habituation over weeks |

**Stop** offering an option for a person when they exclude it, when its posterior probability of beating nothing falls below 0.2 after at least 8 trials, or on any sign of worsening after it (e.g. after-tap lower than before on three consecutive tries — flag to the clinic, not an automatic conclusion). **Stop the whole learning** if the answer rate falls or the person moves to the nurse-call tier: then only the fixed default is offered.

### What people are told
- **Patient:** "We'll suggest a few small things over the coming weeks, and over time favour the ones that seem to suit you. You can rule any of them out." No scores, ranks or graphs.
- **Clinic:** which responses were offered, started and excluded, and the after-tap answer rate; never "response X is effective for this patient". Pooled results are research output, reported separately.

Sources (D):
- Sheldon KM, Boehm JK, Lyubomirsky S 2012 https://sonjalyubomirsky.com/wp-content/uploads/2024/07/Sheldon-Boehm-Lyubomirsky-2012.pdf ; Okabe-Miyamoto K et al. 2023 https://sonjalyubomirsky.com/wp-content/uploads/2024/03/Okabe-Miyamoto-Margolis-Lyubomirsky-2023.pdf ; secondary https://in-mind.org/node/223
- Lally P et al. 2010 https://zendy.io/title/10.1002/ejsp.674 ; Gardner/Lally habit report https://ehps.net/ehp/index.php/contents/article/download/3346/1225/ ; 2022 context-stability study https://frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.883795/pdf
- Harvey SB et al. 2018, Am J Psychiatry 175:28 https://pubmed.ncbi.nlm.nih.gov/28969440/
- Hlynsson et al. 2025 relapse prevention after BA/PA https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1568141/full ; protocol https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3574037/
- Habituation https://arxiv.org/pdf/2502.09776 ; NeCamp 2020 (above); adverse events https://mental.jmir.org/2025/1/e79500

---

## E. A weekend demonstration

Recommended, if the "only if time" tier is reached:
1. **Simulated patient, labelled "SIMULATED".** Generate 12 weeks for one person with *known* true effects (e.g. walk +0.8 SD, breathing +0.3, contact 0), a realistic rebound after low scores, autocorrelation and 25% missing after-taps. Run the shrinkage + Thompson method from §B. Show on a developer/pitch screen (never the patient screen): (a) the posterior for each option narrowing slowly from the group prior; (b) a naive before/after average that wrongly shows *every* option, and even "nothing", helping — the regression-to-the-mean trap; (c) at 12 weeks, only the large effect is distinguishable. Plain TypeScript functions with Vitest tests asserting that the method recovers the planted effect within its interval over many simulated people.
2. **Optional real-data aside:** the Kossakowski diary (CC BY 4.0, one depressed person, 239 days). Compute `mood_cheerf` / `mood_down` at the next beep after `phy_physact` high vs low, controlling for the current beep's mood. Present as *association in one person*.
3. Template for the analysis structure: the synthetic HeartSteps-like data in `MRTAnalysis` (no mood).

**Sentence to say:** *"This is simulated data with effects we planted, to show the method and its limits: with two answers a week, one person's data only separates a large effect from nothing after about three months, so the system starts from the group evidence and moves slowly toward the person; the real research value is the pooled, randomised record across patients."* For the Kossakowski aside: *"This is one person's open diary; it shows mood moves with activity within a person, not that a suggestion caused it."*

---

## F. Ethics and safety

- **Never withhold or delay help at a dip for the sake of learning.** Randomise *between* vetted active options on dips; randomise "nothing" only on well days. The crisis path and any self-harm answer override the learning entirely.
- **Equipoise:** only options with acute evidence or plausible low risk go into the set; documented backfires (positive-memory recall in current depression, self-chosen sad music, cold-water immersion) are excluded (`3-state-shifters.md` §A).
- **What must never be learned from or optimised:** time in app, opens, streaks, tap-through on its own, or anything that rewards keeping the person on the phone. The reward is the after-tap mood change only, adjusted for rebound; a high tap-through with no mood change is not success. No dark patterns to get the after-tap.
- **Watch for harm:** an option followed by lower after-taps repeatedly is stopped and noted to the clinic; a falling answer rate stops the learning; burden is the commonest adverse event of monitoring.
- **No treatment claim:** the learning chooses among general wellbeing suggestions; it does not diagnose, dose or replace care. Say "the system favours the suggestions this person uses and reports feeling better after", never "personalised treatment" or "effective for this patient" (consistent with `plan.md` principle 4). A real study of effects would need ethics approval and registration as an MRT.
- **Consent and transparency:** the patient knows suggestions are varied on purpose and can opt out of the variation (receive one fixed suggestion) and exclude options.

Sources (F): as in A–E; no further sources.

---

## What this run could not check
- The JOPD Kossakowski codebook itself (variables taken from the `emaph` package documentation); exact response scales per item.
- openESM's dataset list (page did not load); whether any openESM dataset holds depressed people with activity and an intervention.
- StudentLife's licence and exact EMA items (site refused connection).
- Whether HeartSteps V1 or the Intern Health Study data are openly released (none found); the Intern study's full text and overall (unmoderated) effect.
- Whether HeartSteps' suggestion effect itself declined over days (only search summaries).
- Nye 2023 depression-specific and bias-adjusted effects; Kramer 2014 effect sizes.
- A mental-health example of Bayesian per-person (not per-context) estimates or of a per-person bandit with a mood outcome: none found.
- A study comparing people's beliefs about what helps them with their own ESM data: none found.
- Harm from self-experimentation specifically: none found.
- The kindness-variety experiment's original paper (only secondary coverage).
- Full texts in general: none of the key papers' full texts opened successfully (PMC and JMIR returned verification or empty pages).
