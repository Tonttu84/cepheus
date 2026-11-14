---
name: "Cepheus"
description: "Warm Nordic clinical design system for post-TMS home wellbeing check-ins and outer-loop clinic follow-up."
colors:
  accent-sage: "#255748"
  accent-sage-hover: "#1c4438"
  accent-sage-soft: "#eaf2ef"
  accent-sage-border: "#d6e4de"
  amber-notice-bg: "#fffbeb"
  amber-notice-border: "#fcd34d"
  amber-notice-ink: "#451a03"
  amber-notice-dot: "#b45309"
  rose-urgent-bg: "#fff1f2"
  rose-urgent-border: "#fda4af"
  rose-urgent-ink: "#4c0519"
  rose-urgent-dot: "#be123c"
  surface-canvas: "#f7f4ef"
  surface-card: "#ffffff"
  surface-subtle: "#faf8f5"
  surface-muted: "#f1ece4"
  border-hairline: "#e4ddd2"
  border-tactile: "#d6cfc4"
  ink-primary: "#1a2421"
  ink-secondary: "#515d58"
  ink-muted: "#4e5a55"
typography:
  display:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "28px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-sage}"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.xl}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.accent-sage-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  button-not-today:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  scale-tap:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    height: "40px"
    width: "40px"
  scale-tap-active:
    backgroundColor: "{colors.accent-sage}"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.lg}"
    height: "40px"
    width: "40px"
  card-surface:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  badge-simulated:
    backgroundColor: "{colors.amber-notice-bg}"
    textColor: "{colors.amber-notice-ink}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  pill-emergency:
    backgroundColor: "{colors.rose-urgent-bg}"
    textColor: "{colors.rose-urgent-ink}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
---

# Design System: Cepheus

## Overview

**Creative North Star: "The Quiet Nordic Study"**

Cepheus is a warm, domestic-first clinical design system built for people recovering at home after TMS treatment and the clinic staff who follow their outer-loop trajectories. Rather than sterile hospital telemetry or gamified wellness trackers, every surface rests on a warm birch-paper canvas (`#f7f4ef`) paired with crisp white cards, stone hairlines, and literary old-style serif headings.

The system is intentionally low-effort and non-punitive. For patients who may be fatigued or unwell, reading columns stay narrow (`672px` max), touch targets are generous (`40px` × `40px`), and skipping a check-in ("Not today") is treated with quiet neutrality—never red error states, streaks, or scores. For clinic staff, the same warm paper grammar scales to structured three-column overview grids with tabular clinical figures and broad-area trajectory indicators.

**Key Characteristics:**
- Warm birch-paper ground (`#f7f4ef`) with crisp white card surfaces (`#ffffff`) and subtle alabaster wells (`#faf8f5`).
- Deep Nordic Forest Sage (`#255748`) as the sole primary action and consent accent.
- Literary old-style serif headings paired with clean system sans-serif controls and tabular numerals.
- Non-punitive interaction model: missed or skipped check-ins use neutral stone tones, reserving rose strictly for `112` emergency crisis paths and urgent trajectory dots.
- Hybrid hairline-first depth: `1px` warm stone borders (`#e4ddd2`) do the structural work, supported by whisper-light resting shadows.

## Colors

A grounded, low-glare Nordic palette built around warm paper neutrals, forest sage for calm agency, amber for simulated-data notices, and rose reserved strictly for emergency crisis routes and urgent trajectory dots.

### Primary
- **Nordic Forest Sage** (`accent-sage`): Primary CTA buttons, active `1`–`5` scale selections, consented/gentle-option pills, and brand accents.
- **Deep Forest Sage** (`accent-sage-hover`): Hover and pressed states for primary sage buttons.
- **Soft Sage Mist** (`accent-sage-soft`): Gentle-option and consented status pill backgrounds, and subtle active-state washes.
- **Sage Mist Border** (`accent-sage-border`): `1px` borders framing soft sage pills and reassurance banners.

### Secondary
- **Warm Amber Notice** (`amber-notice-bg`, `amber-notice-border`, `amber-notice-ink`, `amber-notice-dot`): Used for "Simulated data" badges, mild trajectory notices, and non-urgent clinical attention flags.

### Tertiary
- **Urgent Rose** (`rose-urgent-bg`, `rose-urgent-border`, `rose-urgent-ink`, `rose-urgent-dot`): Reserved strictly for the persistent `112` emergency crisis pill and urgent trajectory indicator dots.

