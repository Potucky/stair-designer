# Florida Stair / Railing / Guard Code Requirements — Working Reference for StairForge Studio

**Purpose:** working Markdown reference for StairForge Studio validation rules, PDF warnings, material checks, and field/fabrication notes.

**Jurisdiction focus:** Florida, using the **Florida Building Code, 8th Edition (2023)** as the current statewide baseline. The Florida Building Code site states the 8th Edition (2023) effective date as **December 31, 2023**. Local jurisdictions may add administrative requirements, product approvals, permit procedures, coastal/wind requirements, and inspection rules.

> **Important disclaimer:** This file is a working code-summary checklist for design assistance only. It is **not legal advice**, **not engineering approval**, and **not a substitute for stamped drawings, permit review, local building department interpretation, or a licensed engineer/architect where required.** Always verify the latest adopted code, local amendments, project occupancy, and permit requirements before fabrication or installation.

---

## 1. Primary Source List

Use these as source-of-truth links when updating this file:

1. Florida Building Code Online  
   <https://www.floridabuilding.org/>

2. ICC Digital Codes — 2023 Florida Building Code, Building, 8th Edition  
   <https://codes.iccsafe.org/content/FLBC2023P1/chapter-10-means-of-egress>

3. ICC Digital Codes — 2023 Florida Building Code, Residential, 8th Edition  
   <https://codes.iccsafe.org/content/FLRC2023P1/chapter-3-building-planning>

4. Florida Building Code, Building — Chapter 16 Structural Design, Section 1607.9 loads on handrails/guards  
   <https://codes.iccsafe.org/content/FLBC2023P2/chapter-16-structural-design>

5. Miami-Dade summary PDF — Florida Building Code 8th Edition (2023) significant changes  
   <https://www.miamidade.gov/building/library/2023-fbc-changes-building-flooding-structural.pdf>

6. Florida Building Code change analysis resources  
   <https://www.floridabuilding.org/fbc/thecode/2023_Code_Development/2023_Code_Resources/>

---

## 2. Code Families to Track in the App

StairForge should not use only one rule set for every job. The app should ask the user what kind of project it is:

| Project type | Likely code family | Notes |
|---|---|---|
| One- and two-family dwelling / townhouse | FBC Residential | Often uses IRC-style rules: 36 in stair width, 7 3/4 in max riser, 10 in min tread, 34–38 in handrail. |
| Commercial / public / multifamily common egress | FBC Building | Often uses IBC-style rules: 44 in stair width in many cases, 7 in max riser, 11 in min tread, 42 in guards, accessibility/egress requirements. |
| Exterior decks / balconies / porches | Residential or Building, depending on occupancy | Guard required when drop is over 30 in. |
| Pool areas | FBC Building / Residential + pool-specific provisions | Separate pool barrier / handrail rules may apply. |
| Miami-Dade / HVHZ / coastal | FBC + local amendments + product approval/wind requirements | Verify local permit requirements. |
| OSHA workplace stairs/platforms | OSHA may apply in addition to building code | Do not mix OSHA with residential code unless project requires it. |

---

## 3. Quick Rule Summary for StairForge MVP

These are the most important rules to put into the validation engine first.

