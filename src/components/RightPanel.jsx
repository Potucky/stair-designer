import { useState, useRef } from 'react';
import { TUBE_SIZES } from '../data/materialProfiles.js';
import { fmtDeg, fmtUnit, INCH_TO_MM } from '../utils/format.js';
import { normalizeRailEndpoints } from '../geometry/railingGeometry.js';

function NumericDraftInput({ value, onCommit, className, inputMode = 'decimal', integer = false }) {
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
    return Number.isFinite(v) && v > 0 ? v : null;
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
          if (Number.isFinite(v) && v >= 1) onSet(Math.min(50, v));
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

export default function RightPanel({ project, setProject, stairConfig, setStairConfig, calc, warnings, materials, onSaveProject, onExportPdf, units, manualPosts, postPlacementMode, onTogglePostPlacement, selectedManualPostId, onUpdateManualPost, onDeleteManualPost, topRailMode, onToggleTopRailMode, topRailFirstPostId, manualTopRails, onDeleteManualTopRail, selectedManualTopRailId, onSelectManualTopRail, onUpdateManualTopRail }) {
  const [saveStatus, setSaveStatus] = useState(null);

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
                <button className="panel-btn" disabled title="Coming soon">Bottom Rail</button>
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

                {/* Endpoint extension controls for selected rail */}
                {selectedManualTopRailId && (() => {
                  const sel = manualTopRails.find(r => r.id === selectedManualTopRailId);
                  if (!sel) return null;
                  const r = normalizeRailEndpoints(sel);

                  const setExt = (which, lengthIn) => {
                    const ep = r[`${which}Endpoint`];
                    onUpdateManualTopRail(sel.id, {
                      [`${which}Endpoint`]: {
                        ...ep,
                        extension: lengthIn === 0
                          ? { type: 'none', lengthIn: 0 }
                          : { type: 'straight', lengthIn },
                      },
                    });
                  };

                  return (
                    <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <div className="field-label-sm" style={{ marginBottom: 6 }}>Endpoint Extensions</div>
                      {['start', 'end'].map(which => {
                        const ep = r[`${which}Endpoint`];
                        const isFixed = ep.anchorType === 'fixed';
                        const curLen = ep.extension?.type === 'none' ? 0 : (Number(ep.extension?.lengthIn) || 0);
                        return (
                          <div key={which} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                              {which === 'start' ? 'Start' : 'End'}{isFixed ? ' — Fixed/Detached' : ''}
                            </div>
                            <ExtChips
                              key={`${sel.id}-${which}`}
                              curLen={curLen}
                              onSet={(v) => setExt(which, v)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Selected post adjustment */}
            {(() => {
              const sel = manualPosts && manualPosts.find(p => p.id === selectedManualPostId);
              if (!sel) return null;
              return (
                <div style={{ marginTop: 10 }}>
                  <div className="field-label-sm" style={{ marginBottom: 4 }}>
                    Adjust Post — step {sel.stepIndex + 1} ({sel.mount})
                  </div>
                  <div className="post-adjust-row">
                    <button className="panel-btn" onClick={() => onUpdateManualPost(sel.id, { offsetXIn: sel.offsetXIn - 1 })}>← Nosing</button>
                    <button className="panel-btn" onClick={() => onUpdateManualPost(sel.id, { offsetXIn: sel.offsetXIn + 1 })}>Riser →</button>
                  </div>
                  <div className="post-adjust-row">
                    <button className="panel-btn" onClick={() => onUpdateManualPost(sel.id, { offsetZIn: sel.offsetZIn - 1 })}>Left</button>
                    <button className="panel-btn" onClick={() => onUpdateManualPost(sel.id, { offsetZIn: sel.offsetZIn + 1 })}>Right</button>
                    <button className="panel-btn panel-btn-danger" onClick={() => onDeleteManualPost(sel.id)}>Delete</button>
                  </div>
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
