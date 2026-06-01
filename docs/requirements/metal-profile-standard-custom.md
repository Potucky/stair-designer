# Metal Profile: Standard and Custom Configuration

## 1. Purpose

Stair Designer needs a simple, ready-to-use default stair and railing template so users can generate a compliant design immediately without any configuration. At the same time, metal fabricators and designers need the ability to specify exact profile shapes for each component (post, handrail, infill, etc.) to match real-world material orders.

The goal is to introduce a lightweight Standard / Custom mode that covers common fabrication needs without turning Stair Designer into a full CAD program. Users who want the default look should never be forced into configuration. Users who need precise profiles should be able to select them per component in a few clicks.

---

## 2. Standard Mode

Standard mode is the default. It activates automatically when a new project is created and requires no user action.

**Default profile assignments:**

| Component | Default Profile |
|-----------|----------------|
| Handrail / top rail | 2" × 1" rectangular tube |
| Posts | 2" × 2" rectangular tube |
| Stair type | Basic straight stair railing |

Standard mode must work immediately with minimal setup. No profile picker is shown in this mode. The 3D view, material list, and cut list all use the default profiles above.

---

## 3. Custom Mode

Custom mode is activated by a dedicated **Custom** button or toggle in the UI (e.g., in the toolbar or sidebar next to the current mode indicator).

When Custom mode is active:

- The user can click or hover over any component in the 3D view or in a related component panel.
- A compact profile dropdown appears, contextual to the selected component type.
- Profile selections are stored per project and persist across sessions.
- The UI clearly indicates that Custom mode is active (e.g., button highlight, badge, or label).

Switching back to Standard mode resets all components to the default profiles listed in Section 2. The app should prompt the user before discarding custom selections.

---

## 4. Component Selection Behavior

When the user selects a component (click in 3D view or panel row):

1. The app identifies the **component type**: post, handrail, rail, plate, stick/bar, infill, or none.
2. The app shows **only the profile options relevant to that component type** — not a global list.
3. The dropdown is compact (4–6 options maximum per type, plus a "custom rectangular tube" escape hatch).
4. Selecting a profile applies it immediately to the selected component and updates stored project data.

Do not show all possible profile options at once. Contextual filtering is required so the picker remains fast and readable.

---

## 5. Example Profile Options

### Handrail / Top Rail

- 2" × 1" tube *(default)*
- 4" × 2" tube
- 4" × 1" tube
- Custom rectangular tube *(user-entered dimensions)*

### Posts

- 2" × 2" tube *(default)*
- 1" × 1" tube
- 2" × 1" tube
- Custom rectangular tube *(user-entered dimensions)*

### Rails / Infill

- Horizontal tube
- Vertical stick / bar
- Plate
- None *(disables this component)*

---

## 6. Replace vs. Add Behavior

Profile changes fall into two categories:

### Replace

Selecting a different profile for an existing component replaces its dimensions in place. The component count does not change.

**Examples:**
- Changing post profile from 2×2 to 2×1 → replaces post profile; post count unchanged.
- Changing handrail from 2×1 to 4×2 → replaces handrail profile; handrail count unchanged.

### Add

Some selections create a new component that did not exist before.

**Examples:**
- Adding a bottom rail → inserts a new rail component at the base of the run.
- Adding a plate → attaches or inserts a plate relative to the selected component (attachment behavior TBD in geometry implementation).

### Disable

- Selecting **None** for an optional component (e.g., infill) marks it as disabled.
- A disabled component does not appear in 3D, material list, or cut list.

---

## 7. Data Requirements

Profile selections must be stored in project data (JSON or equivalent project file format).

**Suggested top-level fields:**

```json
{
  "profileMode": "standard | custom",
  "selectedComponentId": "<uuid or null>",
  "componentProfiles": {
    "<componentId>": {
      "type": "post | handrail | rail | plate | bar | infill",
      "profileKey": "2x2_tube | 2x1_tube | 4x2_tube | custom | none | ...",
      "customDimensions": { "width": 2.0, "height": 1.5 }
    }
  },
  "customProfiles": {
    "<profileKey>": {
      "label": "My custom tube",
      "width": 2.0,
      "height": 1.5,
      "shape": "rectangular_tube"
    }
  }
}
```

- `profileMode` — `"standard"` or `"custom"`.
- `selectedComponentId` — the currently active selection; `null` when nothing is selected.
- `componentProfiles` — per-component overrides keyed by component ID.
- `customProfiles` — reusable custom profile definitions the user has created.

In Standard mode, `componentProfiles` is ignored and defaults from Section 2 are used.

---

## 8. Future Output Requirements

Once geometry and export pipelines are updated (out of scope for first implementation), profile selections must propagate to:

- **3D geometry** — tube / bar cross-section shapes rendered at correct dimensions.
- **Material list** — line items reference profile label and dimensions.
- **Cut list** — lengths calculated using actual profile dimensions.
- **PDF drawing** — section views and annotations reflect selected profiles.
- **Measurements** — displayed dimensions account for actual profile width/height.

These outputs are downstream of profile data. Storing the data now (Section 7) is a prerequisite for implementing them later.

---

## 9. Non-Goals for First Implementation

The following are explicitly out of scope until requirements are stable and the data model is validated:

- Full CAD-style profile editing (arbitrary cross-sections, custom shapes beyond rectangular tube).
- Unlimited component types beyond the set defined in Section 4.
- Geometry changes — 3D rendering continues to use placeholder/default geometry.
- PDF changes — existing PDF output is not modified.
- Material list changes — existing material list logic is not modified.
- Cut list changes — existing cut list logic is not modified.

**First implementation goal:** document and prepare clean, agreed-upon requirements. No code changes are required to ship this document.