| Rule | Residential baseline | Building / commercial baseline | App validation severity |
|---|---:|---:|---|
| Handrail height over stair nosing | 34–38 in | 34–38 in | Error if outside |
| Guard required at open side/drop | More than 30 in drop | More than 30 in drop | Warning/Error |
| Residential guard height at walking surfaces | 36 in min | Usually 42 in min | Error if below selected code family |
| Stair-side guard height | 34 in min; if guard top is handrail, 34–38 in | 42 in guard unless exception; handrail remains 34–38 in | Error/Warning |
| Guard opening general sphere | 4 in max sphere | 4 in max sphere | Error |
| Stair guard baluster opening | 4 3/8 in max sphere on open side of stairs | Special FBC Building exceptions; often 4 3/8 in in dwelling units | Error |
| Triangle at tread/riser/bottom rail | 6 in max sphere | 6 in max sphere | Error |
| Residential stair width | 36 in min clear width above handrail height | Varies by occupant load; often 44 in or 36 in exceptions | Error/Warning |
| Handrail projection | Max 4 1/2 in each side | Similar concept in egress width calculations | Warning/Error |
| Residential minimum clear width with one handrail | 31 1/2 in | Varies | Warning |
| Residential minimum clear width with two handrails | 27 in | Varies | Warning |
| Residential headroom | 6 ft 8 in min | 80 in / 6 ft 8 in commonly | Error |
| Residential max riser | 7 3/4 in | 7 in common IBC/FBC Building | Error |
| Residential min tread | 10 in | 11 in common IBC/FBC Building | Error |
| Handrail required | At least one side when 4+ risers | Required by FBC Building egress rules | Error/Warning |
| Concentrated load on handrails/guards | 200 lb design load | 200 lb design load | Engineering note |
| Guard infill/baluster load | Check applicable code; often 50 lb component load | 50 lb component load | Engineering note |
| Linear load | Often exception for one/two-family dwellings | 50 plf may apply | Engineering note |

---

## 4. Residential Stair Requirements — FBC Residential / IRC-style Rules

### 4.1 Stair width

Typical residential stairways must be **not less than 36 inches clear width** above permitted handrail height and below required headroom.

Common clearance logic:
- Handrails may project up to **4 1/2 inches** on either side.
- Minimum clear width at/below handrail height:
  - **31 1/2 inches** where a handrail is installed on one side.
  - **27 inches** where handrails are installed on both sides.

**StairForge validation:**
```text
if stair_width < 36 in:
  error: "Residential stair width is below typical 36 in minimum."
if clear_width_after_handrails < 31.5 in and one_handrail:
  error: "Clear width with one handrail should be at least 31.5 in."
if clear_width_after_handrails < 27 in and two_handrails:
  error: "Clear width with two handrails should be at least 27 in."
```

### 4.2 Headroom

Typical minimum stair headroom: **6 ft 8 in** / **80 inches**.

**StairForge validation:**
```text
if headroom < 80 in:
  error: "Headroom below typical 6 ft 8 in minimum."
```

### 4.3 Risers

Typical residential maximum riser height: **7 3/4 inches**.

StairForge should also check uniformity:
- Difference between tallest and shortest riser in a flight should be limited.
- Common target: max variation **3/8 inch**.

**StairForge validation:**
```text
if riser_height > 7.75 in:
  error: "Riser exceeds 7 3/4 in residential maximum."
if riser_variation > 0.375 in:
  error: "Riser variation exceeds 3/8 in."
```

### 4.4 Treads

Typical residential minimum tread depth: **10 inches**, measured horizontally.

**StairForge validation:**
```text
if tread_depth < 10 in:
  error: "Tread depth below 10 in residential minimum."
```

### 4.5 Nosings

Common residential nosing logic:
- Nosing projection often required where tread depth is less than 11 inches.
- Nosing projection commonly **3/4 inch minimum to 1 1/4 inch maximum**.
- Nosing radius / bevel limits apply.

**StairForge validation:**
```text
if tread_depth < 11 in and nosing_projection == 0:
  warning: "Nosing may be required where tread is under 11 in."
if nosing_projection < 0.75 in or nosing_projection > 1.25 in:
  warning: "Nosing projection should typically be 3/4–1 1/4 in."
```

### 4.6 Landings

Typical rule:
- Floor or landing required at top and bottom of each stairway.
- Landing width should not be less than the stairway served.
- Landing depth in direction of travel commonly not less than **36 inches** for residential.

**StairForge validation:**
```text
if no_top_landing or no_bottom_landing:
  warning: "Landing may be required at top and bottom of stairway."
if landing_width < stair_width:
  error: "Landing width should not be less than stair width."
if landing_depth < 36 in:
  warning: "Residential landing depth is commonly at least 36 in."
```

---

## 5. Handrail Requirements

### 5.1 When handrails are required

For residential stairs, a handrail is typically required on at least one side of each continuous run of treads or flight with **four or more risers**.

For commercial/egress stairs, handrail requirements are stricter and depend on means-of-egress rules.

**StairForge validation:**
```text
if riser_count >= 4 and no_handrail:
  error: "Handrail required for flights with 4 or more risers."
```

