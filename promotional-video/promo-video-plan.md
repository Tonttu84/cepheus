# Cepheus Promotional Video Plan & Gemini Video API Prompts

## 1. Overview & Clinical Guardrails

- **Target Duration:** 80–90 seconds (8 modular scenes of 10–12 seconds each).
- **Resolution & Aspect Ratio:** `1080p`, `16:9` landscape (`response_format={"type": "video", "aspect_ratio": "16:9", "resolution": "1080p", "duration": "10s"}`).
- **Gemini Models Used:**
  - **Character & Reference Sheet Generation:** `gemini-nano-banana-2.1` (Nano Banana 2.1)
  - **Scene Video Generation & Chaining:** `gemini-omni-1.2-flash` (Omni 1.2 Flash)
  - **Voiceover Generation:** `gemini-3.8-flash-tts`
- **Strict Clinical & Privacy Rules (`PRODUCT.md`):**
  1. Never claim that Cepheus diagnoses, treats, detects, or predicts depression relapse.
  2. Never claim that AI reads mood or emotions from faces or voices.
  3. Always show that **0 bytes of video or audio leave the device** (100% on-device WebAssembly kinematics).
  4. Keep the `Simulated data` badge visible on all product screen recordings.

---

## 2. Anchor Assets for 100% Visual Consistency

To keep the **character** and the **Cepheus Desk Buddy device** identical across every generated clip, `gemini-omni-1.2-flash` supports **up to 6 reference images** per call via natural-language media binding (without legacy `<IMAGE_REF_*>` tags).

### 2.1 Existing Device Reference Images (Already Rendered)

Pass these three Blender renders as reference images in every hardware scene:
1. **Device Front Reference (`ref_device_front.png`):** `/home/ferrum/study/junction2026/cepheus/hardware/enclosure/render_front.png`
2. **Device Side Reference (`ref_device_side.png`):** `/home/ferrum/study/junction2026/cepheus/hardware/enclosure/render_left_side.png`
3. **Device Exploded Reference (`ref_device_exploded.png`):** `/home/ferrum/study/junction2026/cepheus/hardware/enclosure/render_exploded_layers.png`

### 2.2 Master Prompt for Patient Character Reference Sheet (`ref_patient_aino.png`)

Generate this character reference image first with `gemini-nano-banana-2.1` and pass it as a reference image to every scene featuring the patient:

```text
Photorealistic cinematic character turnaround and portrait reference sheet of Aino, a 32-year-old Finnish woman in post-TMS recovery at home in Helsinki. She has shoulder-length wavy chestnut-brown hair tucked behind one ear, warm hazel eyes, light natural freckles across her nose, and a calm, relatable expression. She wears an oversized oatmeal-cream knitted wool cardigan over a soft sage-green cotton t-shirt, and a sleek matte-black smart ring on her left index finger. Soft Nordic morning window light, birch-wood and warm linen apartment background, shot on 50mm prime lens, f/2.0, natural skin texture, AgX color grading, 16:9 aspect ratio.
```

### 2.3 Master Prompt for Clinic Nurse Character Reference (`ref_nurse_mikko.png`)

Generate this second character reference image with `gemini-nano-banana-2.1` for Scene 7:

```text
Photorealistic cinematic medium portrait of Mikko, a 42-year-old Finnish psychiatric clinic nurse at an outpatient TMS clinic in Helsinki. He has short salt-and-pepper hair, rectangular tortoiseshell glasses, a warm and attentive expression, wearing a clean forest-green scrub top with a subtle hospital lanyard and a lightweight headset microphone. Warm modern Nordic clinic office with light birch desk and soft daylight, shot on 50mm lens, f/2.2, natural skin texture, 16:9 aspect ratio.
```

---

## 3. Scene-by-Scene Video Plan & Gemini Omni 1.2 Flash Prompts

In `gemini-omni-1.2-flash`, pass the reference images in the `input` list and describe their role in plain English (`"Use the first reference image for the character Aino and the second reference image for the peach-and-white Cepheus Desk Buddy device..."`).

---

### Scene 1: The Hook — Coming Home After TMS (`0:00–0:10`, `duration: "10s"`)

- **Purpose:** Establish the post-TMS gap after hospital discharge and end on a locked centered close-up of the Cepheus Desk Buddy so it match-cuts seamlessly into Scene 2.
- **Transition to Scene 2:** **Smooth Match-Cut on the Desk Buddy** (final 2 seconds settle into the exact centered front framing of `render_front.png`).
- **Reference Images to Attach:**
  1. `ref_patient_aino.png`
  2. `ref_device_front.png`
