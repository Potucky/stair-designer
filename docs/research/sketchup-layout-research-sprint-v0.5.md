# SketchUp + LayOut 2026 Research Sprint — Master File v0.5

**Project:** Stair Designer / StairForge  
**Research focus:** SketchUp 2026 + LayOut 2026 as reference products for stair, railing, handrail, measurement, cut-list, and PDF workflows.  
**Session date:** May 30–31, 2026  
**Platform tested:** macOS  
**Primary decision:** Use SketchUp/LayOut as research only. Stair Designer must remain one simple focused app.

---

## 0. Executive decision

The research sprint is complete. SketchUp 2026 and LayOut 2026 are powerful professional tools, but they are too broad, manual, menu-heavy, and fragmented for the target workflow.

Stair Designer should **not** become a general CAD platform, SketchUp clone, LayOut clone, or all-in-one architecture suite.

Stair Designer should be a narrow fabrication-focused tool for:

- stairs;
- railings;
- handrails;
- posts;
- plates;
- holes;
- measurements;
- material / cut list;
- fast high-quality PDF output;
- optional project save / restore.

The core workflow must remain:

```text
measure → enter dimensions → generate stair/railing → verify → export PDF
```

Everything outside that workflow is secondary or out of scope.

---

## 1. Core product principle for Stair Designer

```md
## Core Product Principle

Stair Designer must stay simple, focused, and practical.

We are not building:
- full CAD software;
- full SketchUp replacement;
- universal 3D modeling platform;
- complex architectural suite;
- plugin marketplace;
- heavy all-in-one design monster;
- separate LayOut-style documentation app.

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
measure → enter dimensions → generate stair/railing → verify → export PDF.

Every feature must support this workflow directly.
If a feature does not help stairs, railings, measurements, cut list, or PDF, it goes later or does not go in.
```

Development constraint:

```md
Keep changes surgical and focused.
Do not overbuild.
Do not turn Stair Designer into SketchUp, AutoCAD, or LayOut.
Do not add broad CAD features unless they directly support stair/railing fabrication.

Priority:
1. Simplicity
2. Speed
3. Clear dimensions
4. Reliable calculations
5. Printable PDF
6. Material/cut list
7. Easy field workflow
```

---

## 2. What the research proved

### 2.1 SketchUp proves what is possible

SketchUp is powerful for general 3D modeling. It has tools for drawing, push-pull modeling, components, tags, materials, groups, dimensions, text, solid tools, sandbox terrain, sections, styles, AI, 3D Warehouse, extensions, Trimble Connect, and LayOut handoff.

But for stair/railing fabrication it is too manual:

- units are not always obvious;
- dimensions are not always visible;
- tools are spread across top toolbar, left toolbar, menus, panels, and shortcuts;
- users must understand raw geometry instead of stair-specific objects;
- material/cut list requires plugins or separate setup;
- railing/handrail construction is manual;
- PDF output requires LayOut and additional steps.

### 2.2 LayOut proves what final PDF output can look like

LayOut is strong for professional AEC documentation. It has pages, layers, scales, dimension styles, SketchUp model viewports, typography, tables, patterns, scrapbooks, warning symbols, and PDF export.

But Stair Designer should not copy the LayOut workflow.

LayOut is a reference for output quality only.

### 2.3 Builder / Profile Builder / Extension Warehouse prove market demand

The sprint found strong market validation for:

- parametric profiles;
- assemblies;
- holes;
- tube/profile workflows;
- cut lists;
- material calculations;
- nesting;
- cost calculation;
- builder-style automation.

This proves the demand for automation. But Stair Designer must build its own implementation and must not copy plugin code, branding, or proprietary UI.

---

## 3. The target Stair Designer workflow

```text
1. User measures space / stair opening.
2. User enters dimensions in one visible right panel.
3. User picks stair type: straight / L / U.
4. App generates stair geometry.
5. User adds railing / handrail / posts / plates.
6. Dimensions are visible directly in 3D and 2D views.
7. User rotates 3D view while dimensions remain visible.
8. App calculates material / cut list automatically.
9. User clicks Export PDF.
10. App generates a fabrication-ready PDF automatically.
11. User saves project file or prints/sends PDF.
```

No separate LayOut app. No manual scale setup. No hidden unit menus. No plugin dependency for core workflow.

---

## 4. Required Stair Designer outputs

### Required for MVP

