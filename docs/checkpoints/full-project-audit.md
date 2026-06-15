# Stair Designer Full Project Audit

## 1. Executive Summary

Current status: buildable and lint-clean, but parity is incomplete and the app is risky around persistence and output fidelity.

The strongest part of the project is that top rail segment resolution for standard/custom routes is centralized in `src/geometry/railingGeometry.js` and reused by 3D, PDF, and materials. Manual posts, top rails, bottom rails, middle rails, manual dimensions, manual text annotations, JSON export/import, Supabase versioning, and localStorage autosave are all present.

The highest risks are:
- PDF draft annotations are in memory only and are not saved to JSON, Supabase, or localStorage.
- Top/plan manual dimensions and text can be created in the app but are not exported to the main PDF because there is no real top-view PDF page.
- Global railing position offsets affect 3D only, while PDF and material logic stay normalized.
- Supabase schema/RLS documentation conflicts with frontend save/open expectations unless policies were added outside this repo.
- `manualTopRails` duplicate detection still checks old fields only, so endpoint-normalized rails can duplicate.

No application code was changed in this audit.

## 2. Project Architecture Map

- `src/App.jsx`: main application state owner. Holds project metadata, stair config, manual dimensions, manual text annotations, manual posts, manual top rails, localStorage autosave, JSON open/save, Supabase save/open, PDF export, and tool mode coordination.
- `src/components/StairScene.jsx`: Three.js scene, camera/view modes, stair and landing meshes, manual post/rail rendering, dimension/text picking, PDF draft overlay, 3D capture.
- `src/components/RightPanel.jsx`: inspector and business controls for project fields, stair inputs, railing setup, post/rail editing, route controls, material table, PDF options.
- `src/components/Toolbar.jsx`: tool/view selection, dimension visibility/undo, PDF draft mode entry.
- `src/components/OpenProjectModal.jsx`: lists Supabase projects and loads selected project.
- `src/geometry/stairMath.js`: stair calculations and material/cut-list summary.
- `src/geometry/railingGeometry.js`: shared post base/top calculation and rail segment resolution.
- `src/geometry/validation.js`: code-style warnings/errors.
- `src/pdf/generatePdf.js`: multi-page PDF export with side view, project summary, material list, warnings, optional draft pages.
- `src/pdf/printViewport.js`: viewport screenshot PDF via `html2canvas`.
- `src/lib/saveProject.js`, `src/lib/loadProject.js`, `src/lib/supabaseClient.js`: Supabase client and save/open versioning.
- `src/utils/saveJson.js`: browser JSON export/import and schema filtering.
- `docs/`: product requirements, research, checkpoints.
- `supabase/`: schema, RLS notes, manual posts/top rails migration.

No source module or folder named `ZF` was found. Only package-lock integrity hashes matched `ZF`.

## 3. Data Model / Project Schema

Main entities:

- `project`: `{ name, client }`, stored in React state, JSON, Supabase `stair_projects`.
- `stairConfig`: parametric stair/railing config from `DEFAULT_STAIR`: height, run, width, steps, tube size, railing toggles, landings, rail extensions, bottom/middle rail settings.
- `calc`: derived values from `calcStair`: riser height, tread depth, stringer length, tread positions, railing stations, dimension endpoints.
- `manualPosts`: post objects with `id`, `xIn`, `zIn`, offsets, `heightIn`, and either tread placement (`stepIndex`, `mount`, `side`) or landing placement (`surfaceType`).
- `manualTopRails`: rail objects with old `startPostId/endPostId` plus normalized `startEndpoint/endEndpoint`, route fields (`customRouteSegments`, `dogleg*`, `manualSegments`), and profile.
- `manualDimensions`: dimension objects with endpoints `{xIn,yIn,zIn}`, label, measured value, projection.
- `manualTextAnnotations`: text objects with `{xIn,yIn,zIn}`, projection, text.
- `pdfDrafts`: side/3D draft dimensions and text in `App.jsx`, not persisted.
- `materials`: derived list from `buildMaterialList`.
- Supabase: `stair_projects` metadata, `stair_config_versions` jsonb config plus `manual_posts` and `manual_top_rails`.

