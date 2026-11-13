# Physical and behavioural signs of depression measurable at home

Checked 2026-11-13 with web search, building on `../evidence-check.md` (section 5). Most sources were read at abstract or search-snippet level. Full text was read only for Cummins et al. 2023 (speech) and the Mental Elf review of Tonon et al. 2026 (actigraphy). Figures marked "(secondary)" come from news or aggregator pages, not the paper. "No source found" means this run found none, not that none exists. Prices are rough consumer prices from general knowledge of the market, not checked in this run; treat them as estimates.

**Key distinction used throughout.** *Group marker*: differs between depressed and healthy groups. *Within-person marker*: moves inside one person as they worsen or recover. A maintenance product needs the second.

---

## 1. Rest-activity rhythm and sleep regularity (actigraphy)

- **Change in depression.** Flatter day-night contrast (lower relative amplitude), less regular sleep timing, more night-time activity and wake after sleep onset.
- **Group effect.** See section 3 for daytime activity. For rhythm specifically no pooled meta-analytic effect size was found in this run.
- **Within-person / relapse: yes, the best evidence of any sign.** Tonon et al. 2026 (JAMA Psychiatry; CAN-BIND Wellness Monitoring), 93 remitted adults wearing a research actigraph (GT9X) for up to 2 years, ~32,000 device-days, 28 relapses (median 33 weeks). Lower relative amplitude predicted relapse at baseline (HR 0.45, 0.29–0.70) and in time-varying models (HR 0.45, 0.21–0.97); higher composite phase deviation (irregular timing) HR 1.76 (1.04–2.98); higher wake after sleep onset HR 1.77 at baseline. Sleep regularity index predicted at baseline (HR 0.46) but not in the time-varying model. The 2 weeks before relapse were excluded, so signals came at least 2 weeks early. Caveats: small subgroups, some longitudinal effects only trends, industry support, mostly white sample, no replication yet.
- **Correction from a later spot-check** of the Tonon study against the JAMA Psychiatry abstract page and secondary coverage: 23 relapses (not 28), median follow-up 46 weeks; hazard ratios 0.45 for relative amplitude, 0.46 for sleep regularity, 1.77 for wake after sleep onset and 1.86 for night-time activity. The "28 relapses" and "up to 2 years" above were not confirmed, and neither was a lead time of two weeks.
- Minaeva et al. 2024 (Sci Rep; in evidence check): actigraphy change points near the transition in 69% of people tapering antidepressants.
- Sleep variability (day-to-day SD of sleep timing/duration) predicted mood and depression in a prospective cohort of training physicians with a wearable and phone mood app, with a size similar to mean sleep parameters (PMC7892862). RADAR-MDD: intra-individual variability in total sleep time and fragmentation linked to relapse (record found, not read).
- **Specificity.** Low: shift work, travel, newborns, alcohol, illness, seasons, retirement all disturb rhythm. Use as change from the person's own baseline and ask the person when it moves.
- **Sensor.** Wrist accelerometer (any watch or band, 30–150 EUR; research GENEActiv/ActiGraph more), ring (Oura ~350 EUR + membership), or phone accelerometer/screen-on logs (free, weaker). Raw data: Fitbit, Garmin and Oura give summaries via APIs; minute-level raw acceleration usually locked. Open-firmware bands or a microcontroller IMU (Bangle.js, PineTime, ~70 EUR) give raw data.
- **Baseline.** 7 full days is the most cited minimum for interdaily stability (Lok et al. 2025 in sleep-clinic patients; Acebo 1999); 5 valid days enough in older adults with ≥2/3 wear time (Danilevicz 2024). Tonon used 2-week epochs. A personal baseline therefore needs 2–4 weeks of regular wear.
- **Pitfalls.** Device must be worn at night; charging gaps; consumer sleep staging is inaccurate (count timing and regularity, not stages); Sadeh-type scoring underestimates wake.

Sources:
- Tonon AC et al. 2026, JAMA Psychiatry, one-year actigraphy study (via Mental Elf review). https://www.nationalelfservice.net/mental-health/depression/sleep-and-rest-activity-rhythms-in-depression-relapse-can-wearables-see-the-storm-coming/ ; news https://www.eurekalert.org/news-releases/1115855
- Training-physician cohort (Intern Health Study), sleep variability. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7892862/
- RADAR-MDD wearable sleep and relapse (record only). https://ouci.dntb.gov.ua/works/4YEx06a4
- Days needed for rhythm metrics: Danilevicz 2024 https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11490056/ ; Lok et al. 2025 https://zendy.io/title/10.1111%2Fjsr.14332

## 2. Sleep duration, onset latency and fragmentation

- **Change.** Longer sleep onset latency, more fragmentation; duration can go either way (insomnia or hypersomnia).
- **Group effect.** A 2026 JMIR meta-analysis of digital biomarkers (22 studies, 6,947 people) found significantly longer sleep onset latency in depression and concluded no single marker is sufficient (pooled number not extracted). https://www.jmir.org/2026/1/e76432/PDF
- **Within-person.** Some: see section 1 (variability and fragmentation more predictive than mean duration).
- **Specificity.** Very low (stress, pain, alcohol, caffeine, apnoea, medication, children).
- **Verdict.** Use regularity and fragmentation, not raw duration.

