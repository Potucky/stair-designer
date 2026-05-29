# Stair Designer — v0.0.1 MVP

A browser-based CAD-style tool for metal stair and railing fabrication.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## What it does

- Live 3D straight stair model (Three.js / react-three-fiber)
- Parametric inputs: height, run, width, steps, tube size
- Optional railing with posts and handrail
- Automatic calculations: angle, riser height, tread depth, stringer length
- Florida Building Code validation warnings
- Material / cut list
- Export PDF (jsPDF, letter size, with disclaimer)
- Save JSON (local download)
- Print (browser print)
- CAD-style layout: left toolbar, center 3D workspace, right inspector, status bar

## Tech Stack

React · Vite · Three.js · @react-three/fiber · @react-three/drei · jsPDF · Plain CSS

## Notes

- No backend, no auth, no Supabase in v0.0.1
- Local JSON save only
- Disclaimer: fabrication helper only — verify all field measurements, local codes, and structural requirements before building