- **Gemini Omni 1.2 Flash Video Prompt:**
  ```text
  [0-4s] Medium cinematic shot in a cozy Nordic bedroom with birch-wood furniture and soft morning window light. The woman from the first reference image (Aino, 32, wearing her oatmeal knitted cardigan and matte-black smart ring on her left index finger) sits on the edge of her bed, taking a quiet breath.
  [4-8s] Smooth rack focus and slow dolly-in toward the bedside table beside her, where the exact peach-and-white hamster-shaped Cepheus Desk Buddy enclosure from the second reference image sits at rest with its white sleeping visor flipped down, showing its brown curved sleeping eyes and eyelashes.
  [8-10s] The camera settles into a dead-center, straight-on close-up of the Cepheus Desk Buddy matching the exact framing and scale of the second reference image while the bedroom background softly blurs into a warm cream studio tone, preparing a seamless match-cut into the next scene. Soft acoustic piano notes in the background. Use the given images as character and object references for video generation.
  ```
- **Voiceover (`gemini-3.8-flash-tts`):**
  > *"Transcranial Magnetic Stimulation helps thousands recover from severe depression. Yet nearly half who improve slip back within months of going home — where noisy daily mood apps feel exhausting."*

---

### Scene 2: Inside the Cepheus Desk Buddy — Physical Privacy by Design (`0:10–0:20`, `duration: "10s"`)

- **Purpose:** Showcase the 3D-printed engineering (`Arduino UNO Q` + `USB-C Hub` + `USB Camera`) and the physical flip-up privacy visor.
- **Transition from Scene 1 / to Scene 3:** Starts seamlessly from the centered `render_front.png` match-cut frame; ends with a **clean hard cut** to Day 18.
- **Inputs to Attach:**
  1. First frame: `render_front.png`
  2. Last frame: `render_exploded_layers.png`
- **Gemini Omni 1.2 Flash Video Prompt (First-and-Last-Frame Keyframe Transition):**
  ```text
  [0-2s] Hold briefly on the starting frame showing the centered peach-and-white Cepheus Desk Buddy enclosure on a warm cream studio cyclorama backdrop to complete the match-cut from the previous scene.
  [2-5s] Smoothly orbit 20 degrees while the white privacy visor pivots upward 56 degrees on its side hinge arms to reveal the round black USB camera inside.
  [5-10s] Smoothly separate the enclosure vertically along the Z-axis into the 10-layer exploded hardware stack shown in the second image, revealing the teal Arduino UNO Q board, 8-in-1 USB-C hub, round USB camera, and click-in pins, holding cleanly on the final frame. Subtle mechanical servo click sound and calm studio ambient tone. Use the first image as the starting frame and the second image as the ending frame.
  ```
- **Voiceover:**
  > *"Meet Cepheus: a calm home companion built around three words — Ask, Warn, Call. Its physical privacy visor covers the camera completely at rest and opens only when you choose to check in."*

---

### Scene 3: Day 18 (Doing Well) — The 20-Second Check-In & Zero Guilt (`0:20–0:30`, `duration: "10s"`)

