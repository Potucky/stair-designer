import { useState, useRef } from 'react';
import { TUBE_SIZES } from '../data/materialProfiles.js';
import { fmtDeg, fmtUnit, INCH_TO_MM } from '../utils/format.js';
import { normalizeRailEndpoints, DEFAULT_MANUAL_SEGMENTS, getManualPostTop, INtoU } from '../geometry/railingGeometry.js';

function NumericDraftInput({ value, onCommit, className, style, inputMode = 'decimal', integer = false, allowZero = false }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const cancelRef = useRef(false);
  const valueAtFocusRef = useRef(null);

  const parse = (raw) => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    if (integer) {
      if (!/^\d+$/.test(trimmed)) return null;
      const v = parseInt(trimmed, 10);
      return v > 0 ? v : null;
    }
    if (!/^(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
    const v = parseFloat(trimmed);
    return Number.isFinite(v) && (allowZero ? v >= 0 : v > 0) ? v : null;
  };

  const handleFocus = (e) => {
    cancelRef.current = false;
    valueAtFocusRef.current = value;
    const el = e.target;
    const str = String(value);
    setDraft(str);
    setFocused(true);
    requestAnimationFrame(() => {
      el.setSelectionRange(str.length, str.length);
    });
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    setDraft(raw);
    const v = parse(raw);
    if (v !== null) onCommit(v);
  };

  const handleBlur = () => {
    if (!cancelRef.current) {
      const v = parse(draft);
      if (v !== null) onCommit(v);
    } else {
      onCommit(valueAtFocusRef.current);
    }
    cancelRef.current = false;
    setFocused(false);
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      cancelRef.current = true;
      e.target.blur();
    }
  };

  return (
    <input
      className={className}
      style={style}
      type="text"
      inputMode={inputMode}
      value={focused ? draft : String(value)}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
    />
  );
}

const QUICK_EXT = [0, 1, 2, 3, 4, 5, 10];

function ExtChips({ curLen, onSet }) {
  const [draft, setDraft] = useState('');
  const isQuick = QUICK_EXT.includes(curLen);

  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
      {QUICK_EXT.map(v => (
        <button
          key={v}
          className={`panel-btn${curLen === v ? ' panel-btn-active' : ''}`}
          style={{ padding: '2px 5px', fontSize: 10, minWidth: 26 }}
          onClick={() => { onSet(v); setDraft(''); }}
        >{v}&quot;</button>
      ))}
      <input
        type="text"
        inputMode="decimal"
        placeholder="1–50"
        className="field-input"
        style={{ width: 42, fontSize: 10, padding: '2px 4px' }}
        value={draft || (!isQuick && curLen > 0 ? String(curLen) : '')}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = parseFloat(draft);
          if (Number.isFinite(v)) onSet(Math.max(1, Math.min(50, v)));
          setDraft('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur();
          if (e.key === 'Escape') { setDraft(''); e.target.blur(); }
        }}
      />
    </div>
  );
}

