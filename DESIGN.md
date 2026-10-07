---
name: GIC Booth
description: A crisp photo-lab proof station built for fast, confident touchscreen sessions.
colors:
  photo-red: "#e43d30"
  cobalt-focus: "#2464c6"
  darkroom-yellow: "#f1bd38"
  proof-paper: "#f7f6f0"
  registration-ink: "#171717"
  adaptive-black: "#000000"
  pure-white: "#ffffff"
  mint-contact-background: "#2f8f70"
  pop-pink-background: "#cb5aa2"
  violet-flash-background: "#724fb5"
  proof-red-trim: "#8f211a"
  studio-blue-trim: "#163d83"
  mint-contact-trim: "#173f38"
  violet-flash-trim: "#352060"
  demo-neutral-gray: "#8b8d91"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(5.125rem, 15vw, 13.75rem)"
    fontWeight: 800
    lineHeight: 0.75
    letterSpacing: "0"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(4rem, 9vw, 8.125rem)"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "0"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "0"
  body:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  square: "0px"
spacing:
  hairline-gap: "6px"
  compact: "12px"
  control: "16px"
  panel: "24px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.photo-red}"
    textColor: "{colors.proof-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "0 28px"
    height: "60px"
  button-secondary:
    backgroundColor: "{colors.proof-paper}"
    textColor: "{colors.registration-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "0 28px"
    height: "60px"
  touch-start:
    backgroundColor: "{colors.proof-paper}"
    textColor: "{colors.photo-red}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "18px 24px"
  progress-segment:
    backgroundColor: "{colors.photo-red}"
    rounded: "{rounded.square}"
    height: "6px"
    width: "34px"
  timer-choice:
    backgroundColor: "{colors.proof-paper}"
    textColor: "{colors.registration-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.square}"
    padding: "16px"
    height: "260px"
  layout-proof-sheet:
    backgroundColor: "{colors.proof-paper}"
    textColor: "{colors.registration-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.square}"
    padding: "40px"
    height: "310px"
  selected-photo-proof:
    backgroundColor: "{colors.registration-ink}"
    textColor: "{colors.proof-paper}"
    rounded: "{rounded.square}"
    width: "100%"
  capture-countdown:
    backgroundColor: "transparent"
    textColor: "{colors.darkroom-yellow}"
    typography: "{typography.display}"
    size: "clamp(112px, 16vw, 220px)"
  physical-proof-strip:
    backgroundColor: "{colors.proof-paper}"
    textColor: "{colors.registration-ink}"
    rounded: "{rounded.square}"
    padding: "12px"
    height: "450px"
    width: "150px"
  frame-mint-contact:
    backgroundColor: "{colors.mint-contact-background}"
    textColor: "{colors.adaptive-black}"
    rounded: "{rounded.square}"
    padding: "18px"
  frame-picker-sample:
    backgroundColor: "{colors.photo-red}"
    textColor: "{colors.adaptive-black}"
    typography: "{typography.title}"
    rounded: "{rounded.square}"
    padding: "18px"
  frame-pop-pink:
    backgroundColor: "{colors.pop-pink-background}"
    textColor: "{colors.adaptive-black}"
    rounded: "{rounded.square}"
    padding: "18px"
  frame-violet-flash:
    backgroundColor: "{colors.violet-flash-background}"
    textColor: "{colors.pure-white}"
    rounded: "{rounded.square}"
    padding: "18px"
  frame-proof-red:
    backgroundColor: "{colors.photo-red}"
    textColor: "{colors.adaptive-black}"
    rounded: "{rounded.square}"
    padding: "18px"
  frame-studio-blue:
    backgroundColor: "{colors.cobalt-focus}"
    textColor: "{colors.pure-white}"
    rounded: "{rounded.square}"
    padding: "18px"
  frame-night-print:
    backgroundColor: "{colors.registration-ink}"
    textColor: "{colors.pure-white}"
    rounded: "{rounded.square}"
    padding: "18px"
---

# Design System: GIC Booth

## Overview

**Creative North Star: "The Photo-Lab Proof Station"**

