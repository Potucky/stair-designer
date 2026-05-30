# Stair Designer — v0.0.2 MVP Printable PDF

A browser-based CAD-style tool for metal stair and railing fabrication.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
```

## What it does

- Live 3D straight stair model (Three.js / react-three-fiber)
- Parametric inputs: height, run, width, steps, tube size
- Optional railing with posts and handrail
- Automatic calculations: angle, riser height, tread depth, stringer length
- Florida Building Code validation warnings
- Material / cut list
- Export PDF — letter-size printable fabrication sheet with dimensioned side-view drawing
- Save / load JSON (local download)
- CAD-style layout: left toolbar, center 3D workspace, right inspector, status bar

## Tech Stack

React · Vite · Three.js · @react-three/fiber · @react-three/drei · jsPDF · Plain CSS

## Current Limitations

- Local only — no backend, no cloud sync
- No Supabase yet
- No authentication yet
- Schematic fabrication helper only — verify all field measurements, local codes, permits, and structural requirements before building

## Supabase Frontend Configuration

- Copy `.env.example` to `.env.local` and fill in your project values when ready
- Use only the **anon key** (`VITE_SUPABASE_ANON_KEY`) in the frontend — it is safe to expose in the browser
- **Never** use the `service_role` key in the frontend — it bypasses Row Level Security
- Save/Load cloud integration is a later step; this file only sets up the client placeholder

## GitHub Pages

Deployed automatically on every push to `main`.

URL: [https://potucky.github.io/stair-designer/](https://potucky.github.io/stair-designer/)

## Current Milestone

`checkpoint/2026-05-29-2140-pdf-side-view-drawing-sheet`
