# Stair Designer — MVP Requirements v0.1

## 1. Core Product Principle

Stair Designer must stay simple, focused, and practical.

We are not building:
- a full CAD system;
- a SketchUp replacement;
- a LayOut replacement;
- a universal 3D modeling platform;
- a plugin marketplace;
- a heavy all-in-one architectural suite.

We are building a narrow fabrication-focused tool for:
- stairs;
- railings;
- handrails;
- posts;
- plates;
- holes;
- measurements;
- material/cut list;
- fast printable PDF.

Main workflow:

```text
measure → enter dimensions → generate stair/railing → verify → export PDF
```

Every feature must directly support stair/railing fabrication, measurement, cut list, or PDF output.

---

## 2. One-App Architecture

Stair Designer is one app.

No separate LayOut-style companion program.
No manual documentation setup.
No hidden scale/document menus.
No separate publishing workflow.

The app must allow the user to:
1. Build or generate the stair/railing.
2. See dimensions directly in the workspace.
3. Rotate the 3D model with dimensions still visible.
4. Save the project.
5. Export a high-quality PDF immediately.
6. Print or send the PDF to fabricators.

Required outputs:
- Project file.
- High-quality PDF.

Optional later:
- JPEG/PNG screenshot export.

Not MVP:
- DWG.
- IFC.
- OBJ.
- STL.
- Plugin system.
- Cloud collaboration.
- AI credits workflow.

---

## 3. Units and Measurement

Units must be always visible and easy to change.

Required:
- Global units switch: inches / millimeters.
- Unit switch must be available in the main UI, not hidden in preferences.
- Changing units must update all inputs, labels, dimensions, cut list, and PDF output.
- No separate SketchUp-style and LayOut-style unit systems.
- No hidden document setup just to change dimensions.

Recommended visible controls:
- Units: inches / mm.
- Precision: simple presets only.
- Show/hide dimensions toggle.
- Dimension style: compact / detailed.

---

## 4. Main Workspace

The workspace should be simple and compact.

Required layout:
- Left: compact tool blocks or stair/railing presets.
- Center: 3D/2D model viewport.
- Right: always-visible parameter inspector.
- Top/header: project name, units, save, export PDF.

Avoid:
- deep nested menus;
- too many duplicate tool paths;
- universal modeling tools;
- floating chaos;
- SketchUp/LayOut-level preference screens.

Useful reference from SketchUp:
- compact tool palettes;
- grouped square buttons;
- right-side inspector;
- detachable/pinnable panels later if useful.

Do not copy:
- SketchUp icons;
- SketchUp/LayOut menu structure;
- SketchUp/LayOut branding;
- tool names/UI layouts too closely.

---

## 5. Stair Generator

Required stair parameters:
- Stair type: straight first; L and U later.
- Total rise.
- Total run.
- Stair width.
- Number of steps.
- Riser height.
- Tread depth.
- Stair angle.
- Landing/platform support later.
- Stringer/side profile later.

The app should calculate:
- riser height;
- tread depth;
- stair angle;
- total geometry;
- warnings for unreasonable dimensions.

The user should be able to change values quickly and see the stair update immediately.

---

## 6. Railing / Handrail Generator

Required railing parameters:
- Rail side: left / right / both / none.
- Handrail height.
- Tube/profile size.
- Post spacing.
- Start post / end post.
- Intermediate posts.
- Basic top rail.
- Optional lower rail later.
- Plates and holes later, but planned.

Required visibility:
- handrail height dimension;
- post spacing dimension;
- rail side;
- stair angle;
- total run/rise context.

---

## 7. Always-Visible Dimensions

Dimensions are core, not an afterthought.

Required dimensions in viewport:
- total rise;
- total run;
- stair width;
- riser height;
- tread depth;
- stair angle;
- handrail height;
- post spacing;
- plate size and hole spacing when plates exist.

Dimensions must remain visible while rotating the 3D view.

The user should not need to manually place dimensions like in LayOut.

Optional controls:
- Show all dimensions.
- Show fabrication dimensions only.
- Hide dimensions.
- Export dimensions to PDF automatically.

---

## 8. Material / Cut List

The cut list must be built into the app.

Required first version:
- item name;
- profile/tube size;
- quantity;
- length;
- angle/cut note when available;
- material note;
- total estimated length.

Examples:
- posts;
- top rail;
- handrail;
- stair frame members;
- plates later;
- pickets/balusters later.

Do not depend on external plugins for cut list.

---

## 9. PDF Export

PDF export must be direct from Stair Designer.

Required:
- one-click Export PDF;
- high-quality vector-style output where possible;
- automatic sheet layout;
- automatic dimensions;
- automatic material/cut list;
- title block;
- notes;
- date/project name;
- units shown clearly.

Default PDF page should include:
1. Project title/date.
2. Side view.
3. Top view.
4. 3D preview.
5. Main stair dimensions.
6. Railing/handrail dimensions.
7. Post spacing.
8. Plate/hole notes when relevant.
9. Material/cut list.
10. Warnings if something is missing.

Do not copy LayOut workflow:
- no Send to LayOut;
- no manual scale setup;
- no manual dimension placement;
- no separate document setup;
- no separate publishing app.

LayOut is a reference for PDF quality only, not app architecture.

---

## 10. Save / Restore / Checkpoints

The app should support:
- save project;
- open project;
- export PDF from saved project;
- basic project metadata.

Development workflow must include restore points:
- commit before major changes;
- commit after successful changes;
- tag important checkpoints;
- do not make broad refactors without need.

Recommended Git workflow:
```bash
git status
git add .
git commit -m "checkpoint: before stair designer MVP changes"
git tag checkpoint-before-stair-designer-mvp
```

---

## 11. AI Position

AI is not MVP core.

Possible later AI features:
- explain dimension problems;
- suggest number of steps;
- suggest post spacing;
- generate a draft stair from a text prompt;
- help write PDF notes.

But calculations must be deterministic, exact, and inspectable.

Rule:
```text
AI can assist, but AI must not guess fabrication dimensions.
```

---

## 12. Development Constraints

Keep changes surgical and focused.

Do not:
- rewrite the whole app;
- overbuild;
- add unrelated CAD features;
- add cloud dependency for PDF;
- add plugin marketplace;
- add AI as required workflow;
- copy SketchUp/LayOut UI or icons.

Priority order:
1. Simplicity.
2. Speed.
3. Clear dimensions.
4. Reliable calculations.
5. Printable PDF.
6. Material/cut list.
7. Easy field workflow.

---

## 13. Reference Documents

Primary research reference:

```text
docs/research/sketchup-layout-research-sprint-v0.5.md
```

This MVP file:

```text
docs/product/stair-designer-mvp-requirements-v0.1.md
```

Future development prompts should explicitly tell Claude Code/Codex to read both files before making product changes.