- Project save / restore file.
- High-quality PDF export.
- Side view.
- Top view.
- 3D preview.
- Always-visible dimensions.
- Material / cut list.
- Notes / fabrication notes.
- Simple title block.

### Optional later

- JPEG / PNG screenshot export.
- DXF/DWG export only if fabrication partners require it later.
- AI assistant only after deterministic calculations are stable.

### Not MVP

- DWG/IFC/OBJ/STL export.
- Plugin marketplace.
- General CAD tools.
- Separate documentation app.
- Cloud requirement for PDF sharing.
- AI credits as core workflow.

---

## 5. PDF principle

Stair Designer should not follow this workflow:

```text
SketchUp → Send to LayOut → set scale → set units → place dimensions → fix render mode → export PDF
```

Stair Designer should follow this workflow:

```text
Stair Designer → Export PDF
```

The app should automatically create:

- project title;
- date;
- customer / job name if available;
- side view;
- top view;
- 3D preview;
- total rise;
- total run;
- stair width;
- tread depth;
- riser height;
- stair angle;
- handrail height;
- railing side;
- post spacing;
- plate dimensions;
- hole spacing;
- material / cut list;
- warnings if something is missing.

---

## 6. Always-visible dimension principle

Dimensions must not be hidden behind a separate dimension tool.

In Stair Designer, the user should always see key dimensions in the workspace:

- total rise;
- total run;
- stair width;
- step count;
- tread depth;
- riser height;
- stair angle;
- landing size;
- railing side;
- handrail height;
- post spacing;
- tube/profile size;
- plate size;
- hole spacing.

Dimensions should remain visible even while rotating the 3D view.

The right panel should also show all primary values in editable form.

---

## 7. Units principle

SketchUp/LayOut showed that unit control can become confusing when units are buried in Model Info or Document Setup.

Stair Designer must keep units visible and simple:

```text
Units: inches / millimeters
```

This control should be in the main UI, not hidden in preferences.

When units change:

- labels update immediately;
- input fields update immediately;
- PDF output updates immediately;
- cut list updates immediately;
- no old metric/imperial labels remain stuck on screen.

---

## 8. UI principles borrowed from SketchUp, simplified

Borrow:

- compact tool panels;
- grouped tool buttons;
- clear icon blocks;
- draggable/pinnable panels as inspiration;
- right inspector/sidebar;
- simple top status/header;
- visible model preview;
- clean page layout from LayOut PDF.

Do not copy:

- exact SketchUp icons;
- exact LayOut icons;
- SketchUp/LayOut branding;
- deep nested menus;
- hidden unit settings;
- triple paths to the same command;
- plugin-heavy architecture;
- cloud requirement;
- separate documentation workflow.

---

## 9. SketchUp 2026 Part 1 findings — AI, cloud, preferences, graphics

### Observed

- SketchUp 2026 has top toolbar, left vertical tool palette, right-side panels, and floating panels.
- SketchUp AI appears as a first-class visible panel/icon.
- AI Assistant: talk to SketchUp, get help, generate objects.
- AI Render: render an image of the model with AI.
- Credits shown as 50/50.
- Share requires saving to Trimble Connect cloud first.
- Preferences include Accessibility, Applications, Compatibility, Drawing, Files, General, Graphics, Shortcuts, Template, Workspace.
- Graphics include new graphics engine, classic graphics engine fallback, anti-aliasing, fast feedback, maximum texture size, and automatic material enhancement.
- Files are split between user documents and SketchUp application support folders.
- Auto-save and backup are enabled by default.

### Interpretation for Stair Designer

- AI can be optional later, not MVP.
- Cloud save/share should not be required for local PDF export.
- Settings should be shallow and visible.
- Backup/checkpoints are important.
- Graphics should prioritize clarity over photorealism.
- Materials should be fabrication-friendly, not render-first.

---

## 10. SketchUp 2026 Part 2 findings — main menus and architecture

### Observed menus

SketchUp main menus include:

- File;
- Edit;
- View;
- Draw;
- Camera;
- Tools;
- Window;
- Extensions;
- Help.

### Important features observed