Relationships:

- Manual rails depend on manual posts by post id. Deleting a post removes connected rails in `handleDeleteManualPost`.
- Bottom and middle rails reuse `manualTopRails` connections.
- Materials, PDF, and 3D all derive top rail segments through `resolveTopRailSegments` for most top rail modes.
- JSON export/import stores the main manual entities top-level.
- Supabase stores dimensions/text inside `stair_config`, and posts/rails in dedicated jsonb columns.

## 4. Geometry Pipeline

`calcStair` in `src/geometry/stairMath.js` converts `stairConfig` into shared inch-based calculated geometry. The 3D scene converts inches to scene units with `INtoU = 0.5`. Stair treads and landing meshes are rendered in `StairScene.jsx`.

Manual post bases are resolved by `getManualPostBase`:
- tread posts use `treadPositions[stepIndex]`;
- bottom landing posts use `TREAD_THICK`;
- top landing posts use the last tread height adjusted by riser height and slab thickness.

Top rail segments are resolved by `resolveTopRailSegments`, then rendered in 3D, drawn in PDF, and counted in materials. Bottom/middle rail helpers use the same rail connectivity but resolve lower endpoint heights separately.

Risk: `structureOffsetXIn/structureOffsetZIn` wraps the manual railing group only in 3D, while PDF/materials/save geometry remain normalized by design. The UI says "PDF stays normalized", but this violates the absolute parity rule if users expect moved railings to export exactly.

## 5. Railing/Post Pipeline

Manual posts are added from clicks on treads or landing slabs in `StairScene.jsx`. Fast Rails creates posts and rail connections in one flow. Top Rail mode connects two existing posts.

Landing post rules:
- Bottom landing click clamp: `xIn` must be from `-treadDepth` to `0`.
- Top landing click clamp: `xIn` must be from `run - treadDepth` to `run`.
- Movement controls preserve those same along-run ranges.
- 3D bases place posts on slab tops rather than through slabs.

Rail pipeline:
- Top rail: `resolveTopRailSegments`.
- Bottom rail: `getManualBottomRailSegments`.
- Middle rail: `getManualMiddleRailSegments`.
- Custom standard route: `customRouteSegments` supports pre-turn, left/right 90, and straight pieces.
- Manual path mode: `manualSegments` starts at the first post and walks forward/turn commands.

Risk: manual path mode keeps `curY` constant for forward pieces, so it does not resume stair pitch rise. Custom standard route does calculate pitch rise by projecting movement along the original post-to-post plan direction.

## 6. PDF Parity Audit

Correct or mostly correct:
- Main side-view PDF includes stair profile, landings, manual posts, manual top rails, bottom rails, middle rails, side/free3D dimensions, side/free3D text, schedules, material list, warnings.
- Top rail side-view segments use `resolveTopRailSegments`, so standard dogleg/custom route segments generally match 3D/material lengths.
- Landing post side labels identify bottom/top landing posts.
- Landing labels themselves are not reintroduced as extra callouts.
- No blue dashed diagonal guide was found in PDF generation.

Missing or risky:
- No real top-view PDF page exists. `projection === 'top'` dimensions/text are intentionally excluded in `generatePdf.js`.
- PDF draft annotations are optional extra pages, separate from the main PDF geometry, and not persisted.
- The side PDF projects 3D/free dimensions to x/y and drops z/depth.
- PDF side view cannot fully represent lateral/top route geometry; it collapses Z, which is acceptable for elevation but not complete fabrication parity.
- Structure offsets do not affect PDF.
- The optional 3D draft page depends on a captured canvas bitmap, not recomputed geometry.

## 7. Supabase / Database Audit

Supabase client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, which is correct for frontend exposure.