GIC Booth should feel like stepping up to a working print counter: immediate, physical, and built around the proof itself. Crisp paper, registration ink, signal colors, and condensed type create a bold station that can be understood at standing distance without turning the task into spectacle.

Each viewport asks for one proofing decision. The interface stays direct while the product handles the complicated work: choose, wait for the automatic timer and capture flash, review proofs, then finish. Direction record: FORM seed `342bfd6f`; review disposition: ship after all six fixes resolved.

**Key Characteristics:**

- Full-field signal color at the start, followed by paper-led task screens.
- Oversized literal instructions with compact, direct supporting labels.
- Physical proof strips, dense contact-sheet grids, and six frame samples as the recurring material language.
- One obvious touch action or decision per viewport.
- Six visible workflow steps after the welcome screen.
- Automatic countdown, capture flash, and proof selection as the signature sequence.

## Colors

The core palette is a compact set of print-room signals: one commanding red, one functional cobalt, one timing yellow, and a warm paper-and-ink neutral pair. Frame samples use saturated red, blue, black, green, pink, and violet backgrounds; their text switches only between Registration Ink and Pure White according to contrast.

### Primary

- **Photo Red** (`#e43d30`): Owns the full welcome field, primary actions, completed progress, and the strongest system signal.

### Secondary

- **Cobalt Focus** (`#2464c6`): Marks keyboard focus and selected proofs; use it for confirmation and orientation, not decoration.

### Tertiary

- **Darkroom Yellow** (`#f1bd38`): Carries countdown urgency and camera-step progress.

### Neutral

- **Proof Paper** (`#f7f6f0`): The default canvas and the physical strip material.
- **Registration Ink** (`#171717`): Primary text, dark action bars, camera labels, and print-like structural lines.
- **Adaptive Black** (`#000000`): The dark branch of theme contrast, kept distinct from the softer interface ink so saturated strips meet the target ratio.
- **Pure White** (`#ffffff`): The high-contrast frame text for dark saturated theme backgrounds and sharp physical highlights.
- **Demo Neutral Gray** (`#8b8d91`): Replaces yellow in demo shot 3 so fallback captures do not imply a timing or completion signal.

### Sample Theme Palettes

- **Proof Red:** Photo Red (`#e43d30`) with Adaptive Black text and Deep Proof Red trim (`#8f211a`).
- **Studio Blue:** Cobalt Focus (`#2464c6`) with Pure White text and Deep Studio Blue trim (`#163d83`).
- **Night Print:** Registration Ink (`#171717`) with Pure White text and Proof Paper trim (`#f7f6f0`).
- **Mint Contact:** Contact Green (`#2f8f70`) with Adaptive Black text and Deep Contact Green trim (`#173f38`).
- **Pop Pink:** Print Pink (`#cb5aa2`) with Adaptive Black text and Registration Ink trim (`#171717`).
- **Violet Flash:** Flash Violet (`#724fb5`) with Pure White text and Deep Flash Violet trim (`#352060`).

Header, footer, and photo-frame text use the same WCAG relative-luminance calculation as the renderer. Convert sRGB channels to linear light, apply coefficients 0.2126, 0.7152, and 0.0722, then choose Adaptive Black when luminance is greater than 0.179 and Pure White otherwise. Dark theme backgrounds never receive dark text. Header and footer trim always use the theme-specific color listed above.

### Named Rules

**The Signal Has a Job Rule.** Red initiates and advances, cobalt selects and focuses, and yellow times or celebrates; never scatter them as decoration.

**The Paper Is the Canvas Rule.** Warm proof paper is the default surface. Pure white may appear only where the implementation needs a sharper physical proof highlight.

**The Frame Color Stays in Frame Rule.** Saturated backgrounds, luminance-derived black or white text, and assigned trim colors belong to frame previews and exported strips; core navigation, focus, progress, and actions retain the system signals.

**The Contrast Crossover Rule.** Use Adaptive Black above relative luminance 0.179 and Pure White at or below it for every theme header, footer, and frame edge.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow and sans-serif fallbacks)  
**Body Font:** Archivo (with Arial and sans-serif fallbacks)