## 3. Amount of movement (daytime activity, step count)

- **Group effect.** Wüthrich et al. 2022 (Psychol Med; 34 studies, 1,804 patients): actigraphic activity lower in patients, SMD −0.78. Unipolar depressed **−0.82**; unipolar remitted **−0.28** (CI −0.56 to 0.0). Bipolar euthymic stayed low (−0.92).
- **Within-person: yes.** The drop from −0.82 to −0.28 between episode and remission in unipolar depression means activity is largely a state marker. Burton et al. 2013 (16 studies, 412 patients): daytime activity rose during treatment (SMD 0.53), night activity fell (−0.36).
- **Specificity.** Low: fitness, injury, illness, weather, season, job, age.
- **Sensor.** Phone step counter (free; Android Health Connect / Apple HealthKit give step data) or any band. Data generally accessible.
- **Baseline.** 1–2 weeks; weekday/weekend split needed.

Sources:
- Wüthrich F et al. 2022, Psychol Med. https://cambridge.org/core/journals/psychological-medicine/article/actigraphically-measured-psychomotor-slowing-in-depression-systematic-review-and-metaanalysis/C9BDE71C3CB9862231242A55A23CDC60
- Burton C et al. 2013, systematic review and meta-analysis of activity monitoring. https://abdn.elsevierpure.com/en/publications/activity-monitoring-in-patients-with-depression-a-systematic-revi/

## 4. Gait speed and posture

- **Group / prospective.** Slow gait predicts later depressive symptoms: pooled OR 1.93 (1.54–2.42, 11 studies) in a meta-analysis of cohort studies; Guimarães et al. 2026 (J Affect Disord) confirms with 10 low-risk-of-bias studies (pooled figure not read). ELSA cohort: association is bidirectional.
- **Within-person.** None found at weekly timescale; evidence is in older adults over years.
- **Specificity.** Very low (age, frailty, pain, neurological disease).
- **Sensor.** Phone IMU (iOS reports walking speed in HealthKit; Android does not by default).
- **Posture.** No source found in this run.
- **Verdict.** Weak for maintenance in working-age adults.

Sources: meta-analysis record https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_2453686125 ; ELSA https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3706406/ ; Guimarães 2026 (secondary) https://www.emjreviews.com/general-healthcare/news/slower-walkers-at-higher-risk-of-depression/

## 5. Heart rate variability (HRV)

- **Group effect.** Koch et al. 2019 (Psychol Med 49:1948): lower resting HRV in depression; HF-HRV g = −0.32, RMSSD g ≈ −0.46 (figures from bibliographic records; full text not read). Small to moderate.
- **State or trait.** Mixed. Remitted patients often do not differ from controls (fully remitted MDD study, Acta Neuropsychiatrica); in NESDA, low HRV in current and remitted depression depended largely on medication. Tricyclics lower HRV; SSRIs much less (Kemp 2010).
- **Within-person: some, weak.** A 2025 analysis of five longitudinal consumer-wearable studies found HRV associations look trait-like; within-person correlations with prior-day mood were non-significant. A 2025 JMIR study reported within-person HRV associations in the same direction as between-person (no sizes in snippet). TMS link: rTMS lowers resting heart rate and raises HRV (meta-analysis cited in the WARN-D protocol, 2026); a 2025 RCT saw HR fall and HRV rise during iTBS.
- **Specificity.** Very low: age (strongest), fitness, alcohol (large next-night drop), illness, breathing, posture, caffeine, many drugs.
- **Sensor.** Chest strap Polar H10 (~90 EUR): official free SDK gives RR intervals and raw ECG over Bluetooth, best developer access. Oura (night HRV in API sleep endpoint; personal access tokens reportedly deprecated Dec 2025, OAuth2 now; membership needed). Hobby PPG (MAX30102, ~5 EUR) usable only at rest with careful firmware.
- **Baseline.** Night-time or same-condition morning readings; 2–4 weeks to set a personal range because day-to-day noise is large. Use rolling averages (e.g. 7-day).
- **Verdict.** Useful as a context signal (alcohol, illness, overload), weak as a depression signal on its own.

