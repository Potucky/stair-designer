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

## Current Milestone

`checkpoint/2026-05-29-2140-pdf-side-view-drawing-sheet`