Save behavior:
- Updates or creates `stair_projects`.
- Inserts a new `stair_config_versions` row every save.
- Stores full config plus manual dimensions/text, structure offsets, PDF mirror, top rail mode, units in `stair_config`.
- Stores posts/rails in `manual_posts` and `manual_top_rails`.

Load behavior:
- Lists projects ordered by `updated_at`.
- Loads latest config version by `created_at desc`.
- Restores dimensions/text from `stair_config`, posts/rails from jsonb columns.

Risks:
- `supabase/schema.sql` enables RLS and explicitly says no public policies are created. With only anon frontend credentials, save/open will fail unless policies were applied outside this repo.
- `stair_projects.units` defaults to `'inches'`, but app uses `'in'`/`'mm'`. Load fallback handles app values, but existing DB defaults are inconsistent.
- `pdfDrafts` are not saved to Supabase.
- There is no project ownership/user id in schema, so future auth will require migration.

## 8. JSON / localStorage Audit

JSON export includes project, stairConfig, units, manual dimensions, manual posts, manual top rails, text annotations, structure offset, PDF mirror, top rail mode, calculations, warnings, and material list.

JSON import validates known fields and supports older rails without endpoint objects by later normalizing them. It handles legacy `middleRailHeight` fallback.

localStorage autosave restores the same core state as JSON/Supabase for main model entities.

Risks:
- `pdfDrafts` are not saved to JSON or localStorage.
- `ALL_STAIR_KEYS` in `saveJson.js` omits `middleRailHeights`, then handles it separately. This is workable but easy to miss for future array config fields.
- `isValidManualTopRail` only checks that endpoint fields are objects; it does not validate endpoint shape, ids, fixed points, extension values, or route segment arrays.
- `skipAutosaveRestoreRef` is set but never read, so it has no effect.

## 9. Business Logic Issues

- Absolute parity is not met for PDF draft annotations, top-view annotations, and structure offsets.
- Manual path top rails do not follow stair pitch on forward pieces.
- PDF has no true top plan page despite top-view annotation support.
- Supabase persistence is not self-contained because repo schema blocks anon RLS access.
- Materials summarize manual posts as one line with max height, not a per-height cut schedule.
- Materials summarize rails as total length per type, not individual cut lengths in the main material table.
- Top landing placement follows the latest business rule: near last step and limited to one tread depth.
- Landing post bases appear to sit on landing slabs in 3D/PDF.

## 10. Bugs Found

### Critical

None found at compile/build level.

### High

1. File: `src/App.jsx`, `pdfDrafts` state and `handleExportPdf`
   Problem: PDF draft dimensions/text are passed to PDF export but are not included in autosave, JSON save/open, or Supabase save/open.
   Why it matters: User-created PDF drafting work disappears on reload/open and violates save/open parity.
   Suggested surgical fix: Add `pdfDrafts` to autosave snapshot, JSON payload/import validation, Supabase `stair_config`, and load restoration.

2. File: `src/pdf/generatePdf.js`, manual dimension/text filters
   Problem: Top-projected manual dimensions/text are excluded because there is no top/plan PDF page.
   Why it matters: A user can create visible top-view annotations that never appear in PDF.
   Suggested surgical fix: Add a top-view PDF page and render `projection === 'top'` dimensions/text there.

3. File: `src/geometry/railingGeometry.js`, `getManualTopRailManualSegments`
   Problem: manual path forward segments use constant Y.
   Why it matters: Forward pieces do not resume stair pitch rise, directly conflicting with route business rules.
   Suggested surgical fix: Reuse the pitch logic from `getCustomRouteSegments` or remove manual mode until it matches route physics.

4. File: `supabase/schema.sql`, RLS section; `src/lib/saveProject.js`; `src/lib/loadProject.js`
   Problem: schema enables RLS but creates no policies, while frontend uses anon client for save/open.
   Why it matters: Freshly applied schema will block cloud save/open.
   Suggested surgical fix: Either add owner/auth policies and user ids, or document/admin-gate Supabase as unavailable until auth lands.