- Trimble Connect is deeply embedded in File operations.
- Send to LayOut is part of the workflow.
- 3D Warehouse is integrated.
- Start PreDesign and Add Location are available.
- Generate Report exists.
- Edit menu includes Purge Unused Assets, Make Component, Make Group, Intersect Faces, Trimble Creator.
- View menu includes Section Planes, Section Cuts, Section Fill, Axes, Guides, Comments, Shadows, Fog, True North, Location Pin.
- Draw menu includes Lines, Arcs, Shapes, Sandbox.
- Camera menu includes Standard Views, Parallel Projection, Perspective, Two-Point Perspective, Match Photo, Orbit, Pan, Zoom, Position Camera, Walk, Look Around, Field of View.
- Tools menu includes Select, Lasso, Eraser, Paint Bucket, Tag, Move, Rotate, Scale, Flip, Push/Pull, Follow Me, Offset, Solid Tools, Tape Measure, Protractor, Axes, Dimensions, Text, 3D Text, Section Plane, Interact, Sandbox.
- Solid Tools include Union, Subtract, Trim, Intersect, Split.
- Window menu includes Model Info, Entity Info, Materials, Components, Styles, Environments, Tags, Outliner, Scenes, Shadows, Fog, Match Photo, Soften Edges, Instructor, Overlays, 3D Warehouse, Collaboration Bar.
- Extensions menu includes Extension Warehouse, Extension Manager, Migrate Extensions, Developer, Analysis Hub, AI Assistant, AI Render, Profile Builder 4.

### Interpretation for Stair Designer

SketchUp is a broad modeling platform. Stair Designer should not replicate this menu architecture.

Stair Designer should keep visible shallow controls:

- project;
- units;
- stair type;
- dimensions;
- railing;
- material;
- PDF export;
- save project.

---

## 11. LayOut 2026 Part 3 findings — preferences, scales, shortcuts

### Observed

LayOut is a separate documentation/publishing companion to SketchUp.

Preferences include:

- Applications;
- Backup;
- Folders;
- General;
- Performance;
- Presentation;
- Scales;
- Shortcuts;
- Startup.

LayOut has a full professional scale system:

- architectural imperial scales;
- metric scales;
- engineering/site scales;
- full size 1:1.

LayOut includes:

- Pages;
- Layers;
- Scaled Drawing;
- Pattern Fill;
- Shape Style;
- SketchUp Model panel;
- Dimension Style;
- Scrapbooks;
- Tables;
- Presentation mode;
- Warning Symbols;
- Auto-Text;
- professional typography;
- Apple Intelligence writing tools;
- CAD-like drawing tools such as Fillet, Chamfer, Trim, Extend, Offset.

### Interpretation for Stair Designer

LayOut is powerful but too heavy.

Borrow from LayOut:

- clean sheet layout;
- title block;
- side/top/3D views;
- dimensions;
- material table;
- warning checks;
- export PDF.

Do not copy:

- full publishing system;
- scrapbooks;
- multi-page professional document management;
- complex scale database;
- typography system;
- manual viewport setup.

---

## 12. LayOut 2026 Part 4 findings — main menus and first PDF export

### Observed

The sprint verified end-to-end:

```text
SketchUp model → LayOut page → PDF export
```

The exported PDF proved that high-quality fabrication/document output is valuable.

LayOut main menus include:

- File: New, Open, Save, Save As Template, Save As Scrapbook, Insert, Export, Document Setup, Page Setup, Print.
- Edit: Copy/Paste, Duplicate, Group/Ungroup, Clipping Mask, Writing Tools, Spelling, Dictation.
- View: Grid, Warning Symbols, Draft Mode, Render Models, Zoom, Presentation.
- Text: Bold, Italic, Underline, Align, Auto-Text, Find, Kern, Ligature, Baseline, Lists, Rulers.
- Arrange: Bring to Front, Align, Space, Center, Flip, Object Snap, Grid Snap.
- Tools: Select, Erase, Style, Split, Join, Lines, Arcs, Fillet/Chamfer, Trim/Extend, Rectangles, Circles, Polygon, Offset, Move, Rotate, Scale, Text, Label, Dimensions, Table.
- Pages: Add, Duplicate, Delete, Previous, Next.
- Window: Shape Style, Scaled Drawing, Pattern Fill, SketchUp Model, Dimension Style, Pages, Layers, Scrapbooks, Instructor, Colors, Fonts.
- Help: Welcome, Help Center, Contact, Sign Out.

### Interpretation for Stair Designer

LayOut proves what the output should look like.
LayOut also proves what Stair Designer must avoid.

Stair Designer should generate its sheet automatically inside the same app.

---

## 13. Extension Warehouse / 3D Warehouse legal and product interpretation

### 3D Warehouse

Use as research/reference only.

Do not:

- copy models as standalone assets;
- claim ownership of downloaded models;
- create a competing model warehouse;
- ship third-party models as product assets without clear permission.