Sources:
- Koch C et al. 2019, Psychol Med. https://core-prod.cambridgecore.org/core/services/aop-cambridge-core/content/view/F93BB157D9E258B0C64A1EC7F3652A28/S0033291719001351a.pdf/metaanalysis_of_heart_rate_variability_in_major_depression.pdf
- Kemp AH et al. 2010, Biol Psychiatry. https://pubmed.ncbi.nlm.nih.gov/20138254/
- HRV in fully remitted MDD, Acta Neuropsychiatrica. https://www.cambridge.org/core/journals/acta-neuropsychiatrica/article/heart-rate-variability-in-patients-with-fully-remitted-major-depressive-disorder/0E7340050BC2EBF7DA1D665FDF31F6EE
- Consumer wearable HRV, five longitudinal studies (Hernandez 2025, TNO). https://publications.tno.nl/publication/34645468/ugZ1qZ7M/hernandez-2025-resting.pdf
- WARN-D rTMS + Oura protocol 2026. https://www.researchprotocols.org/2026/1/e89466
- iTBS heart-rate RCT summary. https://ninet.med.ubc.ca/itbs-heart-function-changes/
- Polar SDK / H10 data access. https://wearipedia.readthedocs.io/en/stable/notebooks/polar_h10.html ; https://github.com/fsmeraldi/bleakheart
- Oura API auth change (secondary). https://tryterra.co/blog/oura-api-ai-apps-access-permissions-commercial-restrictions

## 6. Resting heart rate (especially night-time)

- **Group effect.** No meta-analysis found in this run.
- **Within-person: some.** Siddi et al. 2023 (Psychol Med; RADAR-MDD, recurrent MDD, 2 years, Fitbit): higher night-time resting HR and lower daytime HR variation in the week before each fortnightly PHQ-8 tracked more severe symptoms. A 2025 J Affect Disord secondary analysis (n=461): higher night resting HR predicted later severity, mediated by sleep disturbance.
- **Specificity.** Low (infection, alcohol, fitness, heat, stress). An illness raises night HR as much as a depressive shift.
- **Sensor.** Any watch/ring/strap. Fitbit, Garmin, Oura export resting HR; Health Connect/HealthKit aggregate it.
- **Baseline.** 2–3 weeks of nightly wear.

Sources: Siddi S et al. 2023, Psychol Med. https://core-prod.cambridgecore.org/core/services/aop-cambridge-core/content/view/9FC5503777916949158402E4F73C5D62/S0033291723001034a.pdf/usability_of_daytime_and_nighttime_heart_rate_dynamics_as_digital_biomarkers_of_depression_severity.pdf ; 2025 JAD analysis https://diposit.ub.edu/dspace/handle/2445/224157 ; George SV et al. (no consistent HR rise before recurrence, evidence check)

## 7. Psychomotor speed from typing

- **Change.** Slower and more variable typing, shorter sessions, lower accuracy with more depression.
- **Evidence.** Vesel et al. 2020 (JAMIA; BiAffect, 14 million keypresses, 250 users, 147 with PHQ): association held after age and time of day. Typing has a diurnal pattern (fastest at midday). A 2024 npj Digit Med BiAffect study (55 people, 1,794 days, mixed models): less phone movement while typing went with more anhedonia (daily, within-person design).
- **Within-person: some.**
- **Specificity.** Low to moderate (age, fatigue, alcohol, sedating drugs, hand injury, keyboard change).
- **Sensor.** Custom phone keyboard (Android: building an input method is possible; iOS: custom keyboards are allowed but restricted). Only timing metadata is needed, not content.
- **Baseline.** 1–2 weeks; correct for time of day.
- **Pitfall.** Users must switch keyboard; privacy perception.

Sources: Vesel C et al. 2020, JAMIA. https://pmc.ncbi.nlm.nih.gov/articles/PMC7647317 ; BiAffect 2024, npj Digit Med. https://link.springer.com/10.1038/s41746-024-01048-1

## 8. Voice and speech acoustics

- **Change.** Slower speaking and articulation rate, lower intensity, longer/more variable pauses, flatter pitch.
- **Group / cohort.** No pooled effect size found. Cummins et al. 2023 (J Affect Disord; RADAR-MDD, 585 people with recurrent MDD, phone recordings every 2 weeks for 18 months, UK/Spain/Netherlands; full text read): speech rate, articulation rate and intensity from a scripted task were associated with PHQ-8 across languages with stronger effects than pauses; mean pitch only in the UK cohort. Authors state the findings are cohort-level and may not identify intra-individual change.
- **Within-person: some.** Mundt et al. (cited by Cummins): in a 6-week study (n=35) and a 4-week study (n=165), pause time and speaking rate changed with severity; in a treatment trial (n=50) pauses became shorter and less variable with response. Campbell et al. 2023 (Interspeech): personalised models helped on the same RADAR data. Koesmahargyo et al.: speech amount rose over 4 weeks of antidepressants (n=18).
- **Specificity.** Moderate: colds, fatigue, alcohol, language, microphone and room, reading fluency.
- **Sensor.** Phone microphone (free). Full raw access. Use a fixed read-aloud passage for comparability.
- **Baseline.** Several recordings (e.g. 6–10 over 2–4 weeks) of the same task.
- **Pitfall.** Passive always-on audio is a privacy and battery problem; a 30-second scripted task is the practical route.

Sources: Cummins N et al. 2023, J Affect Disord, doi 10.1016/j.jad.2023.08.097. https://discovery.ucl.ac.uk/10175917/1/1-s2.0-S0165032723010765-main.pdf ; Campbell et al. 2023 https://discovery.ucl.ac.uk/10176456/1/campbell23_interspeech.pdf ; scoping review 2025 https://www.frontiersin.org/articles/10.3389/fpsyg.2025.1715538/full