### Medium

5. File: `src/App.jsx`, `handleFastRailsPost` and `handleTopRailPostClick`
   Problem: duplicate detection checks `startPostId/endPostId` only, not normalized endpoints.
   Why it matters: Rails loaded in endpoint format can be duplicated.
   Suggested surgical fix: normalize each rail before duplicate comparison.

6. File: `src/components/RightPanel.jsx`, top rail list
   Problem: post labels use `rail.startPostId/endPostId` instead of normalized endpoint ids.
   Why it matters: Endpoint-format rails may display `?` even when connected.
   Suggested surgical fix: use `r.startEndpoint.postId` and `r.endEndpoint.postId`.

7. File: `src/components/StairScene.jsx`, group with `structureOffsetXIn/structureOffsetZIn`
   Problem: 3D-only railing offset is not reflected in PDF/materials.
   Why it matters: Output can differ from what the user sees in the model.
   Suggested surgical fix: either apply offsets in all shared segment/project output paths or clearly classify it as a viewport-only preview state outside fabrication data.

8. File: `src/geometry/stairMath.js`, `buildMaterialList`
   Problem: manual post material line uses quantity and max height only.
   Why it matters: Posts of different heights do not produce distinct cut lines.
   Suggested surgical fix: group posts by height/profile/surface and emit per-length rows.

9. File: `src/utils/saveJson.js`, `isValidManualTopRail`
   Problem: endpoint rails pass validation with almost any object endpoints.
   Why it matters: malformed route data can enter state and be silently skipped or behave unpredictably.
   Suggested surgical fix: validate endpoint `anchorType`, post ids, fixed `pointIn`, extension, and route segment shapes.

### Low

10. File: `src/App.jsx`
    Problem: `skipAutosaveRestoreRef` is set during open/load but never read.
    Why it matters: dead state suggests an incomplete autosave conflict strategy.
    Suggested surgical fix: remove it or implement the intended guard.

11. File: `README.md`
    Problem: current limitations still say local only/no Supabase, while Supabase save/open exists.
    Why it matters: docs are stale and can mislead future development.
    Suggested surgical fix: update README after Supabase behavior is confirmed.

12. File: `src/pdf/generatePdf.js`
    Problem: `Page 1 of 4` style headers are fixed while optional draft pages can create 5-6 pages.
    Why it matters: page numbering becomes inaccurate.
    Suggested surgical fix: compute total pages after optional pages or use neutral page labels.

## 11. Risky Code / Refactor Candidates

- `App.jsx` is the central state and orchestration hub; future parity changes are easy to miss.
- PDF generation is a single very large function with repeated coordinate transforms.
- There are multiple annotation systems: 3D manual dimensions/text and PDF draft dimensions/text.
- Top rail behavior is split between standard custom routes, dogleg, and manual path mode.
- Material list is summary-level, while fabrication needs per-cut grouping.
- Supabase schema and app behavior are loosely coupled through jsonb instead of a formal project schema version.

Do not refactor these before shipping the surgical parity fixes.

## 12. Missing Tests / Manual Test Checklist

Automated tests are currently absent. Build and lint pass.

Manual checklist:

