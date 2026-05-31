# Stair Designer — Project Line and Current Status

Date: 2026-05-31

## 1. Main product line

Stair Designer is a simple, focused fabrication tool.

We are not building:

- SketchUp clone;
- AutoCAD clone;
- LayOut clone;
- universal CAD system;
- plugin marketplace;
- AI-first design tool;
- cloud-required workflow.

We are building one practical app for:

- stairs;
- railings;
- handrails;
- posts;
- dimensions;
- material / cut list;
- save / open project;
- direct printable PDF for fabrication.

Main workflow:

```text
measure → enter dimensions → generate stair / railing → verify → export PDF
```

The app must stay narrow and useful for real fabrication work. Every feature must help measurement, stair/railing generation, dimensions, cut list, or PDF output.

---

## 2. Current source of truth

The main product direction is now defined by these project docs:

```text
docs/README.md
docs/product/stair-designer-mvp-requirements-v0.1.md
docs/research/sketchup-layout-research-sprint-v0.5.md
README.md
PROJECT_SPEC.md
FLORIDA_CODE_REQUIREMENTS.md
```

Priority order:

1. `docs/product/stair-designer-mvp-requirements-v0.1.md` — current MVP product direction.
2. `docs/research/sketchup-layout-research-sprint-v0.5.md` — SketchUp / LayOut research reference.
3. `PROJECT_SPEC.md`, `README.md`, `FLORIDA_CODE_REQUIREMENTS.md` — existing project context, useful but must not override the new focused MVP direction.

If old docs conflict with the new MVP direction, the final decision is:

```text
Keep Stair Designer simple, one-app, fabrication-focused, and PDF-focused.
```

---

## 3. What was done in this sprint

### 3.1 Added research and MVP documentation

Added project documentation into the repository:

```text
docs/research/sketchup-layout-research-sprint-v0.5.md
docs/product/stair-designer-mvp-requirements-v0.1.md
docs/README.md
```

Commit:

```text
f1b2f76 docs: add SketchUp LayOut research and MVP requirements
```

Checkpoint tag:

```text
checkpoint-docs-sketchup-layout-research-v0.5
```

Result:

- the product direction is now written inside the project;
- future Codex / Cloud Code prompts must read these docs first;
- no app source code was changed in this commit.

---

### 3.2 Full Codex audit completed

Codex audited the current app against the new MVP docs.

Main audit conclusions:

- the app is already a compact React/Vite Stair Designer MVP;
- it has a live 3D stair view, right parameter panel, basic calculations, PDF export, save JSON, material list, and validation warnings;
- it must not expand into a broad CAD app;
- first safe improvement was local Open JSON / restore;
- next larger improvement after save/open stabilization should be global inches/mm units switch.

Important risks identified:

- hardcoded inches in UI/PDF/status;
- no global inches/mm switch;
- no always-visible 3D dimension labels;
- railing logic is partial and can drift between 3D/PDF/material list;
- PDF layout is useful but hardcoded and needs careful surgical improvement only;
- Supabase exists as prototype insert-only and must not become required for core workflow.

---

### 3.3 Added local Open JSON

Implemented local project restore from files created by existing Save JSON.

Changed files:

```text
src/utils/saveJson.js
src/App.jsx
src/components/Header.jsx
```

Commit:

```text
193a1ca feat: add local JSON project open
```

Checkpoint tags:

```text
checkpoint-before-local-json-open-v0.1
checkpoint-local-json-open-v0.1
```

Result:

- header now has Open JSON near Save JSON;
- user can select a local `.json` file;
- app restores project fields and stairConfig fields;
- calculations, warnings, 3D view, cut list, and PDF update through existing React state;
- no Supabase load was added;
- no geometry / PDF / units / railing logic changed.

---

### 3.4 Hardened Open JSON validation

Codex found that hand-edited JSON could inject bad values into supported fields. We added validation.

Changed file:

```text
src/utils/saveJson.js
```

Commit:

```text
e3e730c fix: validate local JSON restore fields
```

Checkpoint tags:

```text
checkpoint-before-open-json-validation-v0.1
checkpoint-open-json-validation-v0.1
```

Validation now checks:

- `height`, `run`, `width`, `handrailHeight`, `pinOpening`, `postSpacing` must be finite numbers;
- `steps` must be a finite positive integer;
- `railingEnabled` must be boolean;
- `tubeSize` must be a non-empty string;
- unknown keys are ignored;
- non-Stair Designer JSON is rejected.

---

### 3.5 Fixed Open JSON default fallback

Codex blocked the first validation fix because invalid/missing fields were falling back to previous in-memory state, creating possible hybrid projects.

We fixed restore behavior to merge loaded fields over canonical defaults.

Changed files:

```text
src/constants/defaults.js
src/App.jsx
```

Commit:

```text
ba5b0b1 fix: restore JSON over default project state
```

Checkpoint tags:

```text
checkpoint-before-open-json-default-restore-v0.1
checkpoint-open-json-default-restore-v0.1
```

