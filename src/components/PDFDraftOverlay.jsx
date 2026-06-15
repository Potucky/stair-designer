import { useState, useRef, useEffect } from 'react';

// PDF page dimensions (landscape letter, pt)
const PDF_W = 792;
const PDF_H = 612;
// Editor page pixel dimensions (same aspect ratio)
const PAGE_W = 660;
const PAGE_H = Math.round(PAGE_W * (PDF_H / PDF_W)); // 510

// Compute stair step outline lines in PDF-point space
function buildSideLines(stairConfig, calc, pdfMirrored) {
  if (!stairConfig || !calc) return [];
  const { run, height, steps } = stairConfig;
  const { riserHeight, treadDepth } = calc;
  if (!run || !height || !steps || !riserHeight || !treadDepth) return [];

  const M = 48;
  const dAreaX = M + 62;
  const dAreaW = PDF_W - dAreaX - M - 12;
  const safeTop = 82;
  const safeBot = PDF_H - 44;
  const safeH = safeBot - safeTop;
  const pad = 24;
  const handrailH = stairConfig.handrailHeight ?? 36;
  const totalVisualH = height + handrailH + riserHeight / 2;
  const scaleX = (dAreaW * 0.80) / run;
  const scaleY = (safeH - 2 * pad) / totalVisualH;
  const sc = Math.min(scaleX, scaleY);
  const drawH = totalVisualH * sc;
  const groundY = (safeTop + safeBot) / 2 + drawH / 2;
  const dw = run * sc;
  const rPx = riserHeight * sc;
  const tPx = treadDepth * sc;
  const ox = dAreaX + (dAreaW - dw) / 2;
  const oy = groundY;
  const mirrored = Boolean(pdfMirrored);
  const mfn = mirrored ? x => 2 * ox + dw - x : x => x;

  const lines = [];
  lines.push({ key: 'gnd', x1: mfn(ox - 28), y1: oy, x2: mfn(ox + dw + 28), y2: oy, stroke: '#aaa', sw: 0.8 });

  let sx = ox, sy = oy;
  for (let i = 0; i < steps; i++) {
    lines.push({ key: `r${i}`, x1: mfn(sx), y1: sy, x2: mfn(sx), y2: sy - rPx, stroke: '#1a1a2e', sw: 1.5 });
    if (!(stairConfig.topLandingEnabled && i === steps - 1)) {
      lines.push({ key: `t${i}`, x1: mfn(sx), y1: sy - rPx, x2: mfn(sx + tPx), y2: sy - rPx, stroke: '#1a1a2e', sw: 1.5 });
    }
    sx += tPx;
    sy -= rPx;
  }
  return lines;
}