## 9. Facial expressivity (camera)

- **Evidence.** Koesmahargyo et al. 2021 (Front Digit Health; 18 patients, smartphone task): facial expressivity, head movement and speech rose over 4 weeks of antidepressant treatment. DBS study (12 patients, 365 interviews, OpenFace action units): AUC 0.72 for remission, leave-one-subject-out. A 954-person remote study: smiling-related action units associated with severity.
- **Within-person: some (tiny samples).**
- **Specificity.** Moderate-low: lighting, camera angle, social context, Parkinson's, antipsychotics, culture.
- **Sensor.** Phone front camera, open tools (OpenFace, MediaPipe).
- **Verdict.** Interesting for a demo; evidence too thin and privacy cost high.

Sources: https://www.frontiersin.org/articles/10.3389/fdgth.2021.610006/full ; https://pmc.ncbi.nlm.nih.gov/articles/PMC8521884 ; https://www.isca-archive.org/interspeech_2025/hidalgojulia25_interspeech.pdf

## 10. Skin conductance (EDA)

- **Change.** Hypo-reactivity in depression, linked to suicidality (Sarchiapone et al. 2018 systematic review; mostly one research group, lab paradigms).
- **Prospective.** EUDOR-A (1,573 patients): weak prediction of suicide (sensitivity 25%).
- **Ambulatory.** Ghandeharioun et al. 2017 (ACII; Empatica E4): EDA asymmetry between wrists among features predicting Hamilton scores (RMSE 4.5); small sample, not read in full. Another study found *higher* tonic EDA with more symptoms (direction inconsistent).
- **Within-person.** None found that was convincing.
- **Specificity.** Very low (temperature, humidity, hydration, movement, electrode contact).
- **Sensor.** Hobby GSR module (~10–20 EUR) on a microcontroller; Empatica EmbracePlus is research-priced. Consumer devices (Fitbit Sense EDA scan) give summaries only.
- **Verdict.** Avoid.

Sources: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5785904/ ; EUDOR-A https://www.frontiersin.org/articles/10.3389/fpsyt.2021.765128/full ; https://asmadotgh.github.io/assets/pdf/17.ghandeharioun_etal_objective_ACII.pdf

## 11. Skin temperature and its daily rhythm

- **Evidence.** Mason et al. 2024 (Sci Rep; TemPredict, >20,000 Oura users, 7 months): higher depressive symptom levels went with higher body/skin temperature; lower diurnal amplitude only a non-significant trend. Cross-sectional across people; Oura-funded.
- **Within-person.** None found.
- **Specificity.** Very low (menstrual cycle, fever, room temperature, alcohol).
- **Sensor.** Ring (Oura gives temperature deviation, not raw); hobby thermistor/MAX30205 (~5 EUR) but placement is hard.
- **Verdict.** Collect as a confound flag (fever, cycle), not as a depression signal.

Source: Mason AE et al. 2024, Sci Rep, doi 10.1038/s41598-024-51567-w. https://www.nature.com/articles/s41598-024-51567-w.pdf

## 12. Breathing

- **Evidence.** No depression-specific source found. Night respiratory rate tracked perceived stress in student and WHOOP studies (preprint and secondary).
- **Within-person.** None found for depression.
- **Verdict.** Use as an intervention channel (slow-breathing / HRV biofeedback, see evidence check section 7), not as a sensor of depression.

## 13. Pupil and eye measures

- **Evidence.** Pupillary light reflex: slower, smaller constriction in MDD (Sci Rep 2023, lab). Reduced pupil dilation in reward anticipation replicated with smaller effect in 40 unmedicated patients. A report that the light reflex predicts improvement with rTMS (Drugs.com news; paper not read). PupilSense: phone burst photos in the wild (pilot).
- **Within-person.** None found.
- **Pitfall.** Phone RGB cameras lack infrared, so pupil-iris contrast is poor for dark irises; ambient light dominates.
- **Verdict.** Avoid for a maintenance product.

Sources: https://www.nature.com/articles/s41598-023-40796-0 ; https://www.Drugs.com/news/pupillary-light-reflex-can-predict-improvement-rtms-depression-116371.html ; https://arxiv.org/pdf/2404.14590v1.pdf

## 14. Phone use and mobility (GPS)

- **Group.** 2024 JMIR meta-analysis of GPS features: between-person correlations, largest for distance (r = −0.25); study quality poor. Saeb 2015/2016 (evidence check): r ≈ −0.4 to −0.6 in small samples. Screen time: ~10% higher risk per a 2022 cohort meta-analysis (secondary; mostly self-reported screen time).
- **Within-person: yes.** Zhang et al. 2022 (JMIR Ment Health; RADAR-MDD): mobility–severity correlations were stronger within individuals than between; homestay, location entropy and number of places predicted subsequent PHQ-8 change, and PHQ-8 change predicted later mobility.
- **Specificity.** Low: weather, holidays, illness, remote work, lockdowns.
- **Sensor.** Phone GPS and usage stats (free). Android gives full access (UsageStatsManager, location); iOS restricts background location and screen-time data.
- **Baseline.** 2 weeks per window (Zhang used 2-week windows); several weeks for a baseline.
- **Pitfalls.** Battery, missing data, iOS limits, privacy.

