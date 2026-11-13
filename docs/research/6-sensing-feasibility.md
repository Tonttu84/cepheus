# Sensing feasibility: what can be shown working this weekend

Status 13 Nov 2026. Practical follow-up to `1-physical-signs.md`, `2-mental-measures.md`
and `../general-plan.md`. Research only: nothing was installed, downloaded or signed into.
Every claim below names the page it came from; "not confirmed" means this run did not
find it on an official page. Version numbers are as read on 13 Nov 2026.

## Short answer

By Saturday midday a team can realistically show, in this order:

1. **Daily check-in + fortnightly PHQ-9** in a web page (no sensing risk; 2-3 h).
2. **Rhythm and sleep-regularity numbers** computed from a data file: synthetic weeks
   first (2-3 h), then the open Depresjon data or the team's own Oura data if the API
   or export works in time (2-4 h more).
3. **Camera expressivity and head movement** from MediaPipe Face Landmarker in the
   browser, numbers only, no video stored (3-5 h).
4. **Speech rate and pauses** from a 30-second read-aloud of a fixed passage (3-4 h).

The gaze task (calibration, face stimuli, licences) and live phone sensing are the
"if time" items. Oura live data is uncertain because of membership, OAuth and sync lag:
build on synthetic and open data and treat a live Oura pull as a bonus.

---

## A. USB camera

### A1. Is the "Arduino USB camera" a normal webcam?

