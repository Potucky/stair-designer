# Stair Designer — stable UI/geometry checkpoint — 2026-05-31

## Stable working state

This is the current restore point before taking a break.

Confirmed working:
- Local app opens at `/stair-designer/`.
- 3D View resets and re-centers the stair.
- Keyboard viewport nudging works.
- Mouse rotate / zoom / pan works.
- Dimensions toggle works.
- Drafting-style dimension arrows are visible.
- Right panel width is compact at 260px.
- Units toggle shows Inch / mm with active highlight.
- PDF Output section is visible in the right panel.
- Measure tool exists.
- Old duplicate/cross railings were removed.
- Current straight stair template shows handrails aligned with stair run.
- Posts remain vertical.

## Important recent commits

- 3b06bae fix: remove duplicate cross railings
- 84e1302 feat: add custom measure tool
- e6601a1 fix: align railings with stair run
- f48f5a2 feat: polish units toggle button
- 52d80d6 feat: add pdf output section
- bf79701 feat: reduce right panel to 260px
- 31a5d62 feat: add drafting dimension arrows
- c13a9b5 feat: reset viewport with 3d view button

## Known next technical risks from Codex audit

These are not emergency fixes, but should guide the next serious development pass:

1. Create one shared straight-stair geometry source of truth.
2. Make 3D geometry, dimensions, results, PDF, and material list use the same calculated geometry.
3. Decide railing sidedness: one side vs both sides, then make 3D, PDF, and material count match.
4. Improve Measure tool later with snapping to real stair points.
5. Polish PDF into a fabrication-style drawing after geometry is unified.

## Workflow rule

Open local site → inspect visually → one short Claude Code task → commit/checkpoint → inspect again.

Claude Code = execution only.
Codex = audit/review only.
Terminal = launch/check/push only.
