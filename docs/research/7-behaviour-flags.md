# Everyday behaviours that could flag a depression relapse to a clinician

Research run 2026-11-13. Subject: what a person does at home and with money, sensed by cheap home sensors or by records the person agrees to share. Physical signals, phone mobility, questionnaires, avoidance and non-response are covered in `1-physical-signs.md`, `2-mental-measures.md` and `../general-plan.md` section 3 and are not repeated here.

## Answer to the owner's question

**No. None of the everyday home or money behaviours has been shown to have high ability to predict a depression relapse.** I found no study that followed people after remission with home sensors (shower, laundry, kitchen, appliances, smart meters) or with bank data and showed that a change came before a relapse. The home-sensor depression studies are feasibility work in older adults with tiny samples: the most quoted one (accuracy "above 87%" with Wi-Fi sensing) had four people who finished, one of them depressed; the best other result reached AUROC 0.67, in a study whose abstract does not state its sample size. Money data has strong *population* links (unsecured debt and depression, OR about 2.8; 93% of people in one UK survey say they spend more when unwell; chaotic spending predicts missed payments 1-3 months ahead, in a preprint that reports no accuracy figure), but no study predicted depression or relapse from transactions, and what money data shows best is financial distress, gambling and mania-like spending, not depression. The records with the best evidence of coming *before* worsening are ones a clinic already half-holds: stopping antidepressants (relapse risk roughly doubles on discontinuation), missed appointments, and the person's own early-warning signs (restlessness, worry) tracked against their baseline. The honest framing for the team: home and money behaviours are **plausible, cheap, personal-baseline signals that may add context to a flag**, not predictors. Use them as "this changed for this person" only, require agreement with a stronger signal before anything goes to the clinic, and say in the demo that the predictive value is unproven.

---

## A. Self-care and household activity

### A1. What is known about self-care decline and depression