export default function PDFDraftOverlay({ mode, draft, onUpdateDraft, onClose, stairConfig, calc, pdfMirrored }) {
  const [transform, setTransform] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [pendingA, setPendingA] = useState(null); // normalized {x,y} 0..1
  const [editingId, setEditingId] = useState(null);
  const [editingLabel, setEditingLabel] = useState('');
  const contentRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, didDrag: false });

  // Fit page in view on mount
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const { clientWidth: cw, clientHeight: ch } = el;
    const z = Math.max(0.25, Math.min((cw - 60) / PAGE_W, (ch - 60) / PAGE_H, 1));
    setTransform({ zoom: z, panX: (cw - PAGE_W * z) / 2, panY: (ch - PAGE_H * z) / 2 });
  }, []);

  // Wheel zoom centered on mouse
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.88 : 1.14;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setTransform(t => {
        const newZ = Math.min(4, Math.max(0.2, t.zoom * factor));
        return {
          zoom: newZ,
          panX: mx - (mx - t.panX) / t.zoom * newZ,
          panY: my - (my - t.panY) / t.zoom * newZ,
        };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDown = e => {
    if (e.button !== 0) return;
    const d = dragRef.current;
    d.active = true;
    d.didDrag = false;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.startPanX = transform.panX;
    d.startPanY = transform.panY;
  };

  const handleMouseMove = e => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > 4) d.didDrag = true;
    if (d.didDrag) setTransform(t => ({ ...t, panX: d.startPanX + dx, panY: d.startPanY + dy }));
  };

  const handleMouseUp = e => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    if (d.didDrag) { d.didDrag = false; return; }
    d.didDrag = false;
    if (editingId) return;

    const el = contentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const { zoom, panX, panY } = transform;
    const pw = PAGE_W * zoom;
    const ph = PAGE_H * zoom;
    if (cx < panX || cx > panX + pw || cy < panY || cy > panY + ph) return;

    const nx = (cx - panX) / pw;
    const ny = (cy - panY) / ph;

    if (!pendingA) {
      setPendingA({ x: nx, y: ny });
    } else {
      const id = `pdim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      onUpdateDraft({
        ...draft,
        dimensions: [...draft.dimensions, { id, ax: pendingA.x, ay: pendingA.y, bx: nx, by: ny, label: 'DIM' }],
      });
      setPendingA(null);
    }
  };

  const commitLabel = () => {
    if (!editingId) return;
    onUpdateDraft({
      ...draft,
      dimensions: draft.dimensions.map(d => d.id === editingId ? { ...d, label: editingLabel } : d),
    });
    setEditingId(null);
  };

  const handleDeleteLast = () => {
    if (pendingA) { setPendingA(null); return; }
    if (draft.dimensions.length > 0) onUpdateDraft({ ...draft, dimensions: draft.dimensions.slice(0, -1) });
  };

  const handleFit = () => {
    const el = contentRef.current;
    if (!el) return;
    const { clientWidth: cw, clientHeight: ch } = el;
    const z = Math.max(0.25, Math.min((cw - 60) / PAGE_W, (ch - 60) / PAGE_H, 1));
    setTransform({ zoom: z, panX: (cw - PAGE_W * z) / 2, panY: (ch - PAGE_H * z) / 2 });
    setPendingA(null);
  };

  const sideLines = mode === 'side' ? buildSideLines(stairConfig, calc, pdfMirrored) : [];
  const { zoom, panX, panY } = transform;

  const editingDim = editingId ? draft.dimensions.find(d => d.id === editingId) : null;

  return (
    <div className="pdf-draft-overlay">
      <div className="pdf-draft-header">
        <span className="pdf-draft-title">{mode === 'side' ? 'Side PDF Draft' : '3D PDF Draft'}</span>
        <span className="pdf-draft-hint">
          {pendingA ? 'Click point B to complete dimension' : 'Click to place dimension (A → B)'}
        </span>
        <div className="pdf-draft-actions">
          <button className="panel-btn" onClick={() => setTransform(t => ({ ...t, zoom: Math.min(4, t.zoom * 1.25) }))}>+</button>
          <button className="panel-btn" onClick={() => setTransform(t => ({ ...t, zoom: Math.max(0.2, t.zoom / 1.25) }))}>−</button>
          <button className="panel-btn" onClick={handleFit}>Fit</button>
          <button
            className="panel-btn"
            onClick={handleDeleteLast}
            disabled={!pendingA && draft.dimensions.length === 0}
          >
            Delete Last
          </button>
          <button className="panel-btn panel-btn-primary" onClick={onClose}>Exit</button>
        </div>
      </div>

      <div
        className="pdf-draft-content"
        ref={contentRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { dragRef.current.active = false; }}
      >
        {/* Page */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: PAGE_W,
            height: PAGE_H,
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
            background: 'white',
            boxShadow: '0 4px 28px rgba(0,0,0,0.45)',
            overflow: 'hidden',
          }}
        >
          {/* 3D background image */}
          {mode === '3d' && draft.backgroundImage && (
            <img
              src={draft.backgroundImage}
              alt="3D view"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }}
            />
          )}

          {/* Side stair outline — drawn in PDF-point space, scaled by SVG viewBox */}
          {mode === 'side' && sideLines.length > 0 && (
            <svg
              width={PAGE_W}
              height={PAGE_H}
              viewBox={`0 0 ${PDF_W} ${PDF_H}`}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              {sideLines.map(l => (
                <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.stroke} strokeWidth={l.sw} />
              ))}
            </svg>
          )}

          {/* Dimensions overlay — drawn in page-pixel space (0..PAGE_W × 0..PAGE_H) */}
          <svg width={PAGE_W} height={PAGE_H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            {draft.dimensions.map(dim => {
              const ax = dim.ax * PAGE_W, ay = dim.ay * PAGE_H;
              const bx = dim.bx * PAGE_W, by = dim.by * PAGE_H;
              const len = Math.hypot(bx - ax, by - ay);
              if (len < 4) return null;
              const midX = (ax + bx) / 2, midY = (ay + by) / 2;
              const ux = (bx - ax) / len, uy = (by - ay) / len;
              const px = -uy, py = ux;
              const TICK = 8;
              const lbl = String(dim.label ?? 'DIM');
              const lblW = Math.max(30, lbl.length * 6.5 + 10);
              return (
                <g key={dim.id}>
                  <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#1e3a5f" strokeWidth={1.2} />
                  <line x1={ax - px * TICK} y1={ay - py * TICK} x2={ax + px * TICK} y2={ay + py * TICK} stroke="#1e3a5f" strokeWidth={1.2} />
                  <line x1={bx - px * TICK} y1={by - py * TICK} x2={bx + px * TICK} y2={by + py * TICK} stroke="#1e3a5f" strokeWidth={1.2} />
                  {editingId !== dim.id && (
                    <>
                      <rect x={midX - lblW / 2} y={midY - 7} width={lblW} height={13} fill="white" stroke="#c0c8d5" strokeWidth={0.5} rx={2} />
                      <text
                        x={midX} y={midY + 3}
                        textAnchor="middle"
                        fontSize={9}
                        fill="#1e3a5f"
                        fontWeight="bold"
                        fontFamily="helvetica, sans-serif"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); setEditingId(dim.id); setEditingLabel(dim.label ?? 'DIM'); }}
                      >
                        {lbl}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {pendingA && (
              <circle cx={pendingA.x * PAGE_W} cy={pendingA.y * PAGE_H} r={4} fill="#1e3a5f" stroke="white" strokeWidth={1.5} />
            )}
          </svg>

          {/* Label edit input (absolutely positioned inside page div) */}
          {editingDim && (
            <input
              type="text"
              value={editingLabel}
              onChange={e => setEditingLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={e => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') setEditingId(null); }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
              autoFocus
              style={{
                position: 'absolute',
                left: ((editingDim.ax + editingDim.bx) / 2) * PAGE_W - 30,
                top: ((editingDim.ay + editingDim.by) / 2) * PAGE_H - 9,
                width: 60,
                height: 18,
                fontSize: 10,
                textAlign: 'center',
                zIndex: 10,
                background: 'white',
                border: '1px solid #1e3a5f',
                borderRadius: 2,
                outline: 'none',
                padding: '0 2px',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