Sources: Zhang Y et al. 2022, JMIR Ment Health. https://mental.jmir.org/2022/3/e34898/PDF ; GPS meta-analysis 2024 https://doaj.org/article/6d3830d41e2a4236b8ade9bedf0cc633 ; digital phenotyping review https://pure.amsterdamumc.nl/ws/files/150637673/From-smartphone-data-to-clinically-relevant-predictions.pdf

## 15. Light exposure

- **Evidence.** Burns et al. 2023 (Nature Mental Health; >85,000 UK Biobank, 7 days wrist light sensor): more night light, higher odds of depression (~30%); more day light, lower (~20%) (percentages secondary). Cross-sectional.
- **Within-person.** None found.
- **Value.** It is also an *intervention* lever (bright light has trial evidence, evidence check section 7), so measuring it closes a loop.
- **Sensor.** Phone ambient light sensor (only when the phone is out of a pocket, so poor); hobby lux sensor (BH1750/TSL2591, ~3–8 EUR) on a clip or lanyard; few consumer watches log lux.

Source: Burns AC et al. 2023, Nature Mental Health 1:853, doi 10.1038/s44220-023-00135-8 (coverage) https://www.nationalelfservice.net/mental-health/depression/associations-between-daily-light-exposure-and-psychiatric-disorders/

## 16. Camera-based pulse (rPPG)

- **Evidence.** Heart rate from a face video: some methods MAE <3 bpm on datasets (CVPRW 2020), but a commercial product had unacceptable precision; HRV needs higher accuracy and published validation is thin (trials NCT05889832, NCT07922161 registered, no results). Contact fingertip-on-camera PPG agrees well with ECG for resting HR (2024 scoping review).
- **Verdict.** For a no-wearable route, use fingertip-on-camera for a 1–2 minute morning HR/HRV check, not face rPPG.

Sources: https://openaccess.thecvf.com/content_CVPRW_2020/papers/w19/Mironenko_Remote_Photoplethysmography_Rarely_Considered_Factors_CVPRW_2020_paper.pdf ; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6874325/ ; https://clinicaltrials.gov/study/NCT05889832

## 17. Multi-signal and personal models

- Personalised beats pooled: 55 adolescents over 24 weeks (JMIR Form Res 2022); idiographic models predicted severity up to 3 weeks ahead with ~80% accuracy in 183 people (medRxiv preprint, not peer reviewed). Sobering: personalised daily mood models from phone data beat chance for 80.6% of people but reached AUC >0.80 for only 11.8% (PMC8491547).
- Wearable AI meta-analysis (evidence check): accuracy 0.70–0.89, field "in its infancy".
- Ghandeharioun 2017: Hamilton score predicted with RMSE 4.5 from wristband + phone, small sample.
- Caveats: small samples, cross-validation within the same people, detection rather than prediction, no external validation, almost nothing on relapse except Tonon 2026.

Sources: https://formative.jmir.org/2022/6/e35807/ ; https://medrxiv.org/content/10.1101/2022.10.12.22281007v3.full.pdf ; https://pmc.ncbi.nlm.nih.gov/articles/PMC8491547

## 18. Camera-based eye and face measures (added after the participant's note about AI cameras)

Overall: most eye measures are **lab, task-bound group markers**. Facial expressivity and head movement have the best within-person (treatment) evidence. Nothing here has relapse evidence.