### 5.2 Handrail height

Handrail height must generally be between **34 inches and 38 inches**, measured vertically from the sloped plane adjoining tread nosings to the top of the handrail.

**StairForge validation:**
```text
if handrail_height < 34 in:
  error: "Handrail below 34 in minimum."
if handrail_height > 38 in:
  error: "Handrail above 38 in maximum."
```

### 5.3 Handrail continuity

Handrails should be continuous for the full length of the flight from a point directly above the top riser to a point directly above the bottom riser. Ends should return to a wall, guard, walking surface, post, or safety terminal.

**StairForge validation:**
```text
if handrail_not_continuous:
  warning: "Handrail should be continuous for full flight."
if handrail_end_open:
  warning: "Handrail ends should return or terminate safely."
```

### 5.4 Wall clearance

Handrail next to wall typically requires at least **1 1/2 inches** clearance between wall and handrail.

**StairForge validation:**
```text
if wall_clearance < 1.5 in:
  error: "Handrail wall clearance below 1 1/2 in."
```

### 5.5 Handrail projection

Handrails usually must not project more than **4 1/2 inches** into required stair width on either side.

**StairForge validation:**
```text
if handrail_projection > 4.5 in:
  error: "Handrail projection exceeds 4 1/2 in."
```

### 5.6 Graspability

For code checking, StairForge should include a handrail profile field:
- circular
- square tube
- rectangular
- custom profile

Common circular handrail size:
- **1 1/4 in to 2 in outside diameter**.

**Important for metal fabrication:** a square tube may not automatically satisfy graspability unless it matches allowed Type I/Type II or equivalent graspability requirements. This should be a warning when the user selects common square tube as a handrail.

**StairForge validation:**
```text
if handrail_profile == "square_tube":
  warning: "Verify handrail graspability. Square tube may not satisfy code without approved profile/equivalent graspability."
if circular_diameter < 1.25 in or circular_diameter > 2 in:
  warning: "Circular handrail diameter commonly must be 1 1/4–2 in."
```

---

## 6. Guards / Guardrails

### 6.1 When guards are required

Guards are generally required along open-sided walking surfaces, including stairs, ramps, landings, balconies, porches, decks, mezzanines, and equipment platforms, when the walking surface is more than **30 inches** above the floor or grade below at any point within **36 inches** horizontally to the open side.

**StairForge validation:**
```text
if drop_height > 30 in and no_guard:
  error: "Guard required because drop exceeds 30 in."
```

### 6.2 Residential guard height

Typical FBC Residential guard height:
- **36 inches minimum** at open-sided walking surfaces.
- On open sides of stairs, guards can have specific stair-side measurements.
- Where the top of guard serves as handrail, height must satisfy **34–38 inches** at stair nosings.

**StairForge validation:**
```text
if code_family == "residential" and guard_height < 36 in and location != "stair_slope":
  error: "Residential guard below 36 in minimum."
if guard_top_is_handrail and (guard_height < 34 in or guard_height > 38 in):
  error: "Guard top serving as handrail must be 34–38 in."
```

### 6.3 Commercial / Building Code guard height

Typical FBC Building guard height:
- **42 inches minimum** for required guards.
- Some residential/dwelling exceptions allow **36 inches**.

**StairForge validation:**
```text
if code_family == "building" and guard_height < 42 in:
  error: "Building-code guard below typical 42 in minimum."
```

### 6.4 Opening limitations / baluster spacing

General guard opening rule:
- Openings must not allow a **4-inch sphere** to pass.

Stair-specific exceptions:
- Triangle formed by riser, tread, and bottom rail: must not allow **6-inch sphere**.
- Guards on open side of stairs in residential context: must not allow **4 3/8-inch sphere**.

**Practical fabrication note:**
- Do not design vertical pickets at exactly 4 inches clear if field tolerance, powder coat, welding distortion, or measurement error can push spacing over code.
- Good shop target: **3 7/8 inches max clear opening**, as the user already noted.