1. New project: add objects, click New Project, confirm reset clears posts, rails, dimensions, text, selected ids, offsets, mirror, path mode.
2. Add posts: enable railing, click Posts, place tread top/side posts, verify selection and adjustment controls.
3. Add landing posts: enable bottom/top landing, place posts near stair-side landing zones, verify far-wall clicks are rejected.
4. Move posts: nudge tread and landing posts; verify landing along-run clamps stay within one tread depth.
5. Delete post and rails: connect two posts, delete one post by panel and Delete key, verify connected rails disappear.
6. Fast Rails: enable Fast Rails, place several posts, verify rails are auto-created and no duplicates after selecting an existing post.
7. Top rail route turns: select rail, add L/R 90, pre-turn, straight segments; compare 3D, PDF side view, material count.
8. Manual top rail path: switch Manual mode, add forward/turn/forward, verify whether pitch behavior is acceptable.
9. Bottom/middle rails: toggle and adjust heights, compare 3D, PDF, materials.
10. Dimensions: add side/top/3D dimensions, edit labels, undo/delete, export PDF and verify which ones appear.
11. Text annotations: add side/top/3D text, multiline edit, export PDF and verify which ones appear.
12. Save JSON: export, inspect without exposing secrets, verify main entities are present.
13. Open JSON: reload the saved file and compare 3D, panel, materials, PDF.
14. Supabase save/open: with configured env and policies, save project, reopen latest version, compare all entities.
15. localStorage autosave: reload browser after edits and verify restoration.
16. PDF export: verify page layout, no unwanted landing labels, no blue dashed diagonal guide, rail/post alignment, material table.

## 13. Recommended Fix Plan

Phase 1: critical no-brainer fixes
- Persist `pdfDrafts` through autosave, JSON, Supabase.
- Normalize rail duplicate detection and RightPanel labels.
- Remove or implement `skipAutosaveRestoreRef`.
- Fix optional PDF page numbering.

Phase 2: parity fixes
- Add a real top-view PDF page for top dimensions/text and plan geometry.
- Decide whether structure offsets are fabrication data; if yes, apply across PDF/material/save, if no, rename and exclude from business parity.
- Make manual path top rails follow stair pitch or retire the mode in favor of standard custom routes.
- Improve materials to produce per-cut rows for posts and rails.

Phase 3: cleanup/refactor
- Extract PDF coordinate helpers and page builders.
- Introduce a project schema normalizer shared by JSON, Supabase, and autosave.
- Consolidate top rail route modes.

Phase 4: tests/docs
- Add unit tests for railing segment resolution, landing clamps, JSON normalization, material rows.
- Add a small PDF parity smoke test or golden-data test around generated segments.
- Update README/Supabase docs to match current behavior and RLS requirements.

## 14. Exact Files To Change Later

- `src/App.jsx`
- `src/utils/saveJson.js`
- `src/lib/saveProject.js`
- `src/lib/loadProject.js`
- `src/geometry/railingGeometry.js`
- `src/geometry/stairMath.js`
- `src/pdf/generatePdf.js`
- `src/components/RightPanel.jsx`
- `src/components/StairScene.jsx`
- `supabase/schema.sql`
- `supabase/README.md`
- `README.md`

## Command Results

- `pwd`: `/Users/vasylpopovich/Projects/stair-designer`
- `git status --short`: dirty before audit with modified `src/App.jsx`, `src/components/StairScene.jsx`, `src/components/Toolbar.jsx`, `src/pdf/generatePdf.js`, `src/styles.css`, and untracked `src/components/PDFDraftOverlay.jsx`.
- `npm run build`: passed. Vite warned that one chunk is larger than 500 kB.
- `npm run lint`: passed.

## Final Audit Notes

Top 10 most important findings:

1. PDF draft annotations are not persisted.
2. Top-view manual dimensions/text do not export to the main PDF.
3. Manual top rail path mode does not resume stair pitch rise.
4. Supabase RLS blocks anon save/open on a fresh schema.
5. Structure offset is 3D-only and violates strict parity.
6. Endpoint-format rails can duplicate because duplicate checks use old fields.
7. RightPanel can show `?` for valid endpoint-format rail connections.
8. Material/cut list is summary-level, not per-cut enough for mixed post/rail lengths.
9. JSON rail endpoint validation is too loose.
10. Optional draft pages make PDF page counts inaccurate.

Safe to start fixing: yes, but only surgically and in the order above.

First recommended surgical fix: persist `pdfDrafts` through localStorage autosave, JSON save/open, and Supabase save/open, because it is active user-created work that can currently be lost.