Almost certainly yes. Arduino sells an official **Arduino USB Camera** for the UNO Q
and VENTUNO Q: Sony IMX376 sensor, up to 3840x2160 at 30 fps in MJPEG, autofocus from
20 cm, F/2.0 lens with 80° diagonal field of view, built-in LED ring light (warm and cool
white) and a built-in microphone, and Arduino says it is "recognized as a standard USB
Video Class device", no drivers needed ([Arduino docs](https://docs.arduino.cc/hardware/usb-camera/)).
The page does not list Windows, macOS or Linux by name (not confirmed per OS), but UVC
devices are handled by the built-in drivers on all three. Its cable is USB-A, so a
USB-C-only laptop needs an adapter ([esp32.co.uk news item](https://esp32.co.uk/arduino-usb-camera-4k-uno-q-ventuno-q/)).
Community posts confirm generic UVC webcams work on the UNO Q itself
([Arduino forum](https://forum.arduino.cc/t/usb-camera-recommendations-for-arduino-uno-q-2gb-ram-model/1431971)).
If the team's camera is a different model, the same one-minute check applies.

The ring light is a real asset: even, frontal light is the biggest single factor for
face tracking quality.

**One-minute check**

- Windows: plug in, open the Camera app (switch camera with the toggle) or Device
  Manager > Cameras.
- macOS: QuickTime Player > New Movie Recording, pick the camera in the arrow menu; or
  System Information > USB.
- Linux: `v4l2-ctl --list-devices` (package v4l-utils) or `lsusb`.
- Browser: open any page over https or localhost, DevTools console:
  `await navigator.mediaDevices.getUserMedia({video:true}); (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput')`
  The camera's label appears after permission is granted.
- Python: `cv2.VideoCapture(1)` (index 0 is often the built-in camera). On Windows,
  `cv2.VideoCapture(1, cv2.CAP_DSHOW)` opens faster than the default backend.

**Pitfall: 4K by default.** Ask for a modest size so the frame rate stays up and the
model runs in real time: browser `getUserMedia({video:{deviceId, width:{ideal:1280},
height:{ideal:720}, frameRate:{ideal:30}}})`; Python `cap.set(cv2.CAP_PROP_FRAME_WIDTH,
1280)` and height 720. Face Landmarker does not need more than 720p.

### A2. Facial expressivity

| | Browser (TypeScript) | Python |
|---|---|---|
| Library | `@mediapipe/tasks-vision` 1.2.3, Apache-2.0 ([npm registry](https://registry.npmjs.org/@mediapipe/tasks-vision/latest)) | `mediapipe` 1.2.3, Apache-2.0 ([PyPI](https://pypi.org/pypi/mediapipe/json)) |
| Alternative | none comparable | py-feat 2.1.5, MIT, Python >=3.11, released 8 Oct 2026, gives action units ([PyPI](https://pypi.org/pypi/py-feat/json)); OpenFace 2.2.0, research licence with a separate commercial licence, heavy C++ build ([GitHub](https://github.com/TadasBaltrusaitis/OpenFace)) |

Recommendation: **MediaPipe Face Landmarker** in either route. It returns 478 landmarks,
52 blendshape scores (0-1, for example `mouthSmileLeft`, `browInnerUp`, `jawOpen`) and a
4x4 facial transformation matrix (head pose) per frame. Skip OpenFace (build time,
licence); py-feat only if the team wants named action units and is in Python.

**Browser recipe** (from the [official web guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)):

```ts
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm");
const fl = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
    delegate: "GPU" },
  runningMode: "VIDEO", numFaces: 1,
  outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true });
// in a requestAnimationFrame loop:
const r = fl.detectForVideo(videoEl, performance.now());
// r.faceBlendshapes[0].categories -> [{categoryName, score}], r.facialTransformationMatrixes[0].data -> 16 numbers
```

Pin the WASM version (the guide uses `@latest`) and serve the model file locally for the
demo so venue Wi-Fi cannot break it. Timestamps must strictly increase.

**Python recipe** (from the [official Python guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/python)):
`pip install mediapipe opencv-python`; create `mp.tasks.vision.FaceLandmarkerOptions(
base_options=mp.tasks.BaseOptions(model_asset_path="face_landmarker.task"),
running_mode=mp.tasks.vision.RunningMode.VIDEO, num_faces=1,
output_face_blendshapes=True, output_facial_transformation_matrixes=True)`, read frames
with OpenCV, convert BGR to RGB, call `landmarker.detect_for_video(mp.Image(...),
timestamp_ms)` with a monotonic millisecond clock. The guide notes `*Left`/`*Right`
blendshapes refer to the subject's face, so a mirrored image flips them.

**Task and summary number.** A fixed 60-second task makes clips comparable across days,
for example "tell the camera about one thing from today" or watching the same short
neutral-to-pleasant clip. Per clip:

- Resample blendshapes to a fixed rate (10 Hz) by time, not frame count.
- Pick an expressive subset: smile (`mouthSmileLeft/Right`), brows (`browInnerUp`,
  `browDownLeft/Right`, `browOuterUpLeft/Right`), cheeks and eye squint, mouth open.
- **Expressivity = mean over that subset of the standard deviation of each score over
  the clip.** Also useful: fraction of time `mouthSmile` > 0.3.
- Show it only against the person's own baseline (z-score over their first 7-14 clips),
  never as an absolute mood score.

### A3. Head movement

From the same transformation matrix: take the 3x3 rotation part and convert to yaw,
pitch and roll (standard rotation-to-Euler formula), and the translation column for
position. Per 60-second clip: **SD of yaw and pitch** (degrees) and **total angular path
per minute** (sum of absolute frame-to-frame changes at 10 Hz). Lower head movement went
with depression in the small studies summarised in `1-physical-signs.md`. Again,
personal baseline only.

### A4. Gaze toward sad versus happy faces

| Option | Licence and status | Notes |
|---|---|---|
| WebGazer.js (npm `webgazer`) | GPLv3; LGPLv3 for companies valued under 1 M USD; "official maintenance has ended" as of 24 Feb 2026, community support only ([GitHub](https://github.com/brownhci/WebGazer)) | Browser only; self-calibrates from clicks; ships a 9-point `calibration.html` example |
| MediaPipe iris landmarks + own mapping | Apache-2.0 | Iris centre relative to eye corners, plus head yaw, then a per-person regression fitted on calibration points. More code, fewer licence questions |

Accuracy from earlier research (`1-physical-signs.md`): WebGazer about 3.6-4° or worse
with drift and head movement; MediaPipe-iris approaches 1.1-1.9° with 5-point
calibration. At about 60 cm from a laptop, 4° is about 4 cm, and a 14-inch screen is
about 30 cm wide. So **two regions (left and right halves) are realistic, four
quadrants are marginal**, and fine dwell on parts of a face is not possible.

Design that fits that accuracy: a 9-point (or 5-point) click calibration, then 10-20
trials of a sad and a happy face shown at the far left and far right for 5-8 seconds
each, sides counterbalanced; a validation dot before and after to measure drift; drop
trials with no face found. **Bias score = (dwell on sad − dwell on happy) / total
dwell**, averaged over trials. Face stimuli need a licence: research sets (NimStim,
KDEF and similar) have their own terms (not checked this run); safest for a demo is
drawn or generated faces, clearly labelled. Since the research found this measure is
more trait than state, it is a weekly or monthly item at most.

### A5. On the device, numbers only

- Process frames in memory as they arrive; never call `MediaRecorder` or write frames.
- Keep a per-second aggregate (means of the chosen blendshapes, yaw, pitch) in memory,
  compute the clip summary at the end, store only the summary (a handful of numbers
  plus the task id and timestamp) and discard the per-second buffer.
- Show the user a "nothing recorded" note and a live face-mesh overlay so the claim is
  visible.
- MediaPipe runs fully on the device in both routes; only the model file is fetched once.

**Frame-rate and lighting pitfalls.** Laptop GPUs differ; a slow machine may drop to
10-15 fps, so always normalise by time. Backlight (a window behind the person) and
low light reduce landmark quality: switch on the camera's ring light. Glasses and
heavy fringe hurt iris tracking. Autofocus hunting can blur frames; fix distance.

---

## B. Oura ring

### B1. Access route

- **Personal access tokens are deprecated**; the authentication page lists them as
  "Personal Access Tokens [Deprecated]" ([Oura auth docs](https://cloud.ouraring.com/docs/authentication)).
  A secondary source dates this to December 2025 ([Terra blog](https://tryterra.co/blog/oura-api-ai-apps-access-permissions-commercial-restrictions)).
- **OAuth2 is required.** Two flows ([Oura auth docs](https://cloud.ouraring.com/docs/authentication)):
  - Server-side: `response_type=code`, PKCE recommended (`S256`), exchange at
    `https://api.ouraring.com/oauth/token`; refresh tokens are single-use.
  - Client-side only: `response_type=token`, token returned in the URL fragment, no
    refresh, lasts 30 days. **Best for a hackathon**: no server secret, one sign-in
    lasts the weekend.
  - Authorise URL `https://cloud.ouraring.com/oauth/authorize` (new clients may use
    `https://developer.ouraring.com/authorize`). Scopes: `email personal daily
    heartrate workout tag session spo2`; ask only for `daily heartrate personal`.
  - Redirect URIs are a whitelist and must match exactly.
  - Every request needs a non-empty `User-Agent` header or may get 403.
- **Register an app** in the developer portal released in 2025 ([Oura support](https://support.ouraring.com/hc/en-us/articles/4415266939155-The-Oura-API)).
- **Localhost redirect: not confirmed.** The docs do not say. Try
  `http://localhost:3000/callback` first; if refused, use a free HTTPS tunnel or a
  deployed preview URL.
- **User limit before approval:** about 10 users (secondary field notes,
  [oura-hr notes](https://cdn.jsdelivr.net/npm/oura-hr@1.1.0/OURA-API.md)); fine for a team.
- **Membership:** Gen3 and Oura Ring 4 users without an active membership cannot reach
  their data through the API; Gen2 is unaffected ([Oura support](https://support.ouraring.com/hc/en-us/articles/4415266939155-The-Oura-API)).
  **First thing to check: ring generation and whether the owner's membership is active.**
- **Rate limits:** per token and per app; honour `Retry-After` on 429. Numbers not
  confirmed this run.

### B2. Endpoints (base `https://api.ouraring.com/v2/usercollection/`)

Field details below are from secondary notes, not the official OpenAPI file (the
official reference page did not render for this run): verify on first call.

| Endpoint | What it gives | Resolution |
|---|---|---|
| `sleep` | Each sleep period: `bedtime_start`, `bedtime_end`, `type`, durations, `sleep_phase_5_min` (string, one char per 5 min: 1 deep, 2 light, 3 REM, 4 awake), `movement_30_sec`, `heart_rate` and `hrv` as samples with an `interval` | 5 min phases, 30 s movement, HR/HRV samples (interval in the payload) |
| `daily_sleep` | Sleep score and contributors per day | Daily |
| `sleep_time` | Recommended bedtime window | Daily (not confirmed in detail) |
| `daily_activity` | Steps, calories, `class_5_min` (string per 5 min), `met` (sample series, often one per minute) | 5 min and about 1 min |
| `heartrate` | HR time series; params `start_datetime`, `end_datetime`, `next_token` | Nominally 5 min; observed denser and irregular, with gaps up to about 30 min |

Daily endpoints take `start_date` and `end_date` (YYYY-MM-DD; not confirmed on the
official page). Follow `next_token` for every page.
Sources: [oura-hr field notes](https://cdn.jsdelivr.net/npm/oura-hr@1.1.0/OURA-API.md),
[oura-api Rust crate](https://docs.rs/oura-api/0.1.2/oura_api/models/struct.Sleep.html).

**Data availability after waking:** data travels ring → phone app → cloud → API. Sleep
appears after the phone app syncs (open the Oura app in the morning); background uploads
of activity and HR can lag by hours. No official figure found. Webhooks fire about 30 s
after a mobile sync (secondary notes). For the demo: pull yesterday, not "now".

### B3. Fallback: the data export

Request from the Oura web account / Membership Hub; Oura says it may take **up to 10
days** before the export is ready and emails when it is
([Oura support](https://support.ouraring.com/hc/en-us/articles/360025441594)). Format: CSV
(and JSON per third-party guides). Whether Gen3 users without membership get the full
export is contradictory across sources (not confirmed). **Request it tonight**; it
may not arrive in time, which is another reason to build on synthetic and open data.
Load with `pandas.read_csv` / `pd.read_json`, or Papa Parse in TypeScript.

### B4. Rhythm and regularity measures

Input: a per-minute (or per-5-minute) activity series. From Oura use `met` from
`daily_activity` (or map `class_5_min` to levels); from Depresjon use the activity
counts. Hourly means are enough for the first two measures.

- **Relative amplitude (RA)**: average the data into a 24-hour profile (or per day).
  M10 = mean activity of the most active 10 consecutive hours; L5 = mean of the least
  active 5 consecutive hours. **RA = (M10 − L5) / (M10 + L5)**, between 0 and 1;
  lower means a flatter day-night contrast.
- **Interdaily stability (IS)**: how alike the days are. With hourly values x over
  N hours, x̄ the overall mean and x̄_h the mean of each clock hour across days (p = 24):
  **IS = [N · Σ_h (x̄_h − x̄)²] / [p · Σ_i (x_i − x̄)²]**, from 0 (no pattern) to 1
  (identical days). Companion: intradaily variability (IV) for fragmentation.
- **Sleep regularity index (SRI)**: build a per-minute sleep/wake grid from Oura sleep
  periods (asleep between `bedtime_start` and `bedtime_end`, minus 5-minute phases coded
  awake). SRI = probability that two minutes 24 h apart are in the same state, scaled:
  **SRI = 200 · P(same) − 100**, so 100 means identical days and 0 random. Phillips 2017
  proposed using 7 consecutive days (or multiples) without gaps
  ([pyActigraphy SRI docs](https://ghammad.github.io/pyActigraphy/_autosummary/pyActigraphy.sleep.ScoringMixin.SleepRegularityIndex.html)).
  Simpler and easier to explain: **SD of sleep midpoint** across nights (minutes).
- **Days needed**: at least 7 valid days per window, 14 better; compare a rolling
  7-14-day window against the person's first 2-4 weeks (`1-physical-signs.md`).
- **Libraries**: pyActigraphy 1.2.2, GPL-3.0, last release June 2024, implements IS,
  IV, RA and SRI ([PyPI](https://pypi.org/pypi/pyActigraphy/json)); R: GGIR
  `CalcSleepRegularityIndex` and the `sleepreg` package
  ([GGIR docs](https://wadpac.github.io/GGIR/articles/SleepRegularityIndex)). No
  JavaScript library was found. The formulas are 20-40 lines each in TypeScript or
  pandas; writing them by hand with unit tests on synthetic data is faster than
  adapting pyActigraphy's file readers (which expect device files) and avoids GPL.

---

## C. Phone and browser without an app

| Capability | Web page on Android Chrome | Web page on iOS Safari | Notes |
|---|---|---|---|
| Microphone, camera | Yes, `getUserMedia`, HTTPS, prompt | Yes, HTTPS, prompt | Standard; not re-checked this run |
| Motion sensors | Yes, no extra prompt (not confirmed) | Needs `DeviceMotionEvent.requestPermission()` from a button tap, HTTPS ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static)) | Only while the page is open and visible: no step counting |
| Location | Foreground only, prompt | Foreground only, prompt | No background location on the web (not confirmed on an official page this run) |
| Notifications | Web Push via a service worker | Web Push only from iOS/iPadOS 16.4, only after "Add to Home Screen" with a manifest `display: standalone`, and permission requested from a tap ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)) | Push needs a server to send at the set time; a web app cannot schedule its own local reminder reliably |

Native app needed for: step counts and sleep history (HealthKit on iOS; **Health
Connect** on Android, a native SDK for Android 9+ with steps, sleep sessions and heart
rate, readable in the background with permission
([Android developers](https://developer.android.com/health-and-fitness/guides/health-connect))),
screen time, background location and mobility. Not worth building this weekend; use the
Oura ring for steps and sleep, and StudentLife for a mobility demo.

**Daily check-in reminder, practical choices**: Web Push from a tiny server (Android
easy; iOS only as an installed home-screen app), or a downloadable `.ics` calendar event
repeating daily that opens the check-in link (works everywhere, no server). For the demo,
a manual "send reminder now" button is enough.

### C1. 30-second read-aloud: speech rate and pauses

Use a **fixed passage with a known syllable count** (for example a short neutral
paragraph, same every time). Then no speech recognition is needed: only where speech is
and is not.

- **Browser**: record with `getUserMedia({audio:true})` into a Web Audio
  `AudioWorklet` or `AnalyserNode`; compute RMS energy in 20 ms frames; speech = frames
  above an adaptive threshold (for example noise floor from the first 0.5 s plus 10 dB);
  merge gaps under 100 ms. Or use `@ricky0123/vad-web` (Silero VAD in ONNX, needs the
  model and ONNX Runtime WASM files served; licence of the wrapper not confirmed)
  ([vad-web docs](https://docs.vad.ricky0123.com/user-guide/browser/)). Keep audio in
  memory only.
- **Python**: `pip install silero-vad`; `get_speech_timestamps(wav, model,
  return_seconds=True)` gives speech segments ([GitHub, MIT per sidebar, badge says
  otherwise](https://github.com/snakers4/silero-vad)). For syllable nuclei without a
  known text, Praat via `praat-parselmouth` (De Jong and Wempe script) works
  ([Parselmouth docs](https://parselmouth.readthedocs.io/en/stable/); licence not
  confirmed). openSMILE 2.6.0 eGeMAPS is research-only licence for commercial use, so
  avoid it ([PyPI](https://pypi.org/pypi/opensmile/json)).
- **Numbers**: reading time (first to last speech), **speech rate = syllables /
  reading time**, **articulation rate = syllables / speaking time**, number of pauses
  over 250 ms, mean pause length, pause ratio = pause time / reading time. Personal
  baseline only; microphone distance and room noise change all of them, so record the
  same way each time.

---

## D. Open datasets for a demo

| | Kossakowski 2017 diary | Depresjon actigraphy | StudentLife |
|---|---|---|---|
| Where | OSF [osf.io/j4fg8](http://osf.io/j4fg8), paper [JOPD 10.5334/jopd.29](https://openpsychologydata.metajnl.com/articles/10.5334/jopd.29) | [datasets.simula.no/depresjon](https://datasets.simula.no/depresjon/) (`depresjon.zip`, about 5.4 MB); mirror [Zenodo 1219550](https://zenodo.org/record/1219550) (about 4.3 MB) | [studentlife.cs.dartmouth.edu/dataset.html](https://studentlife.cs.dartmouth.edu/dataset.html), file `dataset/dataset.tar.bz2`; also on Kaggle |
| Licence | CC BY 4.0 | Research and education only; commercial use forbidden without written permission (Zenodo terms); cite Garcia-Ceja et al., MMSys 2018 | Not confirmed (site refused connection this run) |
| Size and format | ESMdata.zip: CSV, XLS, TXT, codebook PDF | One CSV per person (`timestamp,date,activity`, per minute) plus `scores.csv` | About 5 GB download (R package README), 53 GB of raw sensing; CSV and JSON |
| Content | 1 man with depression, 239 days, 1,478 beeps (about 6/day), 50 momentary items (mood, worry, activity), morning and evening items, weekly SCL-90-R depression (`dep`), venlafaxine dose reduced to 0, phase labels | 23 depressed (uni- and bipolar) and 32 controls; `scores.csv` has MADRS at start and end, age, gender, days | 48 students, 10 weeks: phone activity, GPS, conversation, sleep inference, EMA (`EMA/responses/<question>`), PHQ-9 pre and post (`survey/PHQ-9.csv`) |
| Demo it supports | Real daily check-ins worsening through a depressive transition; rolling mean and variance of "feeling down" as an early warning illustration | RA, IS and sleep-midpoint numbers for real patients versus controls, side by side; tests the rhythm code on real data | Phone mobility and EMA over weeks; heavy to unpack, last priority |

Loading: Kossakowski `pd.read_csv("ESMdata.csv")`, aggregate beeps per day (column
names in the codebook). Depresjon `pd.read_csv("condition/condition_1.csv",
parse_dates=["timestamp"])` then resample hourly (folder names from secondary sources;
check after unzip). StudentLife: R package `studentlife` has `download_studentlife()`
and tidy loaders ([CRAN README](https://www.stats.bris.ac.uk/R/web/packages/studentlife/readme/README.html)).
Note that Depresjon's licence forbids commercial use: fine for a hackathon demo, say so
on the slide.

### D1. Synthetic weeks for one person

A seeded generator, one person, 8-10 weeks, per-minute activity plus daily items:

- **Activity**: per minute, `a(t) = mesor + amp · max(0, cos(2π(t − acrophase)/24h))`
  with Gamma-distributed noise; near zero inside the sleep window. Weeks 1-4 baseline;
  from week 5 lower `amp` by 5-8% a week, add 2-4 short night-time activity bouts.
- **Sleep**: onset drawn per night from Normal(23:15, SD 20 min) at baseline; SD grows
  to 60-90 min and wake time drifts later in the decline; occasional 30-60 min awake
  in the night.
- **Check-ins**: each item on 1-7 follows AR(1) around a personal mean (φ ≈ 0.5), the
  mean drifting down 0.3-0.5 a week in the decline; 10-20% days missing at random,
  more missing in the decline (logged as missing, never zero).
- **PHQ-9** every 14 days from the same latent state, plus noise of about 2 points;
  rises from about 5 to 12-15.
- **Optional recovery** after a simulated booster, so the loop has an ending.
- Compute the same RA, IS, SRI from the generated data with the same code as real data,
  so the numbers on screen are honestly computed, only the input is simulated.
- **Labelling**: every record carries `source: "synthetic"` and the seed; the UI shows a
  persistent "Simulated person, simulated data" banner and a "day N of 70" clock with an
  "advance one day" control; the pitch says "time compressed".

---

## E. Where Gemini fits

**What the API accepts** (official docs, now served from aistudio.google.com):

- Video: inline only for small requests (the page says both "< 100 MB" and "under 20 MB
  total request size", so plan for 20 MB); File API for larger; default sampling **1 frame
  per second**; about 100 tokens/s at low resolution, 300 at high; 1M-token models take
  up to 1 h (high) or 3 h (low resolution) of video ([video docs](https://aistudio.google.com/docs/video-understanding)).
- Audio: 32 tokens per second, up to 9.5 h per prompt, 20 MB inline request limit;
  WAV, MP3, OGG, FLAC, WebM and others; can transcribe with timestamps
  ([audio docs](https://aistudio.google.com/docs/audio)).
- Images: supported as input by current models ([models page](https://aistudio.google.com/docs/models)).
- **Live API**: stateful WebSocket; input 16 kHz 16-bit PCM audio, JPEG images up to
  1 fps, text; output audio; ephemeral tokens recommended for direct browser use
  ([Live docs](https://aistudio.google.com/docs/live)). Session length limits not
  confirmed.
- Current models listed include `gemini-3.8-flash`, `gemini-3.6-flash`,
  `gemini-3.5-flash-lite` (stable) and `gemini-3.8-live`; Gemini 4 models with 1M
  context. Free-tier terms and data use not confirmed this run: check before sending any
  real person's data.

**Good uses**

- **Weekly clinician summary**: code computes the numbers and flags; Gemini turns them
  into three plain sentences with the numbers quoted, never inventing one. Easy to show,
  easy to check (assert every number in the text exists in the input).
- **Free-text check-in coding**: map "what was hard today" to a small fixed set of
  themes (sleep, avoidance, worry, social, energy) with structured output, shown to the
  person, used as context not as a score.
- **Wording the response step**: rephrase the person's own chosen action in their words;
  conversational read-aloud prompts.
- **Checking the read-aloud was done** (transcript matches the passage) if needed.

**Should not**

- **Mood or diagnosis from face or voice.** The audio page even advertises "emotion
  detection"; that is not validated for depression, would breach "numbers only, never
  video", and a mood or relapse claim makes the product a medical device.
- **Computing the statistics** (RA, SRI, trends): deterministic code is checkable; a
  model is not.
- **Crisis triage or deciding when to alert the clinic**: rules a clinician agreed,
  with a human path, nothing automated in between (general plan, section 3).
- **Sending raw camera or audio to the cloud**: contradicts the on-device promise;
  send only the numbers and the person's own text, with consent.

---

## Summary table

| Measure | Hardware | Route | Hours to a number | Main risk | Verdict |
|---|---|---|---|---|---|
| Daily check-in (3-4 items) | Phone or laptop browser | Web form, local storage or small DB | 2-3 | None technical; reminders on iOS | Do first |
| PHQ-9 fortnightly | Browser | Web form, standard scoring | 1 | Must show crisis path for item 9 | Do first |
| Rest-activity RA, IS; sleep regularity | Synthetic, Depresjon, Oura | Hand-written formulas (TS or pandas) on files | 3-4 (synthetic + Depresjon) | Formula errors; test on synthetic data with known answer | Do first |
| Same, live from own Oura | Oura ring | OAuth client-side flow, `sleep` + `daily_activity` | 2-4 extra | Membership (Gen3/4), localhost redirect, sync lag, needs 7+ days | Do if time |
| Oura export | Oura account | CSV/JSON export | 1 once received | Up to 10 days to arrive | Request tonight, use if it arrives |
| Facial expressivity | USB camera | MediaPipe Face Landmarker blendshapes, browser | 3-5 | Lighting, slow GPU, personal baseline needs many days | Do first (after rhythm) |
| Head movement | USB camera | Same model, transformation matrix | +1 | Euler conversion bugs | Do with expressivity |
| Speech rate, pauses | Laptop or phone mic, or camera mic | Fixed passage, energy VAD or Silero | 3-4 | Room noise, mic distance | Do if time |
| Steps | Oura (or native phone app) | `daily_activity.steps` | 1 with Oura access | Same as Oura access | Do if time |
| Gaze sad vs happy | USB camera | WebGazer 9-point calibration, left/right only | 6-8 | Accuracy, drift, GPL, face stimulus licences, trait-like | Skip unless a member owns it |
| Ambiguous faces rating game | Browser | Simple task, weekly score | 3-4 | Stimulus licences | Do if time (from report 2) |
| Phone mobility, screen time | Phone | Native app only | 10+ | Native build, store rules | Skip; show StudentLife instead |
| Gemini weekly summary | Any | Numbers in, text out, numbers asserted | 2 | Hallucinated numbers; data terms | Do if entering the side challenge |

## Not confirmed in this run

- Whether Oura accepts a `http://localhost` redirect URI; numeric rate limits; exact
  sleep sample intervals from the official OpenAPI file (official reference page did not
  render); how soon after waking the night is available; whether Gen3 without membership
  gets the full export.
- The team's camera model; per-OS support is stated by Arduino only as "standard UVC".
- StudentLife licence and exact archive size (site refused connection).
- Licences of Parselmouth, `@ricky0123/vad-web`; Silero VAD's GitHub page shows MIT in
  the sidebar but CC BY-NC 4.0 on a badge.
- iOS and Android behaviour for camera, microphone and location was not re-checked
  against official pages this run (motion and push were).
- Gemini Live session limits, free-tier data use terms.