**StairForge validation:**
```text
if guard_opening_clear > 4 in:
  error: "Guard opening exceeds 4 in sphere rule."
if stair_open_side_baluster_clear > 4.375 in:
  error: "Stair guard opening exceeds 4 3/8 in stair-side allowance."
if triangle_opening > 6 in:
  error: "Triangular stair opening exceeds 6 in."
if picket_clear_spacing > 3.875 in:
  warning: "Shop target exceeded. Use 3 7/8 in max clear spacing to stay safely under 4 in rule."
```

---

## 7. Commercial / FBC Building Stair Requirements

For commercial, public, and common egress stairs, use the FBC Building / IBC-style rules.

Common baseline values:
- Stair riser: **4 in minimum to 7 in maximum**.
- Tread depth: **11 in minimum**.
- Handrail height: **34–38 in**.
- Required guards: **42 in minimum**, except specific occupancy exceptions.
- Guard openings: **4 in sphere**, with specific exceptions.
- Stair width depends on occupant load and egress requirements.

**StairForge validation:**
```text
if code_family == "building":
  if riser_height > 7 in:
    error: "Commercial/egress riser exceeds 7 in maximum."
  if riser_height < 4 in:
    error: "Commercial/egress riser below 4 in minimum."
  if tread_depth < 11 in:
    error: "Commercial/egress tread below 11 in minimum."
  if guard_height < 42 in:
    error: "Commercial/egress guard below 42 in minimum."
```

---

## 8. Structural Loading Requirements for Railings / Guards

### 8.1 Concentrated load

Handrails and guards are generally required to resist a **200 lb concentrated load**.

**StairForge validation:**
```text
engineering_note: "Handrails/guards must be designed for 200 lb concentrated load. Verify post, anchor, weld, and base connection design."
```

### 8.2 Linear load

For many non-residential guards/handrails, **50 pounds per linear foot (plf)** may apply. Some one- and two-family dwelling cases may have exceptions.

**StairForge validation:**
```text
if code_family == "building":
  engineering_note: "Check 50 plf linear load requirement for guards/handrails."
```

### 8.3 Infill component load

Balusters, panel fillers, and guard infill components commonly must resist **50 lb concentrated load**.

**StairForge validation:**
```text
engineering_note: "Balusters/infill components commonly require 50 lb component load check."
```

### 8.4 Post spacing is not only a code-spacing issue

Code often does not simply say “posts must be every 4 feet” for every case. Post spacing depends on:
- guard/handrail loads,
- post section,
- wall thickness,
- base plate,
- anchors,
- substrate,
- welds,
- corrosion,
- local approval.

**Practical fabrication rule for MVP:**
- Default post spacing: **48 inches max center-to-center**.
- Warn above 48 inches.
- For conservative field fabrication, target **42–48 inches** unless engineered.

**StairForge validation:**
```text
if post_spacing > 48 in:
  warning: "Post spacing exceeds 48 in shop default. Engineering/load check recommended."
```

---

## 9. Plates, Anchors, and Connection Checks

StairForge should not pretend to engineer connections automatically in MVP. It should collect the data and warn the user.

### 9.1 Base plate fields

Each plate should track:
```text
plate_width
plate_length
plate_thickness
hole_count
hole_diameter
hole_edge_distance
anchor_type
anchor_diameter
substrate: concrete / wood / steel / masonry
```

### 9.2 MVP warnings

```text
if hole_edge_distance < 1.5 * hole_diameter:
  warning: "Hole edge distance may be too small. Verify anchor/manufacturer requirements."
if plate_thickness < 0.25 in for guard posts:
  warning: "Plate thickness under 1/4 in may be too light for railing posts. Verify engineering."
if anchor_type == "unknown":
  warning: "Anchor type not selected. Verify permitted anchor and substrate."
```

### 9.3 Florida field note

For exterior Florida work, corrosion resistance and coastal exposure matter:
- galvanized steel,
- stainless anchors,
- aluminum compatibility,
- powder coating,
- isolation between dissimilar metals,
- concrete edge distance,
- HVHZ/wind exposure where applicable.

---

## 10. Ramps — Basic Rules to Add Later

Ramps are not the first StairForge MVP, but the app should reserve a code module.