### Neutral
- **Warm Birch Paper** (`surface-canvas`): The global page ground across all patient and clinic screens.
- **Crisp Card White** (`surface-card`): Primary elevated card and button surfaces.
- **Warm Alabaster** (`surface-subtle`): Inner prompt wells, "Not today" escape-hatch buttons, and secondary surface steps.
- **Muted Oat Linen** (`surface-muted`): Navigation pill trays and subtle inactive dividers.
- **Warm Stone Hairline** (`border-hairline`): Primary `1px` structural borders for cards, nav bars, and dividers.
- **Tactile Sand Border** (`border-tactile`): Slightly stronger `1px` borders for interactive controls, secondary buttons, and `1`–`5` scale buttons.
- **Deep Pine Ink** (`ink-primary`): Primary headings, body copy, and high-contrast interactive labels.
- **Muted Slate Moss** (`ink-secondary`): Supporting descriptions, secondary labels, and "Not today" button text.
- **Quiet Lichen Gray** (`ink-muted`): Metadata, timestamps, helper captions, and footer text.

### Named Rules
**The Non-Punitive Palette Rule.** Red/rose is reserved strictly for the `112` emergency crisis pill and trajectory indicator dots. Never use red or error styling for skipped ("Not today") or missed check-ins.

**The Warm Paper Ground Rule.** Never use cool hospital blue-grays (`#f3f4f6`, `#64748b`) or stark `#ffffff` as the page background; every screen rests on Warm Birch Paper (`--surface-canvas`).

## Typography

**Display Font:** `"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif`
**Body Font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

**Character:** Literary old-style serif headings establish domestic calm and human warmth, while clean system sans-serif keeps interactive controls, pills, and clinical figures crisp and effortless to scan.

### Hierarchy
- **Display** (`600`, `1.875rem` / `30px`, `line-height: 1.2`, `letter-spacing: -0.025em`): Page titles and primary hero greetings.
- **Headline** (`600`, `1.5rem` / `24px`, `line-height: 1.25`, `letter-spacing: -0.02em`): Major section headers and view titles.
- **Title** (`600`, `1.125rem` / `18px`, `line-height: 1.35`): Card titles and sub-section headings.
- **Body** (`400`, `0.875rem` / `14px`, `line-height: 1.625`): Patient prompts, clinical summaries, and general copy (`60ch–72ch` comfortable reading measure).
- **Label** (`600`, `0.6875rem` / `11px`, `line-height: 1.4`, `letter-spacing: 0.08em`): Uppercase section eyebrows, status pills, and form labels.
- **Mono** (`500`, `0.75rem` / `12px`, `line-height: 1.5`): Derived camera metrics, day indices, and technical identifiers.

### Named Rules
**The Editorial Heading, Utility Control Rule.** Literary old-style serif (`font-display`) belongs on page titles, section headers, and the Cepheus wordmark; interactive controls, pills, and body copy stay in clean system sans-serif.

**The Tabular Clinical Figures Rule.** All dates, day indices, scale numbers (`1`–`5`), phone numbers, and derived camera metrics must apply `font-variant-numeric: tabular-nums` (`.tabular-nums`).

## Layout

The global shell stacks a persistent `CrisisHelpBar` at the very top, followed by a sticky frosted `SiteNav`, a centered `<main class="max-w-6xl">` container (`1152px`), and a quiet footer.

Patient-facing check-in flows on `/patient` constrain content to a narrow, low-effort reading column (`max-w-2xl` / `672px`) so fatigued users never scan wide dashboards. Clinic follow-up and overview screens expand to the full `max-w-6xl` (`1152px`) container using responsive three-column grids (`grid-cols-1 lg:grid-cols-3`). Vertical rhythm uses `32px` (`space-y-8`) between major sections and `24px` to `28px` (`p-6 sm:p-7`) internal card padding.

## Elevation & Depth

Cepheus uses hybrid tonal paper layering (`#f7f4ef` canvas → `#ffffff` card → `#faf8f5` inner well) paired with `1px` warm stone hairlines and whisper-light resting shadows (`shadow-xs`, `shadow-2xs`).

### Shadow Vocabulary
- **Card Rest** (`box-shadow: 0 1px 2px 0 rgba(26, 36, 33, 0.05)`): Subtle resting lift on primary white cards.
- **Control Micro-Lift** (`box-shadow: 0 1px 1px 0 rgba(26, 36, 33, 0.04)`): Whisper-light tactile edge on secondary buttons and scale taps.
- **Ambient Canopy** (`background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(37, 87, 72, 0.06), transparent)`): Soft top-of-page sage wash that anchors the header without heavy gradients.

### Named Rules
**The Hairline-First Depth Rule.** Surfaces separate primarily through warm 1px stone borders (`--border-hairline`) and tonal paper steps; shadows stay subtle (`shadow-xs` max) and never bloom into heavy floating drop-shadows.