| Measure | What changes / group effect | Within-person or treatment | Needs task and controlled light? | Ordinary camera vs eye tracker |
|---|---|---|---|---|
| Pupil response to emotional stimuli | Meta-analysis: **d = 0.15**, higher pupil reactivity to negative stimuli in depression or at-risk people; authors call it trait-like | None found; one study: smaller dilation to sad faces predicted recurrence (cited secondhand) | Yes: fixed luminance, stimuli, timing | Pupil size needs IR contrast; RGB webcams poor for dark irises; PupilSense (webcam) exists, accuracy not read |
| Pupil response to reward anticipation | Reduced dilation; correlation with symptoms r = −0.26 in replication (40 unmedicated MDD), −0.53 in original | Correlates with symptom load within patients (cross-sectional) | Yes | As above |
| Pupillary light reflex | Slower, smaller constriction in MDD (Sci Rep 2023, lab) | One report that it predicts rTMS response (news, not read) | Yes: flash, dark adaptation | Phone flash + camera apps exist; lab-grade only with IR |
| Gaze bias to sad vs happy faces (dwell time) | Armstrong & Olatunji 2012 meta-analysis: more dwell on sad, less on positive (pooled size not found); 2023 meta-analysis (14 studies, 1,167 people) confirms negative bias | **Some, trait-like**: in remission the negative bias eases but reduced attention to happy faces persists; biases persist after remission in recurrent depression; attention-bias training trial: early gaze change partly mediated symptom change | Yes: free-viewing task with face pairs, ~1–2 min | Works with large areas of interest (left vs right face): webcam OK |
| Saccades and smooth pursuit | Lower pursuit gain, more catch-up saccades, reduced predictive-saccade accuracy; findings inconsistent; meta-analysis only at protocol stage (BMJ Open 2023) | None found | Yes: moving-dot task | Needs ~0.5° and high frame rate; webcam (60 Hz, 1.4–4°) not adequate for saccade metrics |
| Blink rate | Proposed dopamine proxy; PET studies found no link to dopamine; no depression meta-analysis found | None found | Passive possible | Blinks are easy from video (eyelid landmarks) |
| Eyelid openness / fatigue (PERCLOS) | No depression source found | — | Passive | Easy from landmarks; confounded by sleepiness |
| Reduced eye contact | No source found in this run | — | Needs a conversation partner or video call | — |
| Facial expressivity (smiling, action units) | Reduced positive expression; no pooled effect size found | **Yes (small studies)**: review of 12 studies (389 people) found response goes with more expressivity; 2025 review (15 depression papers) found smiling, expressivity and head/body movement increase with improvement; DBS study AUC 0.72 for remission (12 patients) | Passive or short structured task (talk for 1 min) | Webcam adequate; OpenFace, MediaPipe, Py-Feat |
| Head movement | Less movement in depression | Increases with improvement (same 2025 review; Koesmahargyo 2021, n=18) | Passive | Webcam adequate |

**Camera accuracy.** Purpose-built webcam gaze systems reach about 1.4° (0.5° worse than EyeLink 1000 in a 2023 comparison); WebGazer about 3.6–4°+ with drift and head-movement loss; MediaPipe-iris gaze 1.1–1.9° with 5-point calibration. OpenFace gaze was judged not accurate enough for screen-based studies with close stimuli. Research eye trackers reach about 0.5°. A good "AI camera" with IR illumination could approach a remote eye tracker, but this run had no data on the specific demoed camera.

**Open-source tools from an ordinary camera.** OpenFace 2.0 (action units, head pose, gaze), MediaPipe Face Mesh with iris (478 landmarks, blink and eyelid aperture), WebGazer.js (browser gaze), PupilSense (webcam pupil diameter, research code), Py-Feat (action units, not checked this run).

**Verdict.** For a home maintenance product: a weekly 1–2 minute camera check combining facial expressivity, head movement and voice (section 8) is defensible because these move with recovery. A free-viewing sad/happy face task is a trait-like vulnerability marker more than a weekly tracker. Pupil and saccade measures need controlled light, a task and IR hardware, have no within-person evidence, and should be presented only as exploratory.

Sources:
- Armstrong T, Olatunji BO 2012, Clin Psychol Rev (cited via Lazarov lab paper). https://www.lazarovlab.sites.tau.ac.il/_files/ugd/a396d5_d13a5d5c77234a3a90a3bfba2004cae1.pdf
- Eye-tracking attention bias meta-analysis 2023, Front Psychol. https://frontiersin.org/articles/10.3389/fpsyg.2022.1089654/full
- Remitted depression, attentional bias (eye tracking). https://metatoc.com/papers/89794-alleviated-negative-rather-than-positive-attentional-bias-in-patients-with-depression-in-remission-an-eye-tracking-study
- Attention-bias training with eye-tracking mediation and remitted-bias studies (search results, not opened individually). https://pmc.ncbi.nlm.nih.gov/articles/PMC5536561 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC4856054
- Pupillary reactivity meta-analysis (d = 0.15). https://www.pubmed.gov/36924842/
- Reward-anticipation pupillometry replication 2024, Sci Rep. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10764729/
- Pupillary light reflex in MDD, Sci Rep 2023. https://www.nature.com/articles/s41598-023-40796-0
- Eye movement abnormalities in MDD (review). https://www.frontiersin.org/articles/10.3389/fpsyt.2021.673443 ; meta-analysis protocol https://pmc.ncbi.nlm.nih.gov/articles/PMC10254607/
- Blink rate and dopamine: Byrne et al. 2015 https://link.springer.com/article/10.3758/s13415-015-0377-0
- Facial expression and treatment response, systematic review (Karger supplementary record). https://karger.figshare.com/articles/dataset/Supplementary_Material_for_Facial_Expression_and_Predicting_and_Monitoring_Response_to_Depression_Treatment_A_Systematic_Review/31027825
- Non-verbal behaviour and treatment response, 2025 review. https://public-pages-files-2025.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2025.1643042/pdf
- Webcam vs EyeLink 2023. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11289017/ ; WebGazer accuracy https://link.springer.com/article/10.3758/s13428-023-02237-8
- OpenFace field test. https://www.bohrium.com/paper-details/a-field-test-of-computer-vision-based-gaze-estimation-in-psychology/858662958333427713-12238 ; MediaPipe iris gaze (IEEE Access 2024) https://doaj.org/article/21ad3ac72299486a9497a31f1eb60713 ; PupilSense https://arxiv.org/pdf/2407.11204