- **Purpose:** Show the twice-weekly 2-tap check-in, the penalty-free **"Not today"** escape hatch, and the persistent **Crisis Help Bar** (`112`, MIELI Helpline, Clinic Nurse).
- **Transition to Scene 4:** **Continuous Camera Pan / Video Extension** within the same Day 18 kitchen-table moment (camera pans from Aino's hand setting down the phone directly onto the Cepheus Desk Buddy on the table).
- **Reference Images to Attach:**
  1. `ref_patient_aino.png`
  2. `ref_device_side.png`
- **Screen Recording Overlay / Insert:** Record `/check-in` showing the two tactile word-labelled `0–4` scale taps, the `"Not today"` button, and the top Crisis Help Bar (anchored in `scene_03_day18_checkin.mp4`, Trail #71).
- **Gemini Omni 1.2 Flash Video Prompt:**
  ```text
  [0-4s] Clean cut to a bright morning in the Nordic apartment ("Day 18"). Over-the-shoulder medium shot of Aino from the first reference image sitting at her birch kitchen table in warm daylight, holding her smartphone with the peach-and-white Cepheus Desk Buddy from the second reference image resting on the table to her right.
  [4-8s] Close-up of her left hand wearing the matte-black smart ring as her thumb calmly taps twice on the warm-cream mobile interface and sets the phone down on the birch tabletop.
  [8-10s] In one continuous, unbroken camera movement, glide rightward across the birch tabletop and push in toward the peach-and-white Cepheus Desk Buddy so the device fills the center-right of the frame at the final second, leading directly into Scene 4. Calm, warm ambient acoustic underscore. Use the given images as character and object references for video generation.
  ```
- **Voiceover:**
  > *"At Day 18, checking in takes twenty seconds twice a week. Two simple taps, zero streaks, zero patient-facing scores, a guilt-free 'Not today' button, and one-tap human crisis support on every screen."*

---

### Scene 4: 100% On-Device Camera Kinematics & Granular Sensor Consent (`0:30–0:40`, `duration: "10s"`)

- **Purpose:** Continue the unbroken Day 18 moment into `/camera` (MediaPipe Face Landmarker in WebAssembly, `0` bytes of video leave the browser) and `/monitoring` per-channel consent switches + smart-ring Sleep Regularity Index (SRI).
- **Transition from Scene 3 / to Scene 5:** **Seamless continuation / video extension** from Scene 3 (`input=[scene_03_video, ...]`), followed by a **clean hard cut** at the end to jump +11 days to Day 29.
- **Inputs to Attach:**
  - Option A (Video Extension): `[scene_03_checkin.mp4, ref_patient_aino.png, render_front.png]`
  - Option B (Standalone Clip): `[ref_patient_aino.png, render_front.png, render_left_side.png]`
- **Gemini Omni 1.2 Flash Video Prompt:**
  ```text
  [0-4s] Continue the smooth rightward camera settle from the previous shot onto the peach-and-white Cepheus Desk Buddy on the birch table; its white privacy visor smoothly pivots upward 56 degrees on its side hinge arms to reveal the internal round black camera.
  [4-8s] Reverse angle of Aino from the first reference image looking calmly toward the desk unit for a brief check-in while her matte-black smart ring catches the morning daylight.
  [8-10s] The Desk Buddy visor flips back down into its peaceful sleeping face to lock privacy, holding steady for a clean cut at the end of the shot. Use the given images as character and object references for video generation.
  ```
- **Voiceover:**
  > *"Optional camera kinematics run 100% on-device in WebAssembly — zero video or audio ever leaves the home. Smart-ring sleep regularity is compared only against Aino's own baseline, with granular per-sensor consent."*

---

### Scene 5: Day 29 (Mild 1-Round Dip) — One Gentle Step, Never a False Alarm (`0:40–0:52`, `duration: "12s"`)

- **Purpose:** Show `/patient` at **Day 29**: a single low round does not alarm the clinic; instead, the patient gets **one low-effort suggestion card** (`Short walk outside` / `Breathing space`).
- **Transition from Scene 4 / to Scene 6:** Starts with a **hard cut** (jumping from sunny Day 18 to overcast Day 29); ends with a **0.4s dip to warm dark evening shadow** to jump +27 days to Day 56.
- **Reference Images to Attach:**
  1. `ref_patient_aino.png`
  2. Mobile screenshot of live `/patient` (`"One small step for today"` / `"Take a 10-minute walk outside"`) so the phone screen faces Aino cleanly (Trail #74).
- **Screen Recording Overlay / Insert:** `/patient` timeline switched to **Day 29 (Small Dip)** showing the single suggestion card.
- **Gemini Omni 1.2 Flash Video Prompt:**
  ```text
  [0-5s] Clean hard cut to an overcast afternoon by the apartment window ("Day 29"). Over-the-shoulder shot of Aino from the reference image in her oatmeal cardigan holding her smartphone with the real /patient screen ("One small step for today" / "Take a 10-minute walk outside") facing her rather than away from her.
  [5-11s] Cut to Aino stepping outside onto a quiet Helsinki tree-lined park path in soft autumn daylight, taking a slow, grounding walk with her hands in her cardigan pockets and her matte-black smart ring visible.
  [11-12s] Gentle camera tilt toward the darkening evening sky for a clean time-jump transition into Night / Day 56. Gentle, uplifting acoustic guitar chord progression. Use the given images as character and UI references for video generation.
  ```
- **Voiceover:**
  > *"On Day 29, a mild one-round dip doesn't trigger a false alarm or overwhelm the patient. Cepheus offers just one calm, low-effort step for today — like a short walk outside."*

---

### Scene 6: Day 56 (Sustained Drift & Silence) — Silence Is Signal, Not Failure (`0:52–1:02`, `duration: "10s"`)

- **Purpose:** Show that when two check-in rounds go unanswered while the smart ring is still worn, Cepheus treats silence as an outreach signal for the clinic rather than punishing the patient.
- **Transition to Scene 7:** **Causal Push-In + Audio J-Cut** (camera pushes smoothly toward the untouched phone and sleeping Desk Buddy while a soft outgoing clinic call chime begins at `8.5s`, dissolving seamlessly into Nurse Mikko's screen in Scene 7).
- **Reference Images to Attach:**
  1. `ref_patient_aino.png`
  2. `ref_device_front.png`
- **Gemini Omni 1.2 Flash Video Prompt:**
  ```text
  [0-5s] Quiet evening scene in the Nordic apartment ("Day 56") lit by soft warm lamp light. Aino from the first reference image rests quietly on the sofa under a wool blanket, her matte-black smart ring visible on her left index finger.
  [5-8s] Close-up of her smartphone lying untouched face-down on the side table beside the sleeping peach-and-white Cepheus Desk Buddy from the second reference image.
  [8-10s] Slow, purposeful camera push-in on the matte-black smart ring and the untouched phone while a gentle, warm clinic phone-call chime begins in the audio track, setting up a smooth cross-dissolve into the clinic desk in the next scene. Use the given images as character and object references for video generation.
  ```
- **Voiceover:**
  > *"By Day 56, two check-ins go unanswered while Aino's smart ring shows it is still worn. In Cepheus, silence is never a broken streak — it is a signal for human care to reach out."*

---

### Scene 7: The Clinic Dashboard, Verda AI Pre-Call Brief & Nurse Call (`1:02–1:15`, `duration: "13s"`)

- **Purpose:** Show `/clinic` at **Day 56**: the broad-area **Clinic Flag card**, the **Verda / Gemma Pre-Call Brief** (strictly verified derived numbers, zero raw sensor traces), and the nurse calling the patient to schedule a **5-session TMS booster**.
- **Transition from Scene 6 / to Scene 8:** Opens from a **smooth 0.6s cross-dissolve** matching the slow push-in from Scene 6; ends on a warm hold that dissolves (`0.8s`) into the final hero shot.
- **Reference Images to Attach:**
  1. `ref_nurse_mikko.png`
  2. `ref_patient_aino.png`
- **Screen Recording Overlay / Insert:** `/clinic` flag card -> click **Generate Pre-Call Brief** -> click **Request Nurse Call / Offer 5-Day Booster**.
- **Gemini Omni 1.2 Flash Video Prompt:**
  ```text
  [0-6s] Matching the slow push-in motion from the previous shot, medium shot of the clinic nurse Mikko from the first reference image (42, tortoiseshell glasses, forest-green scrubs, headset) at a bright Nordic clinic desk, reviewing a clean broad-area summary card on his monitor and clicking to initiate a phone call.
  [6-13s] Warm intercut back to the apartment: Aino from the second reference image answers her phone in her oatmeal cardigan, her expression softening with genuine relief as she speaks with her clinic nurse. Hold warmly on her relieved smile at the final second for a slow dissolve into the closing hero shot. Warm, reassuring piano melody. Use the given images as character references for video generation.
  ```
- **Voiceover:**
  > *"At the clinic, nurses see only broad life areas and a verified pre-call brief — never raw private traces. Nurse Mikko calls Aino directly, checks in person-to-person, and schedules a five-session TMS booster cluster."*

---

### Scene 8: The Closer — Beyond the Clinic (`1:15–1:25`, `duration: "10s"`)

- **Purpose:** End on the core clinical principle and the Cepheus Desk Buddy closing its visor into a peaceful sleep state.
- **Transition from Scene 7:** Opens from a **slow 0.8s warm dissolve** into golden morning sunlight.
- **Reference Images to Attach:**
  1. `ref_device_front.png`
  2. `ref_device_side.png`
- **Gemini Omni 1.2 Flash Video Prompt:**
  ```text
  [0-6s] Hero close-up on a warm birch tabletop in golden morning sunlight: the peach-and-white Cepheus Desk Buddy from the reference images gently lowers its white privacy visor down over the camera, settling into its peaceful brown sleeping eyes and smile.
  [6-10s] Camera slowly pulls back to a clean, centered composition with soft warm bokeh in the background, leaving clean negative space at the top for the title text "Cepheus — Beyond the Clinic". Gentle resolving piano chord. Use the given images as object references for video generation.
  ```
- **Voiceover:**
  > *"Software decides when to reach out. A human conversation decides what is happening. Cepheus — keeping care connected, beyond the clinic."*

---

## 4. Ready-to-Run Python Script for Gemini Video API (`google-genai >= 3.2.0`)

Save your character reference images (`ref_patient_aino.png`, `ref_nurse_mikko.png`) alongside your existing Blender renders in `hardware/enclosure/` and run this script using the current **Interactions API** (`client.interactions.create`):

```python
import base64
from pathlib import Path
from google import genai

client = genai.Client()
ENCLOSURE_DIR = Path("/home/ferrum/study/junction2026/cepheus/hardware/enclosure")
OUT_DIR = ENCLOSURE_DIR / "promo_clips"
OUT_DIR.mkdir(exist_ok=True)


def b64_img(path: Path, mime_type: str = "image/png") -> dict:
    return {
        "type": "image",
        "data": base64.b64encode(path.read_bytes()).decode("utf-8"),
        "mime_type": mime_type,
    }


def save_image(interaction, out_path: Path) -> None:
    if interaction.output_image and interaction.output_image.data:
        out_path.write_bytes(base64.b64decode(interaction.output_image.data))
        print(f"Saved image: {out_path}")


def save_video(interaction, out_path: Path) -> None:
    if interaction.output_video and interaction.output_video.data:
        out_path.write_bytes(base64.b64decode(interaction.output_video.data))
        print(f"Saved video: {out_path}")


# Step 1: Generate consistent character reference sheets with Nano Banana 2.1
aino_ref = OUT_DIR / "ref_patient_aino.png"
if not aino_ref.exists():
    res_aino = client.interactions.create(
        model="gemini-nano-banana-2.1",
        input=(
            "Photorealistic cinematic character turnaround and portrait reference sheet of Aino, "
            "a 32-year-old Finnish woman in post-TMS recovery at home in Helsinki. She has "
            "shoulder-length wavy chestnut-brown hair tucked behind one ear, warm hazel eyes, "
            "light natural freckles across her nose, and a calm, relatable expression. She wears "
            "an oversized oatmeal-cream knitted wool cardigan over a soft sage-green cotton t-shirt, "
            "and a sleek matte-black smart ring on her left index finger. Soft Nordic morning window "
            "light, birch-wood and warm linen apartment background, shot on 50mm prime lens, f/2.0, "
            "natural skin texture, AgX color grading."
        ),
        response_format={"type": "image", "aspect_ratio": "16:9"},
    )
    save_image(res_aino, aino_ref)

mikko_ref = OUT_DIR / "ref_nurse_mikko.png"
if not mikko_ref.exists():
    res_mikko = client.interactions.create(
        model="gemini-nano-banana-2.1",
        input=(
            "Photorealistic cinematic medium portrait of Mikko, a 42-year-old Finnish psychiatric "
            "clinic nurse at an outpatient TMS clinic in Helsinki. He has short salt-and-pepper hair, "
            "rectangular tortoiseshell glasses, a warm and attentive expression, wearing a clean "
            "forest-green scrub top with a subtle hospital lanyard and a lightweight headset microphone. "
            "Warm modern Nordic clinic office with light birch desk and soft daylight, 50mm lens, f/2.2."
        ),
        response_format={"type": "image", "aspect_ratio": "16:9"},
    )
    save_image(res_mikko, mikko_ref)

# Step 2: Generate Scene 1 with Gemini Omni 1.2 Flash using both character + device references
res_scene_01 = client.interactions.create(
    model="gemini-omni-1.2-flash",
    input=[
        b64_img(aino_ref),
        b64_img(ENCLOSURE_DIR / "render_front.png"),
        {
            "type": "text",
            "text": (
                "[0-4s] Medium cinematic shot in a cozy Nordic bedroom with birch-wood furniture "
                "and soft morning window light. The woman from the first reference image (Aino, 32, "
                "wearing her oatmeal knitted cardigan and matte-black smart ring on her left index finger) "
                "sits on the edge of her bed, taking a quiet breath. "
                "[4-10s] Smooth rack focus and slow dolly-in to the bedside table beside her, where the "
                "exact peach-and-white hamster-shaped Cepheus Desk Buddy enclosure from the second reference "
                "image sits at rest with its white sleeping visor flipped down, showing its brown curved "
                "sleeping eyes and eyelashes. Soft acoustic piano notes in the background. "
                "Use the given images as character and object references for video generation."
            ),
        },
    ],
    response_format={
        "type": "video",
        "aspect_ratio": "16:9",
        "resolution": "1080p",
        "duration": "10s",
    },
)
save_video(res_scene_01, OUT_DIR / "scene_01_hook.mp4")
```