## Shapes

Softly rounded domestic geometry softens every clinical surface: `16px` (`rounded-2xl`) for primary section cards, `12px` (`rounded-xl`) for inner sub-cards, prompt wells, and action buttons, `8px` (`rounded-lg`) for navigation tabs, `1`–`5` scale tap squares, and the brand icon tile, `6px` (`rounded-md`) for compact inline badges, and `9999px` (`rounded-full`) for status, simulated-data, and emergency crisis pills.

## Components

### Buttons
- **Shape:** Softly rounded (`12px` radius) with `150ms` color transitions.
- **Primary:** Nordic Forest Sage (`accent-sage`) background with crisp white text (`surface-card`), `10px 18px` padding; shifts to Deep Forest Sage (`accent-sage-hover`) on hover.
- **Secondary:** Crisp white (`surface-card`) background with `1px` Tactile Sand Border (`border-tactile`) and Deep Pine Ink (`ink-primary`) text.
- **"Not today" Escape Hatch:** Warm Alabaster (`surface-subtle`) background with `1px` Warm Stone Hairline (`border-hairline`) and Muted Slate Moss (`ink-secondary`) text—calm, neutral, and never styled as an error.

### Chips
- **Simulated Data Badge:** Warm Amber Notice (`amber-notice-bg`) fill, `1px` `amber-notice-border`, `amber-notice-ink` text, `9999px` pill radius, `4px 10px` padding.
- **Consented / Gentle Option Sage Pill:** Soft Sage Mist (`accent-sage-soft`) fill, `1px` `accent-sage-border`, `accent-sage` text, `9999px` pill radius.
- **Emergency 112 & Helpline Pills:** Urgent Rose (`rose-urgent-bg`) fill, `1px` `rose-urgent-border`, `rose-urgent-ink` text, `9999px` pill radius, `4px 12px` padding, with a `6px` `rose-urgent-dot` indicator.

### Cards / Containers
- **Primary Section Card:** `16px` radius, crisp white (`surface-card`) fill, `1px` `border-hairline`, `24px`–`28px` internal padding, and `Card Rest` shadow.
- **Sub-card / Prompt Well:** `12px` radius, Warm Alabaster (`surface-subtle`) fill, `1px` `border-hairline`, `16px` padding.
- **Reassurance & Boundary Banner:** `12px` radius, Soft Sage Mist (`accent-sage-soft`) fill, `1px` `accent-sage-border`, Deep Pine Ink (`ink-primary`) copy.

### Inputs / Fields
- **1–5 Check-In Scale Tap Buttons:** `40px` × `40px` tactile squares (`8px` radius), crisp white (`surface-card`) fill with `1px` `border-tactile` at rest, shifting to `accent-sage` fill with white tabular numerals when selected.

### Navigation
- **Global Header:** Sticky frosted header over `surface-canvas` with a `1px` `border-hairline` bottom rule, Muted Oat Linen (`surface-muted`) pill-tray navigation bar, and the persistent `CrisisHelpBar` anchored above.

### Broad-Area Clinic Flag Card
- **Signature Component:** Combines a `16px` white card surface, tabular day-index metadata, and a compact broad-area flag chip (`amber-notice` or `rose-urgent` dot + pill) to surface outer-loop trajectory shifts without diagnostic or relapse-prediction claims.

## Do's and Don'ts

### Do:
- **Do** ground every screen on Warm Birch Paper (`#f7f4ef`) and separate cards with `1px` Warm Stone Hairlines (`#e4ddd2`).
- **Do** use literary old-style serif (`font-display`) for page titles, section headers, and the Cepheus wordmark.
- **Do** apply `tabular-nums` to all dates, day indices, `1`–`5` scale buttons, phone numbers, and derived camera metrics.
- **Do** keep patient check-in flows in a narrow `max-w-2xl` (`672px`) column with `40px` × `40px` touch targets.
- **Do** label all simulated or open-dataset figures with the Warm Amber `Simulated data` badge.

### Don't:
- **Don't** use red or error styling for skipped ("Not today") or missed check-ins; reserve rose strictly for `112` emergency crisis pills and urgent trajectory dots.
- **Don't** use cool hospital blue-grays (`#f3f4f6`, `#64748b`) or stark `#ffffff` as the page background.
- **Don't** add streaks, scores, gamified badges, or punitive counters anywhere in the interface.
- **Don't** use heavy floating drop-shadows; keep elevation subtle (`shadow-xs` max) and hairline-first.
- **Don't** claim diagnosis, relapse prediction, or brain stimulation in any UI copy or status label.