## 19. Oura ring specifically

**Signals it gives.** Night-time heart rate and HRV (RMSSD) during sleep, lowest and average night heart rate, sleep stages at 30-second and 5-minute resolution, sleep timing, time in bed, wake after sleep onset, skin temperature *deviation* from the personal baseline, steps and activity (MET series about once a minute, 5-minute activity class), daytime heart rate time series, daily SpO2 average, readiness, sleep and activity scores, daily stress (seconds of high stress and recovery), and resilience.

**Developer API (v2).** REST under `/v2/usercollection/...`: `sleep`, `daily_sleep`, `daily_readiness`, `daily_activity`, `heartrate`, `daily_stress`, `daily_resilience`, `daily_spo2`, `workout`, `session`, `tag`. Time resolution: `heartrate` officially 5-minute increments (denser during activity in practice, gaps when moving); sleep documents carry HR and HRV as sample arrays with a stated interval (exact interval not verified this run); averages are computed from 30-second samples. Data arrives only after the ring syncs to the phone app and cloud, so it can lag by hours.

**Access for a weekend.**
- Personal access tokens are **deprecated** (Oura's own auth page). You must register an API application and use OAuth2 (authorization-code flow with PKCE, or a client-side token flow that lasts about 30 days). This is doable in an hour or two for one's own account; apps are limited to 10 users before Oura approval.
- **Gen3 and Ring 4 need an active Oura Membership** for API access (Oura help pages); without one the API returns 403. Gen2 rings are exempt.
- Fallback with no API: data export (download) from the Membership Hub works with or without membership.

**Validation.** Night HR is very accurate against ECG; night RMSSD good in most studies (Physiol Meas 2020, n=49, r² 0.98; JMIR 2022, n=35, accurate for 5-minute windows and night averages), but an independent 2024 MDPI study found good agreement for HR only, not HRV, without extra filtering. Validation is in healthy adults.

**Published studies with Oura data in mood or depression.**
- Moshe et al. 2021 (Front Psychiatry; Helsinki, n=60, 2 weeks, Oura + iPhone): longer total sleep and time in bed went with more depression symptoms; less location variability with more depression; HRV positively with anxiety (unexpected). The combined phone + ring + mood model predicted best. Small, non-clinical, short.
- Mason et al. 2024 (Sci Rep; TemPredict, >20,000 users): higher skin temperature with more depressive symptoms (section 11).
- WARN-D protocol 2026: Oura ring during and after rTMS for depression, aiming at early markers of response and relapse over 6 months; no results found.
- No study found using Oura data around relapse.

**What the ring cannot give.**
- No raw PPG and no public inter-beat-interval route, so you cannot compute your own HRV metrics or check signal quality.
- HRV only during sleep or during a user-started session ("Moment"), not continuous daytime HRV at rest.
- Temperature only as deviation from baseline, not absolute.
- No skin conductance, no voice, no location, no light exposure.
- Heart rate gaps during movement; real-time streaming is not available (cloud sync).
- Readiness, stress and resilience scores are proprietary composites; use the underlying values in a personal model.

Sources:
- Oura API authentication (PATs deprecated, OAuth2, scopes). https://cloud.ouraring.com/docs/authentication
- Oura API field notes (endpoints, resolution, 10-user limit, no IBI/PPG). https://cdn.jsdelivr.net/npm/oura-hr@1.1.0/OURA-API.md
- Oura help: The Oura API and membership. https://support.ouraring.com/hc/en-us/articles/4415266939155-The-Oura-API ; partner page https://partnersupport.ouraring.com/hc/en-us/articles/20949682312211-The-Oura-API
- Resilience endpoint listing. https://lava.so/docs/gateway/providers/oura
- Validation: JMIR 2022 https://jmir.org/2022/1/e27487/PDF ; MDPI Sensors 2024 https://mdpi.com/1424-8220/24/23/7475 ; Oura-affiliated Oulu white paper https://ouraring.com/blog/wp-content/uploads/2018/10/The-HRV-of-the-Ring-Comparison-of-OURA-Ring-to-ECG.pdf
- Moshe I et al. 2021, Front Psychiatry, doi 10.3389/fpsyt.2021.625247. https://frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2021.625247/full
- WARN-D protocol. https://www.researchprotocols.org/2026/1/e89466

---

## Ranked table

| # | Sign | Group effect | Within-person | Specificity | Sensor, price (est.) | Days to baseline | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | Rest-activity rhythm amplitude and sleep timing regularity | Moderate (not pooled) | **Yes** (relapse HR ~0.45 / 1.76, Tonon 2026) | Low | Watch/band/ring 30–350 EUR; phone weaker | 14–28 (min. 7) | **Core signal** |
| 2 | Daytime activity / steps | SMD −0.82 episode, −0.28 remitted | **Yes** (state marker; rises with treatment) | Low | Phone free; band | 7–14 | **Core** |
| 3 | GPS mobility, time at home | r ≈ −0.25 (meta) | **Yes** (Zhang 2022, stronger within) | Low | Phone free (Android best) | 14–28 | **Core (phone)** |
| 4 | Speech rate / intensity / pauses (scripted) | Small-moderate | Some | Moderate | Phone mic free | 6–10 recordings | **Good add-on, cheap** |
| 5 | Night resting HR | Not pooled | Some (Siddi 2023) | Low | Any wearable | 14–21 | Useful with context |
| 6 | Typing speed/variability | Modest | Some | Low-moderate | Phone keyboard | 7–14 | Good if Android |
| 7 | Sleep fragmentation / variability | Small-moderate | Some | Very low | Wearable | 14 | Fold into #1 |
| 8 | HRV | g −0.32 to −0.46 | Weak / mixed | Very low | Polar H10 ~90 EUR (open SDK) | 14–28 | Context and intervention signal |
| 9 | Light exposure | ~20–30% risk diff (cross-sect.) | None found | Low | Lux sensor ~5 EUR | 7 | Measure as intervention lever |
| 10 | Facial expressivity | Small studies | Some (n=12–18) | Low | Phone camera | n/a | Demo only |
| 11 | Gait speed | OR ~1.9 prospective (older adults) | None at weeks | Very low | Phone IMU | n/a | Skip |
| 12 | Skin temperature | Cross-sectional | None | Very low | Ring | n/a | Confound flag only |
| 13 | Skin conductance | Lab hypo-reactivity | None convincing | Very low | GSR ~15 EUR | n/a | Avoid |
| 14 | Pupil | Lab only | None | Low | Phone camera (poor) | n/a | Avoid |
| 15 | Breathing | No source found | None | Very low | Strap/ring | n/a | Use for intervention, not sensing |
| 16 | Face rPPG | — | — | — | Phone camera | — | Use fingertip PPG instead |
| 17 | Camera: facial expressivity + head movement (structured 1-min task) | Not pooled | Some (rises with treatment response; 12-study review) | Low-moderate | Webcam/phone or AI camera; OpenFace/MediaPipe | 4–6 sessions | Weekly check with voice |
| 18 | Camera: gaze bias sad vs happy faces | Meta-analytic (size not found) | Some, trait-like (persists in remission) | Moderate | Webcam OK (large AOIs) | n/a | Vulnerability marker, not a tracker |
| 19 | Camera: pupil (emotion/reward/light) | d = 0.15 (emotional) | None found | Low (light, drugs, age) | IR camera needed | n/a | Exploratory only |
| 20 | Camera: saccades, pursuit, blink, eyelid | Inconsistent / no source | None found | Low | Dedicated tracker needed for saccades | n/a | Avoid |
| — | Oura ring (device, covers rows 1, 5, 7, 8, 12) | — | Moshe 2021 (n=60, 2 weeks) only | — | ~350 EUR + membership; OAuth2 API, no raw PPG/IBI | 14–28 | Good source for rhythm, night HR, night HRV |

## What a phone alone can do

- Activity and steps, phone-based rhythm proxies (first/last screen use, screen-on at night), GPS mobility and time at home, app and screen use (Android), typing dynamics (custom keyboard), a 30-second scripted voice sample, a fingertip-camera pulse check.
- This covers three of the top four signals (activity, mobility, speech). It is weakest on sleep and night physiology, because the phone is not on the body at night, and iOS limits background location and usage data. Android is the better development platform.

## What one cheap wearable adds

- A wrist band or ring adds the strongest relapse evidence: true rest-activity amplitude, sleep timing regularity and night-time wake, plus night resting HR and HRV, with far fewer gaps.
- Best developer options: Polar H10 chest strap (open SDK, raw RR/ECG; but not worn overnight), open-firmware watches (Bangle.js, PineTime: raw accelerometer and PPG), or a consumer band read through Health Connect / HealthKit / vendor API (summaries only; Oura now OAuth2 plus paid membership, ten-user cap before approval, per secondary sources).
- A hobby lux sensor (~5 EUR) adds daylight exposure, which matters because bright light is also an evidence-based intervention.

## Not checked in this run

- Full texts of Koch 2019, Wüthrich 2022 moderators, Siddi 2023 effect sizes, Zhang 2022 effect sizes, Burns 2023 exact odds ratios.
- Any study of passive sensing after TMS with results (only the WARN-D protocol found).
- Current Fitbit/Garmin/Apple API terms; prices were not checked.
- Posture; pooled effect sizes for speech features; rPPG HRV validation results.
- Specs of the AI camera demoed at the event; pooled effect size of Armstrong & Olatunji 2012; eye contact and eyelid/fatigue measures in depression (no source found); PupilSense accuracy; exact Oura sleep-HRV sample interval and whether OAuth redirect to localhost works; Oura API rate limits (sources conflict).