Result:

```js
setProject({ ...DEFAULT_PROJECT, ...p })
setStairConfig({ ...DEFAULT_STAIR, ...sc })
```

Now invalid or missing fields fall back to default Stair Designer values, not values from the previously opened project.

---

### 3.6 Fixed step count as integer

Codex found one small follow-up: UI used `parseFloat` for steps, while Open JSON validation requires a positive integer.

Changed file:

```text
src/components/RightPanel.jsx
```

Commit:

```text
8aa41bd fix: keep stair step count as integer
```

Checkpoint tags:

```text
checkpoint-before-steps-integer-input-v0.1
checkpoint-steps-integer-input-v0.1
```

Result:

- `steps` input now stores integers through a dedicated `intNum` helper;
- fractional user input no longer creates saved JSON that conflicts with Open JSON validation;
- no other numeric inputs were changed;
- build passed.

---

## 4. Current project status

Current known good state:

```text
Latest commit: 8aa41bd fix: keep stair step count as integer
Git status after last Cloud Code run: clean
Build after last Cloud Code run: passed
Not pushed to GitHub yet
```

Open JSON / Save JSON line is now stable enough to stop focusing on it.

We do not need to keep spending time on small JSON edge cases unless Codex later finds a real blocker.

---

## 5. What we should NOT do next

Do not jump into:

- full refactor;
- general CAD tools;
- AI;
- cloud load/save as required workflow;
- DWG / IFC / OBJ / STL;
- plugin system;
- SketchUp-style tool chaos;
- separate LayOut-like PDF/documentation app;
- redesigning the whole UI.

Also do not spend too much time polishing minor JSON details now. Save/Open is good enough for the current stage.

---

## 6. Main remaining MVP gaps

The important gaps are:

1. Global inches/mm switch.
2. Always-visible 3D dimension labels.
3. Railing side: left / right / both / none.
4. Railing / material list alignment between 3D, PDF, and cut list.
5. Better direct PDF drawing output.
6. More useful material/cut list with total estimated length and fabrication notes.
7. Validation improvements for railing/post spacing/clearance.
8. Later: plates, holes, pickets/balusters.

---

## 7. Recommended next development line

The next main step should be:

```text
Global inches/mm switch
```

Reason:

- Units are a core MVP requirement.
- Units affect UI, inputs, labels, status bar, cut list, PDF, and saved project data.
- It is better to solve units before adding more dimension labels or expanding PDF output.
- Internal calculations should stay in inches for now; only display/input/output should convert carefully.

Important rule for units:

```text
Keep internal geometry in inches.
Add a global units state.
Convert display/output only.
Do not rewrite geometry formulas.
```

Expected user-visible result:

- visible Units control in the main UI/header;
- user can choose inches or mm;
- right panel labels/results update;
- status bar updates;
- PDF text uses selected units;
- Save JSON stores selected units if needed;
- Open JSON restores units if present, otherwise defaults to inches.

---

## 8. After units, recommended order

After global units switch:

1. Add always-visible lightweight 3D dimension labels.
2. Add rail side: none / left / right / both.
3. Align railing quantities between 3D, cut list, and PDF.
4. Improve PDF drawing page carefully.
5. Improve material/cut list totals and notes.

PDF is important, but units should come first because PDF dimensions must be correct in the selected unit system.

---

## 9. Workflow rule going forward

Use this chain:

```text
ChatGPT → creates focused prompt
Codex → audits / reviews / finds risk
Cloud Code → makes one small change
Codex → reviews that change
ChatGPT → decides next prompt
```

Every Cloud Code prompt must include:

- read docs first;
- check git status;
- stop if dirty;
- create checkpoint tag before changes;
- make one small change only;
- run build;
- show diff;
- commit;
- create checkpoint tag after success;
- do not push unless explicitly asked.

Every Codex prompt must be:

- review-only or audit-only;
- no file changes;
- no commits;
- no push;
- clear verdict: approve / approve with minor follow-ups / block.

---

## 10. Immediate next action

Recommended immediate action:

```text
Ask Cloud Code to implement the global inches/mm switch as one focused task.
```

But before doing that, do not overload the prompt. The first units task should be small:

```text
Phase 1: add global units state and central formatting helpers.
```

Do not attempt to finish every units-related detail in one run if it becomes too large.

Possible first units scope:

- add `units` state in App;
- add visible units toggle in Header;
- create or update formatting helper;
- update RightPanel display labels/results and StatusBar;
- keep internal calculations in inches;
- run build;
- commit/tag.

PDF units can be either included carefully if small, or done as Phase 2 if diff gets too large.

---

## 11. Final decision

The project direction is clear:

```text
Stop polishing minor JSON details.
Save/Open JSON is stable enough.
Next meaningful product step: global inches/mm switch.
Then always-visible dimensions.
Then railing side/material alignment.
Then PDF drawing improvements.
```

This keeps the project aligned with the MVP requirement: simple, focused, fabrication-first, one app, direct PDF, no CAD monster.