### Extension Warehouse

Use as market research only.

Do not:

- copy plugin code;
- copy branding;
- copy proprietary UI;
- depend on paid plugins for the core app;
- rebuild a plugin marketplace for MVP.

### Product interpretation

Builder/Profile Builder/Cut-list plugins prove that people pay for automation. Stair Designer should implement the narrow automation itself:

- stair generator;
- railing generator;
- post spacing;
- handrail length;
- plate/hole calculations;
- material/cut list;
- direct PDF.

---

## 14. MVP requirements derived from research

### 14.1 Core UI

- One main workspace.
- One right-side dimension/control panel.
- Compact left tool block only for essential actions.
- Header with project name, units, save/export.
- No deep menu dependency.
- Desktop layout should fit mostly on one visible screen.

### 14.2 Stair generator

- Straight stair first.
- L stair later.
- U stair later.
- Inputs:
  - total rise;
  - total run;
  - width;
  - number of steps;
  - tread depth;
  - riser height;
  - landing dimensions;
  - nosing optional later.
- Calculated:
  - stair angle;
  - valid/invalid warnings;
  - consistent units.

### 14.3 Railing / handrail generator

- Rail side: left / right / both.
- Handrail height.
- Tube/profile size.
- Post spacing.
- Top rail length.
- Posts count.
- Plate dimensions.
- Hole count and spacing.

### 14.4 Materials / cut list

- Tubes/profiles.
- Posts.
- Plates.
- Handrails.
- Approximate lengths.
- Quantity table.
- Notes.

### 14.5 PDF output

- High-quality vector-style PDF where possible.
- Auto sheet layout.
- Side view.
- Top view.
- 3D preview.
- Dimensions.
- Material table.
- Title block.
- Notes.
- Warnings.

### 14.6 Project save

- Save project locally.
- Restore project.
- Do not require cloud for core workflow.

---

## 15. Explicit non-goals

Stair Designer MVP will not include:

- full CAD menu system;
- SketchUp-style universal modeling;
- LayOut-style publishing suite;
- manual scale database;
- photorealistic render pipeline;
- AI generation as primary geometry engine;
- 3D Warehouse clone;
- Extension Warehouse clone;
- real-time collaboration;
- BIM system;
- full architectural documentation suite.

---

## 16. Development roadmap after this research

### Phase 1 — Documentation / checkpoint

1. Save this file into the project:

```text
docs/research/sketchup-layout-research-sprint-v0.5.md
```

2. Commit and tag checkpoint:

```text
git add docs/research/sketchup-layout-research-sprint-v0.5.md
git commit -m "docs: add SketchUp LayOut research sprint v0.5"
git tag checkpoint-sketchup-layout-research-v0.5
```

### Phase 2 — Requirements extraction

Create a second short file:

```text
docs/product/stair-designer-mvp-requirements-v0.1.md
```

This file should be shorter and used directly by developers/Codex/Claude Code.

### Phase 3 — UI implementation prompt

Make one focused implementation prompt:

- add units switch;
- ensure right panel always visible;
- add always-visible dimension labels;
- add direct PDF export placeholder or first PDF implementation;
- add material/cut-list section;
- no big refactor.

### Phase 4 — Audit

After Claude Code/Codex modifies the project, run audit:

- changed files;
- UI behavior;
- PDF output;
- units behavior;
- no overengineering;
- checkpoint created.

---

## 17. Prompt rules for future development

Every future development prompt for Stair Designer should include:

```md
## Safety / Product Scope

Do not turn Stair Designer into SketchUp, AutoCAD, or LayOut.
Do not add broad CAD complexity.
Do not add a separate documentation app.
Keep this one focused app for stairs, railings, handrails, dimensions, material/cut list, and PDF output.
Use this research file as reference:
`docs/research/sketchup-layout-research-sprint-v0.5.md`

Make surgical changes only.
Create a Git checkpoint before and after changes.
```

---

## 18. Final research conclusion

SketchUp and LayOut are excellent professional reference products, but their complexity confirms the need for Stair Designer.

The winning strategy is not to copy their full functionality. The winning strategy is to remove 90% of the complexity and keep the 10% that matters for stair/railing fabrication.

```text
SketchUp showed the modeling power.
LayOut showed the PDF output quality.
Builder/Profile Builder showed market demand.
Stair Designer should deliver the narrow workflow faster, simpler, and in one app.
```