**Character:** Barlow Condensed behaves like large production-room signage: compact, urgent, and literal. Archivo keeps instructions and status text calm, legible, and touch-friendly.

### Hierarchy

- **Display** (800, fluid 82-220px, 0.75 line-height): Reserved for the literal welcome offer.
- **Headline** (800, fluid 64-130px, 0.88 line-height): Names the single decision on each task screen.
- **Title** (700, 36px, 0.95 line-height): Labels layout and theme choices.
- **Body** (500, 16px, 1.45 line-height): Gives short instructions and recovery copy, generally within 42-65 characters per line.
- **Label** (700, 18px, 1.2 line-height): Names actions, counters, and compact status information.

### Named Rules

**The Literal Headline Rule.** Headings state the decision in plain language; they do not use kicker labels, slogans, or explanatory ornament.

**The Two-Voice Rule.** Barlow Condensed speaks only for display hierarchy. Archivo owns every control, instruction, count, and status.

## Layout

Every task screen occupies at least one viewport and centers one decision. Desktop screens use generous fluid insets and dense, legible choice grids; the capture step becomes a nearly full-viewport dark camera stage. A fixed back control stays at the upper left and the six-segment progress rail stays at the upper right, so position and workflow state never compete with the current decision.

Photo proofs use a five-up desktop contact sheet from 1200px upward, a three-up tablet sheet between 761px and 1199px, and a two-up phone sheet at 760px and below. Timer choices become full-width rows on phones. The welcome screen retains the complete four-frame proof strip above the oversized headline rather than cropping, hiding, or demoting it. Touch targets remain at least 56px high, while fixed-format strips, tiles, counters, and progress segments keep stable dimensions.

The finished result sits on neutral Proof Paper and uses a balanced, centered three-column composition on desktop: completion copy, the rendered strip, and actions. At 1000px and below it becomes a two-column tablet composition with the paired actions below. At 760px and below it tightens to a compact two-column phone composition; both action labels remain on one line.

Every screen transition resets the document scroll position to the top before the next decision is used. This keeps strip headers, back navigation, and progress visible even when the previous screen was scrolled.

**The One Decision Rule.** A viewport may ask for one choice, one confirmation, or one automatic wait state; it must not combine adjacent steps into a dashboard.

**The Strip Stays Whole Rule.** The physical proof strip is always shown as a complete object, including on mobile.

**The Responsive Proof Density Rule.** Preserve five proofs per row on desktop, three on tablet, and two on phone; do not trade scanability for larger decorative tiles.

**The Result Balance Rule.** Keep the result on Proof Paper with copy, print, and actions centered as a three-part desktop composition, then move the actions below the two-column composition on tablet and phone.

**The Fresh View Rule.** Every step transition returns the viewport to the top so the next screen begins with its header and strip controls fully visible.

## Elevation & Depth

The system is flat by default. Depth appears only when a surface represents a physical proof, selectable sheet, or final print: those elements use broad, soft shadows against the paper field. Structural UI such as progress, timer choices, action bars, and the camera stage uses color blocks and hard lines without ambient elevation.

### Shadow Vocabulary

- **Welcome proof** (`0 24px 44px rgba(78, 7, 0, 0.24)`): Lifts the angled four-frame strip from the full red field.
- **Choice sheet** (`0 18px 40px rgba(23, 23, 23, 0.09)`): Gives large layout choices the weight of paper samples.
- **Theme proof** (`0 16px 36px rgba(23, 23, 23, 0.10)`): Separates frame previews from the proof-paper canvas.
- **Finished print** (`0 24px 55px rgba(66, 47, 0, 0.25)`): Makes the rendered strip the physical result of the session.

**The Proofs Cast Shadows Rule.** Only proof-like artifacts and selectable sheets receive ambient shadows; ordinary controls stay flat.

## Shapes

The form language is square and print-cut. Buttons, progress segments, proof cells, camera frames, and selection borders use hard corners (0px). Low-radius controls are acceptable only when a platform constraint requires them; rounded pills, decorative blobs, and soft card silhouettes do not belong to this world. Thick selection strokes and narrow divider lines provide tactile separation without ornamental frames.

