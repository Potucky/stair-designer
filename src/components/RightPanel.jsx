import { useState, useRef } from 'react';
import { TUBE_SIZES } from '../data/materialProfiles.js';
import { fmtDeg, fmtUnit, INCH_TO_MM } from '../utils/format.js';

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

export default function RightPanel({ project, setProject, stairConfig, setStairConfig, calc, warnings, materials, onSaveProject, onExportPdf, units }) {
  const [saveStatus, setSaveStatus] = useState(null);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [newPostStep, setNewPostStep] = useState(1);
  const [newPostSide, setNewPostSide] = useState('left');

  const str = (field) => (e) => setProject((p) => ({ ...p, [field]: e.target.value }));
  const toggle = (field) => (e) => setStairConfig((s) => ({ ...s, [field]: e.target.checked }));
  const sel = (field) => (e) => setStairConfig((s) => ({ ...s, [field]: e.target.value }));

  const commitDim = (field) => (v) =>
    setStairConfig((s) => ({ ...s, [field]: v }));

  const commitSteps = (v) =>
    setStairConfig((s) => ({ ...s, steps: Math.max(1, Math.round(v)) }));

  const addPost = () => {
    const si = Math.max(1, Math.min(newPostStep, stairConfig.steps));
    const id = crypto.randomUUID();
    setStairConfig((s) => ({
      ...s,
      manualPosts: [...(s.manualPosts ?? []), {
        id,
        stepIndex: si,
        side: newPostSide,
        offsetXIn: 0,
        offsetZIn: 0,
        heightIn: s.handrailHeight,
      }],
    }));
    setSelectedPostId(id);
  };

  const deletePost = (id) => {
    setStairConfig((s) => ({ ...s, manualPosts: (s.manualPosts ?? []).filter((p) => p.id !== id) }));
    setSelectedPostId((prev) => (prev === id ? null : prev));
  };

  const nudgePost = (field, delta) => {
    setStairConfig((s) => ({
      ...s,
      manualPosts: (s.manualPosts ?? []).map((p) =>
        p.id === selectedPostId ? { ...p, [field]: p[field] + delta } : p
      ),
    }));
  };

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
            <label className="field-label">Post Spacing (in)
              <NumericDraftInput className="field-input" value={stairConfig.postSpacing} onCommit={commitDim('postSpacing')} />
            </label>

            {/* Posts — manual post placement, first step of railing assembly */}
            <div style={{ marginTop: 12 }}>
              <div className="field-label-sm" style={{ marginBottom: 6 }}>Posts</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11 }}>Step</span>
                <input
                  type="number"
                  className="field-input"
                  style={{ width: 48 }}
                  min={1}
                  max={stairConfig.steps}
                  value={newPostStep}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setNewPostStep(Math.max(1, Math.min(stairConfig.steps, v)));
                  }}
                />
                <select
                  className="field-input"
                  style={{ width: 80 }}
                  value={newPostSide}
                  onChange={(e) => setNewPostSide(e.target.value)}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
                <button className="panel-btn" onClick={addPost}>+ Add</button>
              </div>
              {(stairConfig.manualPosts ?? []).length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  {(stairConfig.manualPosts ?? []).map((post, idx) => (
                    <div
                      key={post.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '3px 5px',
                        marginBottom: 2,
                        background: selectedPostId === post.id ? '#1e3a5f' : '#f0f4f8',
                        color: selectedPostId === post.id ? '#fff' : '#374151',
                        cursor: 'pointer',
                        borderRadius: 3,
                        fontSize: 11,
                      }}
                      onClick={() => setSelectedPostId(post.id === selectedPostId ? null : post.id)}
                    >
                      Post {idx + 1} — Step {post.stepIndex} — {post.side.charAt(0).toUpperCase() + post.side.slice(1)}
                    </div>
                  ))}
                </div>
              )}
              {selectedPostId && (
                <div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                    <button className="panel-btn" onClick={() => nudgePost('offsetXIn', -1)}>Run −1"</button>
                    <button className="panel-btn" onClick={() => nudgePost('offsetXIn', 1)}>Run +1"</button>
                    <button className="panel-btn" onClick={() => nudgePost('offsetZIn', -1)}>Width −1"</button>
                    <button className="panel-btn" onClick={() => nudgePost('offsetZIn', 1)}>Width +1"</button>
                  </div>
                  <button className="panel-btn" style={{ color: '#dc2626' }} onClick={() => deletePost(selectedPostId)}>Delete</button>
                </div>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="field-label-sm" style={{ marginBottom: 6 }}>Coming Soon</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="panel-btn" disabled title="Coming soon">Top Rail</button>
                <button className="panel-btn" disabled title="Coming soon">Bottom Rail</button>
                <button className="panel-btn" disabled title="Coming soon">Bridges</button>
              </div>
            </div>
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
          {stairConfig.railingEnabled && (
            <>
              <span className="result-label">Post Count</span>
              <span className="result-value">{calc.postCount}</span>
              <span className="result-label">Handrail Length</span>
              <span className="result-value">{fmtUnit(calc.handrailLength, units)}</span>
            </>
          )}
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