Common residential ramp rules:
- Slope for required egress ramp often **1:12 max**.
- Other ramps may allow **1:8 max** where technically infeasible.
- Handrails required on ramps over certain slope/rise conditions.
- Ramp handrail height: **34–38 inches**.
- Landings at top, bottom, doors, and changes in direction.
- Landing width commonly at least **36 inches**.

**StairForge future validation:**
```text
if ramp_slope > 1/12 and required_egress:
  error: "Ramp slope exceeds 1:12 for required egress."
if ramp_handrail_height < 34 or ramp_handrail_height > 38:
  error: "Ramp handrail height must be 34–38 in."
```

---

## 11. Accessibility / ADA / FBC Accessibility Notes

For public/commercial projects, accessibility requirements may apply in addition to FBC Building:
- accessible route,
- ramp slope/landings,
- handrail extensions,
- graspability,
- walking surface requirements,
- detectable warnings in some contexts,
- clear widths and turning spaces.

**StairForge MVP rule:**
```text
if project_type == "commercial" or "public":
  warning: "Accessibility requirements may apply. Verify FBC Accessibility and ADA before fabrication."
```

---

## 12. Local Florida / Permit Notes

### 12.1 Local amendments

Florida has a statewide building code, but cities/counties can have local administrative procedures and some amendments. Always verify:
- city/county building department,
- permit application requirements,
- product approvals,
- inspection requirements,
- engineer letter requirements,
- owner-builder limitations,
- condominium/HOA requirements.

### 12.2 Miami-Dade / Broward / coastal

For South Florida:
- Miami-Dade / Broward may require more detailed permit packages.
- HVHZ and wind-exposure requirements may affect exterior rails, guards, screens, glass, anchors, and attachments.
- Product approval or engineering may be needed for certain systems.

**StairForge future setting:**
```text
jurisdiction:
  - Florida general
  - Miami-Dade
  - Broward
  - Palm Beach
  - Other
```

---

## 13. Validation Rules to Implement in StairForge

### 13.1 MVP validation constants

```js
export const FLORIDA_CODE_CONSTANTS = {
  effectiveCode: "Florida Building Code 8th Edition (2023)",
  effectiveDate: "2023-12-31",

  residential: {
    stairMinWidthIn: 36,
    minClearWidthOneHandrailIn: 31.5,
    minClearWidthTwoHandrailsIn: 27,
    minHeadroomIn: 80,
    maxRiserIn: 7.75,
    minTreadIn: 10,
    maxRiserVariationIn: 0.375,
    handrailRequiredRisers: 4,
    handrailMinHeightIn: 34,
    handrailMaxHeightIn: 38,
    guardRequiredDropIn: 30,
    guardMinHeightIn: 36,
    stairGuardMinHeightIn: 34,
    guardOpeningSphereIn: 4,
    stairGuardOpeningSphereIn: 4.375,
    triangleOpeningSphereIn: 6,
    recommendedPicketClearMaxIn: 3.875,
    handrailWallClearanceMinIn: 1.5,
    handrailProjectionMaxIn: 4.5,
    defaultPostSpacingMaxIn: 48
  },

  building: {
    minRiserIn: 4,
    maxRiserIn: 7,
    minTreadIn: 11,
    handrailMinHeightIn: 34,
    handrailMaxHeightIn: 38,
    guardRequiredDropIn: 30,
    guardMinHeightIn: 42,
    guardOpeningSphereIn: 4,
    triangleOpeningSphereIn: 6,
    concentratedLoadLb: 200,
    linearLoadPlf: 50,
    infillComponentLoadLb: 50,
    defaultPostSpacingMaxIn: 48
  }
};
```

### 13.2 MVP error list

```text
ERROR: Handrail height below 34 in.
ERROR: Handrail height above 38 in.
ERROR: Guard required but missing.
ERROR: Guard height below selected-code minimum.
ERROR: Guard opening exceeds 4 in.
ERROR: Stair-side guard opening exceeds 4 3/8 in.
ERROR: Triangle opening exceeds 6 in.
ERROR: Residential riser exceeds 7 3/4 in.
ERROR: Residential tread below 10 in.
ERROR: Commercial riser exceeds 7 in.
ERROR: Commercial tread below 11 in.
ERROR: Headroom below 80 in.
```