**The Guillotine Edge Rule.** Prefer crisp rectangular cuts and stable aspect ratios over soft containers or decorative clipping.

## Components

### Buttons

- **Shape:** Square, with stable touch dimensions and direct labels.
- **Primary:** Photo Red with Proof Paper text; 60px high with 28px horizontal padding on standard screens.
- **Hover / Focus:** Hover may change only the purposeful signal or paper tone. Focus uses a 4px Cobalt Focus outline with a 4px offset. Disabled actions remain visible at 42% opacity.
- **Secondary:** Proof Paper with Registration Ink; use for recovery, restart, and paired result actions.

### Progress Rail

Six compact rectangular segments stay fixed at the top right. Completed steps use Photo Red on paper screens and Darkroom Yellow on the camera screen; incomplete segments stay quiet and neutral. The accessible label states the current step and total.

### Selection Sheets

Layout and theme choices read as handling paper samples, not browsing cards. Use spacious rectangular sheets, oversized names, stable strip diagrams, and the approved proof shadows. Photo proofs form a five-up desktop, three-up tablet, and two-up phone contact sheet with a 6px Cobalt Focus border and numbered square markers; selected markers invert to cobalt with paper text.

### Frame Picker

Offer six saturated sample themes in a responsive grid: Proof Red, Studio Blue, Night Print, Mint Contact, Pop Pink, and Violet Flash. Each sample uses its actual strip background and assigned trim, resolves header/footer/frame text to Adaptive Black or Pure White using the 0.179 luminance crossover, and keeps those theme colors inside the preview; choosing a sample must not recolor the picker chrome itself.

### Camera Stage

The camera occupies nearly the entire viewport inside a Registration Ink surround. The countdown is a very large Darkroom Yellow number centered directly over the live image, with a transparent background and only a restrained dark text shadow for legibility. A dark tabular photo count stays at the upper left, and the white capture flash covers the stage for 600ms. After the chosen interval, capture proceeds automatically without another button press. Reduced-motion mode collapses the flash duration while preserving the captured-state change.

### Result Composition

Proof Paper provides a neutral stage behind the finished strip. Desktop centers completion copy, final strip, and actions in three balanced columns. Tablet and phone retain two columns for copy and strip while placing the actions beneath them in two equal columns. Phone actions use compact padding and single-line labels.

### Physical Proof Strip

The signature strip is a narrow 1:3 paper object divided into three or four stable frames. It may rotate slightly when presented as a loose print, but remains fully visible and never becomes a decorative background crop.

## Do's and Don'ts

### Do:

- **Do** keep one proofing decision or automatic wait state in each viewport.
- **Do** preserve the six-step progress rail from layout through finished result.
- **Do** use the full four-frame proof strip, oversized literal offer, and one touch action in the first viewport.
- **Do** keep controls square, at least 56px high, directly labeled, and visibly focusable.
- **Do** preserve the timer-to-flash-to-proof-selection sequence, including a reduced-motion equivalent.
- **Do** preserve the five-up, three-up, and two-up contact-sheet density across desktop, tablet, and phone.
- **Do** keep the finished result balanced and centered, with compact single-line actions on phones.
- **Do** derive every theme header, footer, and frame text color from the 0.179 relative-luminance crossover, using true black (`#000000`) for the dark branch.
- **Do** reset scroll to the top whenever the workflow advances or returns to another screen.

### Don't:

- **Don't** add decorative cards, nested cards, kicker labels, or explanatory feature copy.
- **Don't** use gradients, blurred color fields, ornamental blobs, or signal colors without a functional role.
- **Don't** crop or hide the proof strip on mobile, or move it below the welcome headline.
- **Don't** use rounded pills, floating glass surfaces, or soft consumer-app styling.
- **Don't** add a manual shutter action after the timer has been chosen.
- **Don't** put the countdown number in a badge, tile, circle, or opaque background.
- **Don't** pair a dark saturated strip background with Adaptive Black when the contrast rule resolves to Pure White.