- Self-neglect and hygiene decline are linked to depression, mostly in older adults. In a Chicago Chinese elder population (n = 3,159), depressive symptoms were associated with self-neglect at every severity level, but per-point effects were small (OR 1.05 mild, 1.08 moderate/severe per unit of symptom score); personal hygiene was one of the self-neglect indicators. Source: Dong X et al., Chicago Chinese elder self-neglect study, summarised at https://ifh.rutgers.edu/?p=1369 (secondary coverage via search summary; full text not opened).
- A review reports depression in 51% of older self-neglecters versus 28% of non-self-neglecters (secondary, from search summary of a review at https://pmc.ncbi.nlm.nih.gov/articles/PMC2585676/; I did not open the full text to confirm the original study).
- A 2021 Australian qualitative study of practitioners described personal hygiene decline as part of depression and noted it is rarely listed in symptom lists or used as an outcome in research (search summary; source listed under the same search, not opened). This matters: the absence of studies is partly because nobody measures it.
- **Showering, laundry, cleaning, curtains, lights:** I found no study that measured any of these as a depression or relapse signal. They are face-valid (loss of energy, interest and self-care are core symptoms) but unmeasured.
- **Eating and cooking:** appetite change is a diagnostic criterion of depression, in either direction, which limits specificity. No sensor study of fridge or kitchen use for depression found, except kitchen movement appearing as a model feature (A2).
- **Time in bed outside sleep and leaving home:** covered by bed and mobility research in `1-physical-signs.md` and avoidance in `2-mental-measures.md` section F.

### A2. Ambient smart-home sensor studies

| Study | Sample | Sensors | Outcome | Result | Within-person? | Note |
|---|---|---|---|---|---|---|
| Dennis M, Prabhu D, Baker S, Silvera-Tawil D. 2024. *Stud Health Technol Inform* 318:144-149 (CSIRO/JCU). https://researchonline.jcu.edu.au/87207/ | Not stated in abstract; older adults in a 12-month smart home trial | Ambient motion sensors | Depression by Geriatric Depression Scale | Best model (XGBoost) AUROC **0.67**; bathroom and kitchen movement and level of home care among top features | Not stated; appears between-person classification | Abstract only. Modest accuracy. |
| Same group, IEEE EMBC 2023, "Detecting Depression-related Movement Changes in Older Adults using Smart Home Motion Sensors". https://pubmed.ncbi.nlm.nih.gov/38082851/ (DOI 10.1109/EMBC40787.2023.10340431) | Not found | Motion sensors, one-year trial | GDS at baseline, mid, end | "Movement patterns are generally reduced" when in a depressed state | Partly: GDS measured at three time points per person | Abstract via search summary; page blocked fetch. Feasibility only. |
| Rahimi SA et al. 2025. *JMIR Aging* 8:e67715 ("HOPE"). https://aging.jmir.org/2025/1/e67715 ; press release https://www.eurekalert.org/news-releases/1075523 | **6 enrolled, 2 withdrew; 4 analysed, 1 with depression** | Wi-Fi motion sensing | Depression in adults 65+ | Accuracy "above 87%" (press release); key features sleep duration, sleep interruptions, frailty | No | Sample size from search summary of the paper; press release omits it. The accuracy figure is meaningless with one depressed participant. |
| SMU "Unobtrusive monitoring to detect depression for elderly with chronic illnesses". https://ink.library.smu.edu.sg/sis_research/3982 | Not checked | Passive infrared motion | Mild depression | Up to 96% accuracy with a neural network | Not checked | Search summary only; best-case figure from a small study. |
| Smart electricity meters: 2020health report for Smart Energy GB (2020); LJMU trial. https://www.ljmu.ac.uk/about-us/news/articles/2020/11/18/smart-meter-data-could-help-identify-dementia | LJMU 2016 trial: **2 people with dementia** | Smart meter appliance use | Dementia; depression only proposed | No depression result | n/a | Industry-commissioned advocacy; no peer-reviewed depression study found. |

Water-flow or humidity sensors, smart plugs on washing machines, and bed sensors for depression: **no source found**.

### A3. Cheap sensing (prices are rough market estimates from general knowledge, not sourced in this run)

| Behaviour | Sensor | Rough price |
|---|---|---|
| Showering | Humidity/temperature sensor in bathroom (Zigbee) detecting humidity spikes | 15-25 EUR |
| Laundry, dishwasher, kettle, cooker | Smart plug with power metering; cycle = power above threshold | 15-30 EUR each |
| Fridge opening, front door | Door/contact sensor | 10-20 EUR |
| Room activity, kitchen and bathroom visits | PIR motion sensor | 15-25 EUR |
| Curtains/lights | Light sensor or smart bulb state | 10-20 EUR |
| Hub | Zigbee USB stick + Home Assistant on a Raspberry Pi or laptop | 30-80 EUR |

---

## B. Money and consumption

- **Debt and depression (strong association, direction unknown).** Richardson T, Elliott P, Roberts R. 2013. *Clin Psychol Rev* 33(8):1148-62. https://pubmed.ncbi.nlm.nih.gov/24121465/ . Unsecured debt and depression OR **2.77** (95% CI 2.50-3.07); any mental disorder OR 3.24. Cross-sectional studies dominate; authors say causality cannot be determined. Figures from abstract listing and secondary coverage.
- **Self-reported spending when unwell.** Money and Mental Health Policy Institute, "Money on your mind" 2016 survey of over 5,000 people with mental health problems: **93%** spent more than usual when unwell, 92% found financial decisions harder, 74% put off paying bills. https://www.moneyandmentalhealth.org/wp-content/uploads/2016/06/Money-on-your-mind-full-report.pdf (figures from search summary of the report and the institute's blog; self-selected sample, self-report, mixed diagnoses). Note this contradicts the intuition that depression only *reduces* spending: comfort and impulsive spending are reported.
- **Chaotic spending predicts financial distress ahead of time.** Muggleton N, Stewart N, Lee N et al., Warwick Business School with Lloyds Banking Group (preprint; https://arxiv.org/pdf/2111.06908v1.pdf ; coverage https://wbs.ac.uk/news/how-banks-can-use-data-analytics-to-identify-early-signs-of-financial-trouble ). Argus credit card data n = 190,429 and Lloyds n = 100,963. Higher "spending entropy" (spending spread unpredictably across categories) in one month predicted missed payments **one and three months later**. No accuracy metric reported; **no mental-health outcome**. This is the only true ahead-of-time result I found, and it predicts money trouble, not depression.
- **Gambling.** Muggleton N et al. 2021. *Nature Human Behaviour* 5:319-326. https://www.ox.ac.uk/news/2021-02-04-gambling-research-fun-can-stop-unemployment-ill-health-and-even-death . Bank data on up to 6.5 million UK customers over up to seven years; gambling share of income associated with later financial distress, unemployment, disability and, at the highest levels, higher mortality. Associational; cash betting not seen. Specific mental-health outcomes not confirmed in what I read. Comorbidity: in population surveys of problem gamblers, any mood disorder 37.9% (Lorains FK, Cowlishaw S, Thomas SA. 2011. *Addiction* 106(3):490-8; search summary); in treatment-seeking gamblers, current major depression 29.9% (Dowling NA et al., meta-analysis, search summary; https://pmc.ncbi.nlm.nih.gov/articles/PMC4438101 not opened).
- **Transaction data and mental health directly.** A 2026 UCD scoping review (Frontiers in Public Health) found only **4 of 43** studies on finances and mental health used objective financial records (https://moodmoney.ucd.ie/research/financial-stress-mental-health ; search summary). The UCD Mood & Money Lab runs a feasibility study of bank data and mood in **bipolar disorder**. The published transaction-and-mood work is a **single-participant** bipolar case study (Blair et al., *Frontiers in Psychiatry* 2022, https://www.frontiersin.org/articles/10.3389/fpsyt.2022.810057 ) plus a 2026 commentary on it (https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2025.1742262/full ). Search summaries only.
- **Personality from spending.** Gladstone JJ, Matz SC, Lemaire A. 2019. *Psychological Science*. https://discovery-pp.ucl.ac.uk/10076117/1/Gladstone_0956797619849435.pdf . Bank records of n = 2,193 predicted traits including neuroticism with modest accuracy (search summary; exact figures not checked). Traits are not states, so this does not support relapse detection.
- **Grocery, food delivery, loyalty cards, alcohol purchases, subscription lapses:** no study linking these to depression or relapse found in this run.

**What else a money change can mean:** heavy, burst or risky spending points first to hypomania or mania (bipolar), gambling disorder or substance use; missed bills and rising debt point to plain poverty, job loss or cognitive decline as much as to depression; reduced spending can be saving, holiday or a partner paying. Money data has the worst specificity for depression of anything in this file.

---

## C. Risk behaviours and clinical warning signs

- **Alcohol.** The evidence that alcohol use predicts the course of depression is mixed. In the Dutch NEMESIS-2 cohort, alcohol use did not predict persistence of major depression over 3 years; the authors' review found two earlier studies with higher relapse risk and three with none. https://pmc.ncbi.nlm.nih.gov/articles/PMC9971850/ (full text summary via search). Alcohol remains a clinically relevant risk factor (it worsens mood and interacts with medication) but is not a validated relapse predictor.
- **Gambling:** see B.
- **Early warning signs within a person.** Smit AC, Snippe E. 2022/2023. *Psychological Medicine*. https://pmc.ncbi.nlm.nih.gov/articles/PMC10476069/ (full text). 41 remitted adults tapering antidepressants, smartphone ratings five times a day for four months, personal control charts on "I feel restless": 22 recurred. Restlessness rises caught **15 of 22** recurrences (sensitivity ~68%) and fired in **5 of 19** who stayed well (specificity ~74%); in 10 of 15 the rise came at least a month before symptoms were noticed. A related study found increases in repetitive negative thinking the most sensitive early sign (search summary). Dynamical "early warning signals" preceded recurrence in only ~33% (search summary, Clinical Psychological Science 2024). This is self-report, not a home sensor, but it is the best within-person evidence available and it sets the bar: even the best signals are ~70% sensitive with ~25% false alarms.
- **Personal relapse signatures.** An older qualitative study found prodromes vary between people but are fairly consistent within a person, and patients often attribute them to stress or weather (search summary; study at https://news.umich.edu/?p=1551 not opened). Clinicians' relapse-prevention plans ask patients to list their own early signs; this supports letting the patient name *which* everyday behaviours are theirs (for example "I stop doing laundry").
- **Withdrawal from contact, night-time activity:** covered in `1-physical-signs.md` (phone, sleep) and `2-mental-measures.md` (avoidance).
- **Crisis warning signs** (giving away possessions, talk of hopelessness, sudden calm, reckless behaviour) are part of standard suicide-risk guidance, but this run did not look them up and found **no evidence that a home sensor can detect them**. They belong in a safety plan and clinician contact, not in a sensor model. A system like this should never be presented as a crisis detector.

---

## D. Other everyday records

| Record | Evidence (one or two lines) | Source |
|---|---|---|
| Antidepressant refills or stopping | Stopping antidepressants after remission raises relapse; maintenance vs discontinuation OR **0.38** (95% CI 0.33-0.43) in Kato M et al. 2021, *Mol Psychiatry* 26:118-133 (figure from a secondary citation, not the paper). Refill gaps flag discontinuation (claims data: a 14-day gap in the first 90 days flagged 4 of 5 who discontinued). Many post-TMS patients may not be on medication. | https://link.springer.com/content/pdf/10.1038/s41380-020-0843-0.pdf ; https://pmc.ncbi.nlm.nih.gov/articles/PMC5033109 (search summaries) |
| Pill-box openings | No depression relapse study found. | no source found |
| Missed appointments | About 20% of mental health appointments missed; up to 50% of those patients drop out; non-attenders were more unwell and impaired (Killaspy 2000, n = 365). Mitchell & Selmes review: those who do not re-book risk relapse and readmission. Narrative evidence, no prospective prediction figure. | https://www.cambridge.org/core/product/5E3E809B3FC76807765328FC1F05CB7D (search summary) |
| Sick leave, work attendance | 37% of 540 Japanese employees had a recurrent depression sick leave after returning (Endo 2015); recurrence of absence predicts slower return to work (Ervasti 2017 meta-analysis). Sick leave is an outcome of relapse more than an early sign. | https://www.springermedizin.de/risk-factors-of-recurrent-sickness-absence-due-to-depression-a-t/8475854 (search summary) |
| Social media posts | Eichstaedt JC et al. 2018 *PNAS* 115(44):11203: Facebook language of 683 ED patients (114 depressed) predicted a depression diagnosis in records with AUC **0.69**, up to 3 months before diagnosis. Between-person, first diagnosis, not relapse. | https://pmc.ncbi.nlm.nih.gov/articles/PMC6217418 (abstract via search) |
| Music streaming | Last.fm studies: higher depression-risk users listen more repetitively and to more "sad"-tagged music (n = 541; 142 vs 193). Bristol "Mood Music" (171 participants, Spotify + PHQ-9 + EMA): results not confirmed. Between-person, small. | https://www.arxiv.org/pdf/2408.15575 ; https://ijpds.org/article/view/3326 (search summaries) |
| Calendar, email, messaging volume | Not found in this run (phone communication is in `1-physical-signs.md`). | no source found |
| Video streaming, gaming time | Not found. | no source found |
| Smart-speaker use | Not found. | no source found |
| Car use | Not found. | no source found |

---

## E. Honest ranking

Evidence strength refers to depression worsening or relapse, not to any association.

| Behaviour | Evidence strength | Shown to move within a person before relapse? | Specific to depression? | Cost to sense | Intrusiveness |
|---|---|---|---|---|---|
| Self-reported early signs (restlessness, worry) on personal baseline | Moderate | **Yes** (68% sens, 74% spec, n = 41) | Moderate | Free (app) | Low |
| Stopping antidepressant / refill gaps | Strong (discontinuation raises relapse) | Indirectly (cause rather than sign) | Low-moderate | Pharmacy record or self-report; free | Moderate |
| Missed appointments | Weak-moderate (narrative) | Not shown prospectively | Low | Clinic already has it | Low |
| Social media language | Moderate for first diagnosis | No (between-person, before diagnosis) | Moderate | API access, NLP | High |
| In-home motion (kitchen, bathroom, overall) | Weak (AUROC 0.67; feasibility) | Partly (GDS at 3 time points, one study) | Low | 15-25 EUR per sensor | Moderate |
| Wi-Fi motion / sleep sensing | Weak (n = 4) | No | Low | Router-based, varies | Moderate |
| Unsecured debt, missed bills | Moderate as association (OR 2.8) | No | Low (poverty, many causes) | Open banking or self-report | **High** |
| Spending volume / impulsive spending | Weak (self-report survey) | No | Low (points more to mania) | Open banking or CSV | **High** |
| Spending entropy (chaotic spending) | Moderate for financial distress | Yes, 1-3 months ahead, **for financial distress only** | None shown for depression | Open banking or CSV | **High** |
| Gambling transactions | Moderate for harm, association only | No | Low (gambling disorder) | Open banking | **High** |
| Sick leave | Weak as early sign | No (an outcome) | Low | Employer record | High |
| Music listening | Weak | No | Low | Streaming export | Moderate |
| Alcohol use / purchases | Weak, mixed | No | Low | Self-report or transactions | High |
| Self-neglect / hygiene (general) | Weak-moderate in older adults (cross-sectional) | No | Low (also dementia, frailty) | n/a | n/a |
| Showering (humidity) | None found | No | Unknown | 15-25 EUR | **High** (bathroom) |
| Laundry / appliances (smart plug) | None found | No | Unknown | 15-30 EUR | Low-moderate |
| Fridge / cooking | None found (kitchen motion is a model feature) | No | Low (appetite goes both ways) | 10-20 EUR | Moderate |
| Curtains / lights | None found | No | Unknown | 10-20 EUR | Low |
| Smart electricity meter | None for depression (n = 2 dementia) | No | Unknown | Utility data | Moderate |
| Pill-box openings, calendar, email, gaming, video, smart speaker, car | None found | No | Unknown | Varies | Varies |

**Which have high predictive ability: none.** The strongest items are not home or money sensors at all: the person's own early-sign ratings against their baseline, and medication stopping. **Plausible but unproven:** reduced household routine (laundry, cooking, showering, kitchen and bathroom visits) and leaving home less, measured against the person's own baseline; money signals are plausible for bipolar mood shifts and financial distress but not shown for depression.

---

## F. Flagging without diagnosing

### F1. False alarms and alert fatigue

- In hospital monitoring, 72-99% of alarms are technically false or clinically irrelevant; IT-based filtering helps. Chromik J et al. 2022, *Frontiers in Digital Health*, systematic review of 69 studies (ICU, not home). https://www.frontiersin.org/articles/10.3389/fdgth.2022.843747/full (search summary).
- Remote patient monitoring: high sensitivity settings produce frequent false-positive alarms (Arora et al., arXiv critical review; search summary). I did not find a systematic review specific to home mental-health monitoring.
- Base-rate arithmetic from Smit & Snippe: with ~70% sensitivity and ~75% specificity and, say, a 20% chance of relapse in a 3-month window, more than half of flags would be false. A clinic with 100 patients would get about 34 flags per quarter from one signal alone (14 true, 20 false), so about 59% of them are wrong. That is why agreement between signals matters.

### F2. How many signals should agree

No published rule for depression monitoring was found. Design inference (not evidence): require a sustained change (for example 7-14 days, not one day) in at least two independent channels, one of which is the patient's own report, before a clinic flag; single-channel changes go only to the patient as a suggestion.

### F3. EU rules

- **Medical device.** Under MDR, software qualifies by its intended purpose. MDCG 2019-11 Rev.1 (June 2025): Rule 11 classifies software that provides information for diagnosis or therapy decisions, typically class IIa or higher, and software that monitors physiological processes under Rule 11b. https://openregulatory.com/mdcg/mdcg-2019-11 ; https://health.ec.europa.eu/document/download/b45335c5-1679-4c71-a91c-fc7a4d37f12b_en (search summaries; Annex examples not read). A system whose stated purpose is to detect or predict relapse for a clinician is very likely a medical device; "never diagnoses" wording does not by itself avoid this if the purpose is clinical. `5-products-and-gap.md` section E has more.
- **AI Act.** AI that is (part of) a medical device needing a notified body (class IIa and up) is high-risk; under the provisional 2026 Digital Omnibus deal, those obligations apply from 2 August 2028 (sources disagree on whether the deal is final). https://meddeviceguide.com/blog/eu-ai-act-omnibus-amendment-2026-medical-device-impact-guide (secondary).
- **GDPR, health inferences.** CJEU Lindenapotheke, C-21/23, 4 Oct 2024: online orders of pharmacy-only medicines are health data under Article 9 even though health is only inferred with some probability, and whether the inference is accurate does not matter. https://www.medialaws.eu/comment-on-cjeu-c-21-23-lindenapotheke/ (secondary). Consequence: shower counts, laundry cycles and spending patterns become **special-category health data** once processed to infer mood; explicit consent (Art. 9(2)(a)) or a health-care basis is needed.
- **Automated decisions.** CJEU SCHUFA, C-634/21, 7 Dec 2023: an automated score counts as a decision under Article 22 when a human decision-maker draws strongly on it. https://iapp.org/news/a/key-takeaways-from-the-cjeus-recent-automated-decision-making-rulings (secondary). A relapse flag that a clinic acts on almost automatically could fall here; a flag reviewed by a clinician with the underlying data is safer.
- **Bank data.** PSD2 account information services require the account holder's consent and, since the 2022 amendment of the RTS (applied from mid-2023), re-authentication every **180 days** instead of 90. https://www.vixio.com/insights/pc-90-becomes-180-eba-makes-key-sca-change (secondary). A hackathon team is not a licensed AISP; a demo should use a user-exported CSV or synthetic data.

### F4. Ethics of monitoring money and bathroom use

Ambient sensors collect data without the person interacting, raising the risk of non-consensual collection; consent should be ongoing and revisable, not one-time; bathroom monitoring is the clearest dignity concern in ambient-assisted-living literature; privacy-protective defaults include local storage and minimal data. Sources: COST Action GoodBrother position paper https://philarchive.org/archive/AKEPPO ; Frontiers in Digital Health 2025 "Designing for dignity" https://www.frontiersin.org/articles/10.3389/fdgth.2025.1643238/full (search summaries).

### F5. Design rules the team can adopt

1. **Flags describe change, not illness.** Never "possible depression". How much of the change the clinician sees is set by F6: by default the broad area, with the measure itself released only when the patient agrees.
2. **Two channels, sustained, one self-reported.** No clinic flag from a home or money signal alone, and none from home and money signals agreeing only with each other: the patient's own report must be one of the agreeing channels, and the change must last at least a week. Other channels can add to the self-report but cannot replace it.
3. **The patient sees first and can veto.** Every signal is shown to the patient before the clinic; the patient chooses which channels exist (for example laundry yes, bathroom no, bank no), approves each once at setup, and can switch any off at any time, deleting its history. Whether the patient can also hold back an individual flag is a decision for the team; this report assumes not, since a person who is getting worse may hide it.
4. **Derived counts only, on the device.** Store "shower events per day", not humidity traces; store category totals, not merchants or amounts. Raw data never leaves the home.
5. **Money is opt-in and last.** It is the most intrusive and least specific channel; if used, the patient sees only a coarse change (for example "spending pattern much less regular than usual"), never merchants, and is told it may reflect money stress rather than mood. The clinic sees at most the area "financial routine" (F6).
6. **Not a crisis service.** State plainly that the system does not detect emergencies and give the crisis contact in the app.
7. **Personal baseline, personal signature.** Let the patient name their own early signs at the start ("when I'm getting ill I stop cooking") and weight those channels.

### F6. The stricter proposal: the doctor gets only "a flag was raised", the patient approves each method

The team member proposed: "the doctor only gets the info that flag has been raised, not what raised the flag", with the patient approving each method because the methods are intrusive.

**(1) Published designs where the clinician gets an alert without the data or its cause.**
- **No study found** of a mental-health remote-monitoring system that sends clinicians a content-free flag. The privacy-preserving work I found is about *where computation happens*, not about what the clinician sees: federated and edge learning keep raw data local and share only model updates or outputs (a 2026 systematic review of federated/edge approaches to mental-health risk prediction, https://shura.shu.ac.uk/37632/1/2026221696.pdf ; the EU FAITH project for cancer survivors, https://cordis.europa.eu/project/id/875358/reporting ; search summaries). None reports what clinicians did with the alerts.
- **"Break the glass" and segmented records** exist in electronic health records: sensitive (for example behavioural-health) sections are hidden by default and opened only with a stated reason, time limit and audit log. This is a working pattern for *tiered disclosure*, but what I found is vendor and practice material, not outcome studies (https://www.forcepoint.com/fr/blog/insights/break-glass-emergency-access-protocols ; search summary). Known practical problem from the same sources: if breaking the glass is easy it becomes routine; if hard it delays care; audits of every access are often not done.
- **Closest outcome evidence, from cardiology: an alert that says little can increase use of care without benefit.** DOT-HF (*Circulation* 2011, first author not confirmed in this run; https://clinicaltrials.gov/study/NCT00480077 ; search summary): 335 heart-failure patients whose implanted device gave an audible alert on a composite fluid index. The alert arm had **250 vs 84** outpatient visits and more heart-failure hospitalisations (HR 1.79, 95% CI 1.08-2.95), with no difference in deaths; trial stopped early for slow enrolment. Different illness and the alert went to patients, but it is the best controlled example of what a non-specific alert does to a care system: it generates visits that find nothing.

**(2) Do clinicians act on alerts without an explanation?**
- No study found comparing content-free alerts with alerts naming the changed measure in remote monitoring. The nearest evidence is on explainable decision support. A 2024 systematic review in *JMIR AI* (first author not confirmed in this run, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11561425/ ; search summary) found explanations raised clinicians' trust in 5 studies when they were clear, concise and clinically relevant, but also that explanations can produce over-trust in wrong advice. One study reported override rates of 73.9% for minimal-transparency versus 49.3% for moderate-transparency AI suggestions (search snippet; setting and peer review not confirmed). Alarm-fatigue reviews (F1) show that clinicians learn to ignore alarms that are often irrelevant; an alert with no cause gives them no way to judge relevance.
- Practical consequence (inference, not evidence): a clinician receiving "flag raised" with nothing else can only call the patient and ask. That is not useless (contact itself is the intervention in many relapse-prevention programmes), but it cannot be triaged: every flag costs a call, and a clinician cannot tell a laundry dip from a sleep collapse. A clinician who has acted on a flag is also likely to need to record why, which a content-free flag cannot support.

**(3) Per-method consent and what patients accept.**
- Dynamic (ongoing, revisable) consent: a 2023 scoping review (Lee et al., *BMC Medical Ethics*, https://link.springer.com/doi/10.1186/s12910-023-00988-9 ; search summary) found it associated with transparency and mostly positive patient responses; barriers were the burden it puts on individuals, digital inequity and implementation. A 2023 *JMIR* review of patient views (Kassam et al., https://jmir.org/2023/1/e42507/PDF ; search summary) found consent preferences context-dependent. A 2026 preprint on granular consent in cardiac prevention notes that more choices also mean more load and that little is known about how people use granular controls in practice (https://arxiv.org/pdf/2608.03533 ; search summary).
- What people say they accept: in a 2019 *JMIR mHealth uHealth* survey of sensed-data sharing (https://mhealth.jmir.org/2019/4/e12578/ ; search summary), people were more comfortable sharing with their doctor than with family or the health record; **89%** would share sleep data with a doctor but only **57%** location; communication logs and social activity were shared least; having depression or anxiety did not change comfort. Perceived control and useful feedback raised willingness. In a qualitative study of people with depressive symptoms, participants were uncomfortable sharing voice samples and wanted more transparency about use (search summary).
- **Money and the home:** no published acceptability result found for people with depression. The UCD Mood & Money Lab interviewed 19 adults with bipolar disorder about data-sharing preferences for financial data (Pervasive Health 2026); results not found in this run (https://moodmoney.ucd.ie/ ). Bathroom monitoring is the clearest dignity objection in ambient-assisted-living ethics (F4). So per-method approval is well supported in principle; whether patients would approve money or bathroom sensing is unknown.

**(4) EU legal angle.**
- GDPR Article 5(1)(b)-(c) (purpose limitation, data minimisation) and Article 25 (data protection by design and by default) favour sending as little as needed for the purpose. Sending a flag rather than raw data is a strong minimisation measure. (Article text from general knowledge; not re-read in this run.)
- **It does not remove the obligations.** The flag is itself health data about an identified patient (Lindenapotheke, F3: inferred health is Article 9 data whatever its accuracy), so explicit consent or a health-care basis, transparency, and rights of access still apply to the flag and to whatever model produced it. On-device processing: EDPB guidance on connected vehicles recommends local processing by default; commentary notes purely personal processing can fall under the household exemption, but that exemption does **not** cover the provider who supplies the means of processing, and ePrivacy Article 5(3) requires consent to read information stored on the user's terminal equipment (https://www.edpb.europa.eu/system/files/2026-05/edpb-summary-connected-vehicles_en.pdf ; https://fpf.org/2020/02/19/edpb-draft-guidelines-on-connected-cars-focus-on-data-protection-by-design-and-push-for-consent/ ; secondary). So: keeping raw data on the patient's device reduces risk, breach impact and the data the clinic must protect, but the team (as provider of the software) and the clinic (as receiver of the flag) remain controllers for the inference.
- A content-free flag does not escape the medical-device question either: the intended purpose (alerting a clinician to possible relapse) is what qualifies software, not how much detail the alert shows (F3). It may make the Article 22 risk *worse*, not better: if clinicians act on a bare score they cannot inspect, the flag drives the decision more fully (SCHUFA reasoning, F3), and the patient's right to an explanation is harder to meet.

**Recommendation: how much should a flag say?**
**The broad area, by default; the measure itself only with the patient's approval at the time; never nothing.**
- *Nothing* ("a flag was raised") is the most private, but there is no evidence clinicians can use it, it cannot be triaged, the DOT-HF experience suggests non-specific alerts create visits that find nothing, and it does not reduce the legal obligations much.
- *Broad area* (for example "daily routine", "sleep", "activity outside home", "self-report") lets the clinician judge urgency and choose the right question, while not revealing which sensor or which bathroom or bank detail. Caveat: if a patient has only one channel in an area, the area reveals the measure; group areas so each holds at least two channels, or say so to the patient.
- *The measure itself* ("laundry cycles 0 in 14 days") released only when the patient taps "share details" on that flag, or in the conversation the flag leads to. This is tiered disclosure with the patient holding the glass, and matches what patients say they want (control, transparency) and what the law favours (minimisation, consent per purpose).
- **Money is never shown as a measure to the clinic** in the default design, only as the area "financial routine" if the patient has opted in to it at all.
- Combined with rules 2-3: the patient sees the measure first, approves each method once at setup and can withdraw any method at any time, and the clinic sees the area only when two channels agree, one of them the patient's own report.

---

## G. A weekend demo

1. **Smart plug on the washing machine (or kettle/cooker).** Power above a threshold = one cycle. Show a personal baseline (cycles per week), a dip, and a patient-facing nudge. Real hardware is cheap and quick (smart plug with power metering + Home Assistant, or simulated data). What to say: "Self-care and household routine are part of depression, but no study has tested laundry as a relapse signal. We show it as a personal-routine marker the patient chose."
2. **Bathroom humidity sensor for showers.** Humidity spike detection is simple. What to say: "No evidence it predicts relapse; included only to show on-device counting and patient consent per room. Many users will refuse it, and that is fine."
3. **Categorised transaction CSV (synthetic).** Compute spending regularity (entropy across categories) and late bills against the person's baseline. What to say: "Chaotic spending predicted missed payments one to three months ahead in 290,000 UK customers, in a preprint that gives no accuracy figure, and that is financial distress, not depression. We show it as optional context only."

In each case, the flag to the clinic in the demo should fire only when the device signal agrees with a drop in the patient's own check-in (the stronger signal), which demonstrates rule 2.

---

## Could not check in this run

- Sample sizes for the EMBC 2023 and Dennis 2024 smart-home studies (abstracts only; PubMed blocked fetch).
- Full text of the HOPE paper; the n = 6 / 4 analysed figure came from a search summary of the paper.
- Kato 2021 maintenance odds ratio (secondary citation only).
- Money and Mental Health 2016 figures beyond the search summary; impulsive-spending percentage.
- Whether Muggleton 2021 gambling paper reports specific mental-health outcomes.
- ORCATECH and CASAS smart-home cohorts (no depression result surfaced).
- Any study of showering, laundry, water use, fridge use, pill-box openings, calendar or email volume, gaming, video streaming, smart speakers or car use for depression: none found.
- Grocery, loyalty-card and food-delivery data for depression: none found.
- Published threshold rules for multi-signal agreement in mental-health monitoring: none found.
- MDCG 2019-11 Annex classification examples, AI Act final timeline, and the full judgments of C-21/23 and C-634/21 (secondary sources only).
- Sensor prices are rough estimates, not sourced.
- F6: no study found of content-free clinician alerts in any remote-monitoring setting, nor any comparison of alerts with and without the cause; no acceptability data for money or home sensing in depression; the final EDPB voice-assistant text on purely on-device processing; GDPR article texts were not re-read. The DOT-HF primary endpoint is reported differently in the registry (p = 0.063) and the paper.
- Standard clinical crisis warning-sign lists were deliberately not researched in detail.