### 13.3 MVP warning list

```text
WARNING: Picket spacing above 3 7/8 in shop target.
WARNING: Post spacing above 48 in.
WARNING: Square tube handrail may not meet graspability rules.
WARNING: Local jurisdiction may require permit/engineering.
WARNING: Exterior/coastal installation may require corrosion/wind/anchor review.
WARNING: App does not verify structural adequacy of tubes, welds, anchors, or plates.
```

---

## 14. StairForge PDF Disclaimer Text

Add this to every PDF:

```text
CODE / ENGINEERING DISCLAIMER:
This drawing is a fabrication-assist document generated from user-entered dimensions. Verify all field measurements, site conditions, current Florida Building Code requirements, local amendments, permit requirements, structural loads, anchors, welds, materials, and accessibility requirements before fabrication or installation. This document is not a substitute for approved permit drawings or a licensed engineer/architect review where required.
```

---

## 15. Recommended MVP UI Code Fields

### Project settings

```text
project_name
client_name
project_address
jurisdiction
project_type: residential / commercial / exterior_deck / custom
code_family: residential / building
units: imperial / metric
```

### Stair fields

```text
total_height_in
total_run_in
stair_width_in
step_count
riser_height_in
tread_depth_in
nosing_projection_in
headroom_in
landing_top: yes/no
landing_bottom: yes/no
```

### Railing / guard fields

```text
railing_enabled
guard_required
guard_height_in
handrail_height_in
handrail_profile
handrail_diameter_in
wall_clearance_in
handrail_projection_in
post_spacing_in
picket_clear_spacing_in
triangle_opening_in
```

### Structural note fields

```text
post_profile
plate_size
plate_thickness
anchor_type
anchor_diameter
substrate
engineer_review_required
```

---

## 16. What Not to Automate Yet

Do **not** let the MVP claim:
- structural safety,
- load capacity,
- permit approval,
- code approval,
- engineer approval,
- ADA approval,
- Miami-Dade approval,
- product approval.

The app can flag issues and generate a fabrication draft, but not certify.

---

## 17. Development Tasks for StairForge

### Phase 1 — Code checklist inside UI

- Add project type selector.
- Add code family selector: Residential / Building.
- Add code warnings panel.
- Add PDF disclaimer.
- Add default safe picket spacing: 3 7/8 in.
- Add default post spacing: 48 in max.

### Phase 2 — Strong validation

- Validate handrail height 34–38.
- Validate guard height.
- Validate openings.
- Validate riser/tread by code family.
- Validate width/headroom.
- Validate missing guard where drop > 30 in.

### Phase 3 — Permit-ready notes

- Add jurisdiction field.
- Add “requires engineer review” flag.
- Add “exterior/coastal” corrosion/wind note.
- Add material/anchor note.
- Add revision/date block to PDF.

---

## 18. Short Field Cheat Sheet

```text
Handrail height: 34–38 in
Residential guard height: 36 in min
Commercial guard height: 42 in min
Guard required: drop > 30 in
General guard opening: max 4 in sphere
Stair-side guard opening: max 4 3/8 in sphere
Safe shop picket target: max 3 7/8 in clear
Triangle opening at stair bottom rail: max 6 in sphere
Residential stair width: 36 in min
Residential max riser: 7 3/4 in
Residential min tread: 10 in
Commercial max riser: 7 in
Commercial min tread: 11 in
Handrail required residential: 4+ risers
Headroom: 6 ft 8 in / 80 in
Handrail wall clearance: 1 1/2 in min
Handrail projection: 4 1/2 in max
Guard/handrail concentrated load: 200 lb
Commercial/non-residential linear load: check 50 plf
Default post spacing target: 48 in max, verify engineering
```

---

## 19. Update Policy for This File

Review/update this file when:
- Florida adopts a new FBC edition,
- local jurisdiction requires amendments,
- StairForge adds commercial mode,
- StairForge adds ramps,
- StairForge adds glass railing,
- StairForge adds engineered connection design,
- user starts doing permit packages.

Last prepared: 2026-05-29.