export default function RightPanel({ project, setProject, stairConfig, setStairConfig, calc, warnings, materials, onNewProject, onSaveProject, onOpenProject, onExportPdf, units, manualPosts, postPlacementMode, onTogglePostPlacement, selectedManualPostId, onUpdateManualPost, onDeleteManualPost, topRailMode, onToggleTopRailMode, topRailFirstPostId, manualTopRails, onDeleteManualTopRail, selectedManualTopRailId, onSelectManualTopRail, onUpdateManualTopRail, topRailPathMode, onTopRailPathModeChange, structureMoveSelected, onToggleStructureMove, onMoveForward, onMoveBack, onMoveLeft, onMoveRight, onResetStructureOffset, structureOffsetXIn, structureOffsetZIn, fastRailsMode, fastRailsPrevPostId, onToggleFastRailsMode }) {
  const [saveStatus, setSaveStatus] = useState(null);
  const [turnPosition, setTurnPosition] = useState('atEnd');
  const [customTurnDistIn, setCustomTurnDistIn] = useState(12);

  const str = (field) => (e) => setProject((p) => ({ ...p, [field]: e.target.value }));
  const toggle = (field) => (e) => setStairConfig((s) => ({ ...s, [field]: e.target.checked }));
  const sel = (field) => (e) => setStairConfig((s) => ({ ...s, [field]: e.target.value }));

  const commitDim = (field) => (v) =>
    setStairConfig((s) => ({ ...s, [field]: v }));

  const commitSteps = (v) =>
    setStairConfig((s) => ({ ...s, steps: Math.max(1, Math.round(v)) }));

  const errorWarnings = warnings.filter((w) => w.level === 'error');
  const warnWarnings = warnings.filter((w) => w.level === 'warning');

  return (
    <aside className="right-panel">

      {/* Project */}
      <section className="panel-section">
        <h3 className="section-title">Project</h3>
        <label className="field-label">Project Name
          <input className="field-input" value={project.name} onChange={str('name')} placeholder="My Stair Project" />
        </label>
        <label className="field-label">Client Name
          <input className="field-input" value={project.client} onChange={str('client')} placeholder="Client" />
        </label>
        <div className="field-row">
          <span className="field-label-sm">Units</span>
          <span className="field-value-sm">{units === 'mm' ? 'Millimeters (Metric)' : 'Inches (Imperial)'}</span>
        </div>
        <div className="save-project-row">
          <button className="panel-btn" onClick={onNewProject}>New Project</button>
          <button className="panel-btn" onClick={onOpenProject}>Open Project</button>
          <button
            className="panel-btn panel-btn-primary"
            disabled={saveStatus === 'saving'}
            onClick={async () => {
              setSaveStatus('saving');
              const result = await onSaveProject();
              setSaveStatus(result.ok ? 'saved' : result.error);
            }}
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save Project'}
          </button>
          {saveStatus && saveStatus !== 'saving' && (
            <span className={saveStatus === 'saved' ? 'save-status-ok' : 'save-status-error'}>
              {saveStatus === 'saved' ? 'Saved' : saveStatus}
            </span>
          )}
        </div>
      </section>

      {/* Section 1: Stair Setup */}
      <section className="panel-section">
        <h3 className="section-title">Stair Setup</h3>

        <label className="field-label">Total Height (in)
          <NumericDraftInput className="field-input" value={stairConfig.height} onCommit={commitDim('height')} />
        </label>
        <label className="field-label">Total Run (in)
          <NumericDraftInput className="field-input" value={stairConfig.run} onCommit={commitDim('run')} />
        </label>
        <label className="field-label">Width (in)
          <NumericDraftInput className="field-input" value={stairConfig.width} onCommit={commitDim('width')} />
        </label>
        <label className="field-label">Number of Steps
          <NumericDraftInput className="field-input" inputMode="numeric" integer={true} value={stairConfig.steps} onCommit={commitSteps} />
        </label>

        <label className="field-label field-checkbox">
          <input type="checkbox" checked={!!stairConfig.bottomLandingEnabled} onChange={toggle('bottomLandingEnabled')} />
          <span>Bottom Landing</span>
        </label>
        {stairConfig.bottomLandingEnabled && (
          <label className="field-label">Landing Length (in)
            <NumericDraftInput className="field-input" value={stairConfig.bottomLandingLength} onCommit={commitDim('bottomLandingLength')} />
          </label>
        )}

        <label className="field-label field-checkbox">
          <input type="checkbox" checked={!!stairConfig.topLandingEnabled} onChange={toggle('topLandingEnabled')} />
          <span>Top Landing</span>
        </label>
        {stairConfig.topLandingEnabled && (
          <label className="field-label">Landing Length (in)
            <NumericDraftInput className="field-input" value={stairConfig.topLandingLength} onCommit={commitDim('topLandingLength')} />
          </label>
        )}
      </section>

      {/* Section 2: Railing Setup */}
      <section className="panel-section">
        <h3 className="section-title">Railing Setup</h3>

        <label className="field-label field-checkbox">
          <input type="checkbox" checked={stairConfig.railingEnabled} onChange={toggle('railingEnabled')} />
          <span>Railing Enabled</span>
        </label>

        {stairConfig.railingEnabled && (
          <>
            <label className="field-label">Tube Size
              <select className="field-input" value={stairConfig.tubeSize} onChange={sel('tubeSize')}>
                {TUBE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="field-label">Railing Run Mode
              <select className="field-input" value={stairConfig.railingRunMode} onChange={sel('railingRunMode')}>
                <option value="matchStair">Match Stair</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            {stairConfig.railingRunMode === 'manual' && (
              <label className="field-label">Railing Length (in)
                <NumericDraftInput className="field-input" value={stairConfig.manualRailingRun} onCommit={commitDim('manualRailingRun')} />
              </label>
            )}
            <label className="field-label">Handrail Height (in)
              <NumericDraftInput className="field-input" value={stairConfig.handrailHeight} onCommit={commitDim('handrailHeight')} />
            </label>
            <label className="field-label">Guard/Pin Opening (in)
              <NumericDraftInput className="field-input" value={stairConfig.pinOpening} onCommit={commitDim('pinOpening')} />
            </label>

            <div style={{ marginTop: 8 }}>
              <div className="field-label-sm" style={{ marginBottom: 6 }}>3D Color Mode</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className={`panel-btn${stairConfig.railingColorMode !== 'black' ? ' panel-btn-active' : ''}`}
                  onClick={() => setStairConfig(s => ({ ...s, railingColorMode: 'work' }))}
                >
                  Work Colors
                </button>
                <button
                  className={`panel-btn${stairConfig.railingColorMode === 'black' ? ' panel-btn-active' : ''}`}
                  onClick={() => setStairConfig(s => ({ ...s, railingColorMode: 'black' }))}
                >
                  Black
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="field-label-sm" style={{ marginBottom: 6 }}>Railing Assembly</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  className={`panel-btn${postPlacementMode ? ' panel-btn-active' : ''}`}
                  onClick={onTogglePostPlacement}
                >
                  Posts
                </button>
                <button
                  className={`panel-btn${topRailMode ? ' panel-btn-active' : ''}`}
                  onClick={onToggleTopRailMode}
                >
                  Top Rail
                </button>
                <button
                  className={`panel-btn${fastRailsMode ? ' panel-btn-active' : ''}`}
                  onClick={onToggleFastRailsMode}
                >
                  Fast Rails
                </button>
                <button
                  className={`panel-btn${stairConfig.bottomRailEnabled ? ' panel-btn-active' : ''}`}
                  onClick={() => setStairConfig(s => ({ ...s, bottomRailEnabled: !s.bottomRailEnabled }))}
                >
                  Bottom Rail
                </button>
                <button
                  className={`panel-btn${stairConfig.middleRailEnabled ? ' panel-btn-active' : ''}`}
                  onClick={() => setStairConfig(s => {
                    if (!s.middleRailEnabled) {
                      const existing = s.middleRailHeights ?? (s.middleRailHeight != null ? [s.middleRailHeight] : null);
                      const heights = existing && existing.length > 0 ? existing : [18];
                      return { ...s, middleRailEnabled: true, middleRailHeights: heights };
                    }
                    return { ...s, middleRailEnabled: false };
                  })}
                >
                  Middle Rail
                </button>
                <button className="panel-btn" disabled title="Coming soon">Bridges</button>
              </div>
              {postPlacementMode && (
                <div className="post-tool-hint">Post tool active — click a step or side to place a post</div>
              )}
              {topRailMode && !topRailFirstPostId && (
                <div className="post-tool-hint">Top Rail active — click first post, then second post</div>
              )}
              {topRailMode && topRailFirstPostId && (
                <div className="post-tool-hint">First post selected — click second post</div>
              )}
              {fastRailsMode && !fastRailsPrevPostId && (
                <div className="post-tool-hint">Fast Rails: place first post</div>
              )}
              {fastRailsMode && fastRailsPrevPostId && (
                <div className="post-tool-hint">Fast Rails: place next post to create rails</div>
              )}
              {stairConfig.bottomRailEnabled && (
                <label className="field-label" style={{ marginTop: 8 }}>Bottom Rail Height (in)
                  <NumericDraftInput className="field-input" value={stairConfig.bottomRailHeight} onCommit={commitDim('bottomRailHeight')} />
                </label>
              )}
              {stairConfig.middleRailEnabled && (() => {
                const heights = stairConfig.middleRailHeights ?? (stairConfig.middleRailHeight != null ? [stairConfig.middleRailHeight] : [18]);
                return (
                  <div style={{ marginTop: 8 }}>
                    {heights.map((h, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <span className="field-label-sm" style={{ flex: 1, marginBottom: 0 }}>Rail {i + 1} height (in)</span>
                        <NumericDraftInput
                          className="field-input"
                          value={h}
                          onCommit={v => setStairConfig(s => {
                            const hs = s.middleRailHeights ?? (s.middleRailHeight != null ? [s.middleRailHeight] : [18]);
                            const next = [...hs];
                            next[i] = v;
                            return { ...s, middleRailHeights: next };
                          })}
                        />
                        <button
                          className="panel-btn"
                          style={{ padding: '2px 6px', fontSize: 12, lineHeight: 1 }}
                          title="Remove this rail"
                          onClick={() => setStairConfig(s => {
                            const hs = s.middleRailHeights ?? (s.middleRailHeight != null ? [s.middleRailHeight] : [18]);
                            return { ...s, middleRailHeights: hs.filter((_, j) => j !== i) };
                          })}
                        >×</button>
                      </div>
                    ))}
                    <button
                      className="panel-btn"
                      style={{ marginTop: 2, width: '100%' }}
                      onClick={() => setStairConfig(s => {
                        const hs = s.middleRailHeights ?? (s.middleRailHeight != null ? [s.middleRailHeight] : [18]);
                        return { ...s, middleRailHeights: [...hs, 18] };
                      })}
                    >+ Add Middle Rail</button>
                  </div>
                );
              })()}
            </div>

            {/* Rail End Extensions */}
            {topRailPathMode === 'standard' && <div style={{ marginTop: 12 }}>
              <div className="field-label-sm" style={{ marginBottom: 6 }}>Top Rail End Extensions</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="field-label-sm" style={{ flex: 1, marginBottom: 0 }}>Lower End Ext (in)</span>
                <NumericDraftInput
                  className="field-input"
                  style={{ width: 64 }}
                  value={stairConfig.railLowerExtensionIn ?? 0}
                  allowZero
                  onCommit={v => setStairConfig(s => ({ ...s, railLowerExtensionIn: Math.max(0, v) }))}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="field-label-sm" style={{ flex: 1, marginBottom: 0 }}>Upper End Ext (in)</span>
                <NumericDraftInput
                  className="field-input"
                  style={{ width: 64 }}
                  value={stairConfig.railUpperExtensionIn ?? 0}
                  allowZero
                  onCommit={v => setStairConfig(s => ({ ...s, railUpperExtensionIn: Math.max(0, v) }))}
                />
              </div>
            </div>}

            {/* Top Rail Mode switch */}
            <div style={{ marginTop: 12 }}>
              <div className="field-label-sm" style={{ marginBottom: 6 }}>Top Rail Mode</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className={`panel-btn${topRailPathMode !== 'manual' ? ' panel-btn-active' : ''}`}
                  onClick={() => onTopRailPathModeChange('standard')}
                >Standard</button>
                <button
                  className={`panel-btn${topRailPathMode === 'manual' ? ' panel-btn-active' : ''}`}
                  onClick={() => onTopRailPathModeChange('manual')}
                >Manual</button>
              </div>
            </div>

            {/* Top rail list */}
            {manualTopRails && manualTopRails.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="field-label-sm" style={{ marginBottom: 4 }}>Top Rails</div>
                {manualTopRails.map((rail, idx) => {
                  const r = normalizeRailEndpoints(rail);
                  const startFixed = r.startEndpoint.anchorType === 'fixed';
                  const endFixed = r.endEndpoint.anchorType === 'fixed';
                  const p1Idx = !startFixed && manualPosts ? manualPosts.findIndex(p => p.id === rail.startPostId) : -1;
                  const p2Idx = !endFixed && manualPosts ? manualPosts.findIndex(p => p.id === rail.endPostId) : -1;
                  const isSelected = rail.id === selectedManualTopRailId;
                  return (
                    <div key={rail.id} style={{ marginBottom: 2 }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', borderRadius: 3, padding: '2px 4px', background: isSelected ? 'rgba(37,99,235,0.08)' : undefined }}
                        onClick={() => onSelectManualTopRail(rail.id)}
                      >
                        <span style={{ fontSize: 10, color: isSelected ? 'var(--text)' : 'var(--text-dim)', flex: 1 }}>
                          TR{idx + 1} — {startFixed ? 'Fixed' : (p1Idx >= 0 ? `P${p1Idx + 1}` : '?')} to {endFixed ? 'Fixed' : (p2Idx >= 0 ? `P${p2Idx + 1}` : '?')}
                        </span>
                        <button
                          className="panel-btn panel-btn-danger"
                          style={{ padding: '2px 6px', fontSize: 10 }}
                          onClick={(e) => { e.stopPropagation(); onDeleteManualTopRail(rail.id); }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Compact Top Rail Route controls for selected rail */}
                {topRailPathMode === 'standard' && selectedManualTopRailId && (() => {
                  const sel = manualTopRails.find(r => r.id === selectedManualTopRailId);
                  if (!sel) return null;
                  const r = normalizeRailEndpoints(sel);
                  const routeSegs = Array.isArray(sel.customRouteSegments) ? sel.customRouteSegments : [];
                  const updateRoute = (segs) => onUpdateManualTopRail(sel.id, { customRouteSegments: segs });

                  const startExtLen = r.startEndpoint.extension?.type === 'straight'
                    ? Math.max(0, Number(r.startEndpoint.extension.lengthIn) || 0) : 0;
                  const endExtLen = r.endEndpoint.extension?.type === 'straight'
                    ? Math.max(0, Number(r.endEndpoint.extension.lengthIn) || 0) : 0;

                  // Compute plan (XZ) distance between posts for turn position helpers
                  let horizDistIn = 0;
                  const startPost = r.startEndpoint.anchorType === 'post'
                    ? manualPosts?.find(p => p.id === r.startEndpoint.postId) : null;
                  const endPost = r.endEndpoint.anchorType === 'post'
                    ? manualPosts?.find(p => p.id === r.endEndpoint.postId) : null;
                  if (startPost && endPost) {
                    const sp = getManualPostTop(startPost, calc.treadPositions, calc.riserHeight, stairConfig.run);
                    const ep = getManualPostTop(endPost, calc.treadPositions, calc.riserHeight, stairConfig.run);
                    if (sp && ep) {
                      horizDistIn = Math.sqrt((ep.x - sp.x) ** 2 + (ep.z - sp.z) ** 2) / INtoU;
                    }
                  }

                  const addTurn = (side) => {
                    const turn = { type: side === 'left' ? 'left90' : 'right90' };
                    if (routeSegs.length === 0 && turnPosition !== 'atEnd' && horizDistIn > 0) {
                      let straightLen = Math.round(horizDistIn);
                      if (turnPosition === 'beforePost') straightLen = Math.max(1, Math.round(horizDistIn) - 12);
                      else if (turnPosition === 'atPost') straightLen = Math.round(horizDistIn);
                      else if (turnPosition === 'afterPost') straightLen = Math.round(horizDistIn + endExtLen);
                      else if (turnPosition === 'custom') straightLen = Math.max(1, Math.min(240, customTurnDistIn));
                      updateRoute([{ type: 'straight', lengthIn: straightLen }, turn]);
                    } else {
                      updateRoute([...routeSegs, turn]);
                    }
                  };

                  return (
                    <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <div className="field-label-sm" style={{ marginBottom: 6 }}>Top Rail Route</div>

                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Start Ext (in)</div>
                      <ExtChips
                        key={`${sel.id}-start`}
                        curLen={startExtLen}
                        onSet={v => onUpdateManualTopRail(sel.id, {
                          startEndpoint: { ...r.startEndpoint, extension: v === 0 ? { type: 'none', lengthIn: 0 } : { type: 'straight', lengthIn: v } },
                        })}
                      />

                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, marginTop: 6 }}>End Ext (in)</div>
                      <ExtChips
                        key={`${sel.id}-end`}
                        curLen={endExtLen}
                        onSet={v => onUpdateManualTopRail(sel.id, {
                          endEndpoint: { ...r.endEndpoint, extension: v === 0 ? { type: 'none', lengthIn: 0 } : { type: 'straight', lengthIn: v } },
                        })}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, marginBottom: 4 }}>
                        <span className="field-label-sm" style={{ marginBottom: 0, flexShrink: 0 }}>Turn pos</span>
                        <select
                          className="field-input"
                          style={{ flex: 1, fontSize: 10 }}
                          value={turnPosition}
                          onChange={e => setTurnPosition(e.target.value)}
                        >
                          <option value="atEnd">At end</option>
                          <option value="beforePost">Before post</option>
                          <option value="atPost">At post</option>
                          <option value="afterPost">After post</option>
                          <option value="custom">Custom (in)</option>
                        </select>
                        {turnPosition === 'custom' && (
                          <NumericDraftInput
                            className="field-input"
                            style={{ width: 44, fontSize: 10 }}
                            value={customTurnDistIn}
                            onCommit={v => setCustomTurnDistIn(Math.max(1, Math.min(240, v)))}
                          />
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: routeSegs.length > 0 ? 6 : 0 }}>
                        <button className="panel-btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => addTurn('left')}>L 90°</button>
                        <button className="panel-btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => addTurn('right')}>R 90°</button>
                        <button className="panel-btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => updateRoute([...routeSegs, { type: 'straight', lengthIn: 24 }])}>+ Straight</button>
                        {routeSegs.length > 0 && (
                          <button className="panel-btn panel-btn-danger" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => updateRoute([])}>Reset</button>
                        )}
                      </div>

                      {routeSegs.map((seg, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 14, flexShrink: 0 }}>{i + 1}.</span>
                          <span style={{ fontSize: 10, color: 'var(--text)', flex: seg.type === 'straight' ? '0 0 48px' : 1 }}>
                            {seg.type === 'straight' ? 'Straight' : seg.type === 'left90' ? 'L 90°' : 'R 90°'}
                          </span>
                          {seg.type === 'straight' && (
                            <>
                              <NumericDraftInput
                                className="field-input"
                                style={{ flex: 1, fontSize: 10 }}
                                value={seg.lengthIn}
                                onCommit={v => updateRoute(routeSegs.map((s, j) => j === i ? { ...s, lengthIn: Math.max(1, Math.min(240, v)) } : s))}
                              />
                              <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>in</span>
                            </>
                          )}
                          <button
                            className="panel-btn panel-btn-danger"
                            style={{ padding: '2px 6px', fontSize: 10, flexShrink: 0 }}
                            onClick={() => updateRoute(routeSegs.filter((_, j) => j !== i))}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Dogleg controls — hidden when the route has any turn segments */}
                {topRailPathMode === 'standard' && selectedManualTopRailId && (() => {
                  const sel = manualTopRails.find(r => r.id === selectedManualTopRailId);
                  if (!sel) return null;
                  const routeSegs = Array.isArray(sel.customRouteSegments) ? sel.customRouteSegments : [];
                  if (routeSegs.some(s => s.type === 'left90' || s.type === 'right90')) return null;
                  const doglegEnabled = !!sel.doglegEnabled;
                  return (
                    <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: doglegEnabled ? 8 : 0 }}>
                        <input
                          type="checkbox"
                          checked={doglegEnabled}
                          onChange={e => onUpdateManualTopRail(sel.id, {
                            doglegEnabled: e.target.checked,
                            doglegStartIn: sel.doglegStartIn ?? 12,
                            doglegSide: sel.doglegSide ?? 'left',
                            doglegOffsetIn: sel.doglegOffsetIn ?? 6,
                          })}
                        />
                        <span className="field-label-sm" style={{ marginBottom: 0 }}>Enable 90° Dogleg</span>
                      </label>
                      {doglegEnabled && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span className="field-label-sm" style={{ flex: 1, marginBottom: 0 }}>Start dist (in)</span>
                            <NumericDraftInput
                              className="field-input"
                              style={{ width: 64 }}
                              value={sel.doglegStartIn ?? 12}
                              allowZero
                              onCommit={v => onUpdateManualTopRail(sel.id, { doglegStartIn: Math.max(0, v) })}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span className="field-label-sm" style={{ flex: 1, marginBottom: 0 }}>Side</span>
                            <button
                              className={`panel-btn${(sel.doglegSide ?? 'left') === 'left' ? ' panel-btn-active' : ''}`}
                              style={{ padding: '2px 8px', fontSize: 10 }}
                              onClick={() => onUpdateManualTopRail(sel.id, { doglegSide: 'left' })}
                            >Left</button>
                            <button
                              className={`panel-btn${sel.doglegSide === 'right' ? ' panel-btn-active' : ''}`}
                              style={{ padding: '2px 8px', fontSize: 10 }}
                              onClick={() => onUpdateManualTopRail(sel.id, { doglegSide: 'right' })}
                            >Right</button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span className="field-label-sm" style={{ flex: 1, marginBottom: 0 }}>Sideways offset (in)</span>
                            <NumericDraftInput
                              className="field-input"
                              style={{ width: 64 }}
                              value={sel.doglegOffsetIn ?? 6}
                              allowZero
                              onCommit={v => onUpdateManualTopRail(sel.id, { doglegOffsetIn: Math.max(0, v) })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Delete selected rail */}
                {selectedManualTopRailId && (
                  <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <button
                      className="panel-btn panel-btn-danger"
                      style={{ width: '100%' }}
                      onClick={() => onDeleteManualTopRail(selectedManualTopRailId)}
                    >Delete Rail</button>
                  </div>
                )}

                {/* Manual Top Rail Path */}
                {topRailPathMode === 'manual' && (
                  <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <div className="field-label-sm" style={{ marginBottom: 4 }}>Manual Top Rail Path</div>
                    {selectedManualTopRailId ? (() => {
                      const selRail = manualTopRails.find(r => r.id === selectedManualTopRailId);
                      if (!selRail) return null;
                      const r = normalizeRailEndpoints(selRail);
                      const startPostId = r.startEndpoint.anchorType === 'post' ? r.startEndpoint.postId : null;
                      const startPostIdx = startPostId ? (manualPosts?.findIndex(p => p.id === startPostId) ?? -1) : -1;
                      const segs = Array.isArray(selRail.manualSegments)
                        ? selRail.manualSegments
                        : DEFAULT_MANUAL_SEGMENTS;

                      const updateSegs = (newSegs) => onUpdateManualTopRail(selRail.id, { manualSegments: newSegs });

                      return (
                        <>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>
                            Start: {startPostIdx >= 0 ? `P${startPostIdx + 1}` : 'first post'}
                          </div>
                          {segs.map((seg, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                              <select
                                className="field-input"
                                style={{ flex: '0 0 72px', fontSize: 10, padding: '2px 4px' }}
                                value={seg.type}
                                onChange={e => {
                                  const t = e.target.value;
                                  updateSegs(segs.map((s, j) => j !== i ? s
                                    : t === 'forward'
                                      ? { type: 'forward', lengthIn: 12 }
                                      : { type: 'turn', side: 'right', angleDeg: 90 }
                                  ));
                                }}
                              >
                                <option value="forward">Forward</option>
                                <option value="turn">Turn</option>
                              </select>
                              {seg.type === 'forward' && (
                                <>
                                  <NumericDraftInput
                                    className="field-input"
                                    style={{ flex: 1, fontSize: 10 }}
                                    value={seg.lengthIn}
                                    onCommit={v => updateSegs(segs.map((s, j) => j === i ? { ...s, lengthIn: v } : s))}
                                  />
                                  <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>in</span>
                                </>
                              )}
                              {seg.type === 'turn' && (
                                <>
                                  <select
                                    className="field-input"
                                    style={{ flex: '0 0 52px', fontSize: 10, padding: '2px 4px' }}
                                    value={seg.side ?? 'right'}
                                    onChange={e => updateSegs(segs.map((s, j) => j === i ? { ...s, side: e.target.value } : s))}
                                  >
                                    <option value="left">Left</option>
                                    <option value="right">Right</option>
                                  </select>
                                  <NumericDraftInput
                                    className="field-input"
                                    style={{ flex: 1, fontSize: 10 }}
                                    value={seg.angleDeg ?? 90}
                                    onCommit={v => updateSegs(segs.map((s, j) => j === i ? { ...s, angleDeg: v } : s))}
                                  />
                                  <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>°</span>
                                </>
                              )}
                              <button
                                className="panel-btn panel-btn-danger"
                                style={{ padding: '2px 6px', fontSize: 10, flexShrink: 0 }}
                                onClick={() => updateSegs(segs.filter((_, j) => j !== i))}
                              >×</button>
                            </div>
                          ))}
                          <button
                            className="panel-btn"
                            style={{ marginTop: 4, width: '100%', fontSize: 10 }}
                            onClick={() => updateSegs([...segs, { type: 'forward', lengthIn: 12 }])}
                          >+ Add Segment</button>
                        </>
                      );
                    })() : (
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Select a Top Rail to edit its path</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selected post adjustment */}
            {(() => {
              const sel = manualPosts && manualPosts.find(p => p.id === selectedManualPostId);
              if (!sel) return null;
              const isLanding = sel.surfaceType === 'bottomLanding' || sel.surfaceType === 'topLanding';
              const landingLabel = sel.surfaceType === 'bottomLanding' ? 'Bottom Landing' : 'Top Landing';
              return (
                <div style={{ marginTop: 10 }}>
                  <div className="field-label-sm" style={{ marginBottom: 4 }}>
                    {isLanding ? `Adjust Post — ${landingLabel}` : `Adjust Post — step ${sel.stepIndex + 1} (${sel.mount})`}
                  </div>
                  {isLanding ? (
                    <>
                      <div className="post-adjust-row">
                        <button className="panel-btn" onClick={() => {
                          const newOffset = (sel.offsetXIn || 0) - 1;
                          const effectiveX = sel.xIn + newOffset;
                          const allowed = sel.surfaceType === 'bottomLanding'
                            ? effectiveX >= -calc.treadDepth
                            : effectiveX >= stairConfig.run - calc.treadDepth;
                          if (allowed) onUpdateManualPost(sel.id, { offsetXIn: newOffset });
                        }}>← Along</button>
                        <button className="panel-btn" onClick={() => {
                          const newOffset = (sel.offsetXIn || 0) + 1;
                          const effectiveX = sel.xIn + newOffset;
                          const allowed = sel.surfaceType === 'bottomLanding'
                            ? effectiveX <= 0
                            : effectiveX <= stairConfig.run;
                          if (allowed) onUpdateManualPost(sel.id, { offsetXIn: newOffset });
                        }}>Along →</button>
                      </div>
                      <div className="post-adjust-row">
                        <button className="panel-btn" onClick={() => onUpdateManualPost(sel.id, { offsetZIn: (sel.offsetZIn || 0) - 1 })}>Left</button>
                        <button className="panel-btn" onClick={() => onUpdateManualPost(sel.id, { offsetZIn: (sel.offsetZIn || 0) + 1 })}>Right</button>
                        <button className="panel-btn panel-btn-danger" onClick={() => onDeleteManualPost(sel.id)}>Delete</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="post-adjust-row">
                        <button className="panel-btn" onClick={() => onUpdateManualPost(sel.id, { offsetXIn: sel.offsetXIn - 1 })}>← Nosing</button>
                        <button className="panel-btn" onClick={() => onUpdateManualPost(sel.id, { offsetXIn: sel.offsetXIn + 1 })}>Riser →</button>
                      </div>
                      <div className="post-adjust-row">
                        <button className="panel-btn" onClick={() => onUpdateManualPost(sel.id, { offsetZIn: sel.offsetZIn - 1 })}>Left</button>
                        <button className="panel-btn" onClick={() => onUpdateManualPost(sel.id, { offsetZIn: sel.offsetZIn + 1 })}>Right</button>
                        <button className="panel-btn panel-btn-danger" onClick={() => onDeleteManualPost(sel.id)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </section>

      {/* Results */}
      <section className="panel-section">
        <h3 className="section-title">Results</h3>
        <div className="results-grid">
          <span className="result-label">Stair Angle</span>
          <span className="result-value">{fmtDeg(calc.angleDeg)}</span>
          <span className="result-label">Riser Height</span>
          <span className="result-value">{fmtUnit(calc.riserHeight, units)}</span>
          <span className="result-label">Tread Depth</span>
          <span className="result-value">{fmtUnit(calc.treadDepth, units)}</span>
          <span className="result-label">Stringer Length</span>
          <span className="result-value">{fmtUnit(calc.stringerLength, units)}</span>
        </div>
      </section>

      {/* Warnings */}
      {(errorWarnings.length > 0 || warnWarnings.length > 0) && (
        <section className="panel-section">
          <h3 className="section-title">Warnings</h3>
          <div className="warnings-list">
            {errorWarnings.map((w, i) => (
              <div key={i} className="warn-item warn-error">⛔ {w.msg}</div>
            ))}
            {warnWarnings.map((w, i) => (
              <div key={i} className="warn-item warn-warning">⚠ {w.msg}</div>
            ))}
          </div>
        </section>
      )}

      {/* Material / Cut List */}
      <section className="panel-section">
        <h3 className="section-title">Material / Cut List</h3>
        <table className="cut-table">
          <thead>
            <tr>
              <th>Part</th>
              <th>Qty</th>
              <th>Length ({units === 'mm' ? 'mm' : 'in'})</th>
              <th>Profile</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((item, i) => (
              <tr key={i}>
                <td>{item.part}</td>
                <td>{item.qty}</td>
                <td>{units === 'mm' ? (parseFloat(item.lengthIn) * INCH_TO_MM).toFixed(1) : item.lengthIn}</td>
                <td>{item.profile}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Objects */}
      <section className="panel-section">
        <h3 className="section-title">Objects</h3>
        <div className="objects-list">
          <div className="obj-item obj-item-active">🪜 Stair 1</div>
          {stairConfig.railingEnabled && (
            <div className="obj-item">⊟ Railing 1</div>
          )}
        </div>
      </section>

      {/* Railing Position Move */}
      <section className="panel-section">
        <h3 className="section-title">Railing Position</h3>
        <button
          className={`panel-btn${structureMoveSelected ? ' panel-btn-active' : ''}`}
          style={{ width: '100%', marginBottom: 6 }}
          onClick={onToggleStructureMove}
        >
          {structureMoveSelected ? 'Railing Selected' : 'Select Railing'}
        </button>
        {structureMoveSelected && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
              <button className="panel-btn" style={{ minWidth: 64 }} onClick={onMoveForward}>Forward</button>
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 4 }}>
              <button className="panel-btn" style={{ minWidth: 52 }} onClick={onMoveLeft}>Left</button>
              <button className="panel-btn" style={{ minWidth: 52 }} onClick={onResetStructureOffset}>Reset</button>
              <button className="panel-btn" style={{ minWidth: 52 }} onClick={onMoveRight}>Right</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <button className="panel-btn" style={{ minWidth: 64 }} onClick={onMoveBack}>Back</button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center' }}>
              Offset: X {structureOffsetXIn} in / Z {structureOffsetZIn} in
            </div>
          </div>
        )}
      </section>

      {/* PDF Output */}
      <section className="panel-section">
        <h3 className="section-title">PDF Output</h3>
        <p className="field-label" style={{ marginBottom: 8, lineHeight: '1.4' }}>
          Includes stair views, dimensions, and results.
        </p>
        <button className="panel-btn panel-btn-primary" style={{ width: '100%' }} onClick={onExportPdf}>
          Export PDF
        </button>
      </section>

    </aside>
  );
}
