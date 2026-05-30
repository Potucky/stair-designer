import { useState } from 'react';
import { TUBE_SIZES } from '../data/materialProfiles.js';
import { fmtIn, fmtDeg, fmt2 } from '../utils/format.js';

export default function RightPanel({ project, setProject, stairConfig, setStairConfig, calc, warnings, materials, onSaveProject }) {
  const [saveStatus, setSaveStatus] = useState(null);

  const num = (field, min, max) => (e) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) setStairConfig((s) => ({ ...s, [field]: Math.min(max, Math.max(min, v)) }));
  };

  const str = (field) => (e) => setProject((p) => ({ ...p, [field]: e.target.value }));
  const toggle = (field) => (e) => setStairConfig((s) => ({ ...s, [field]: e.target.checked }));
  const sel = (field) => (e) => setStairConfig((s) => ({ ...s, [field]: e.target.value }));

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
          <span className="field-value-sm">Inches (Imperial)</span>
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

      {/* Selected Object */}
      <section className="panel-section">
        <h3 className="section-title">Selected Object — Stair 1</h3>

        <label className="field-label">Total Height (in)
          <input className="field-input" type="number" min="12" max="240" step="0.5"
            value={stairConfig.height} onChange={num('height', 12, 240)} />
        </label>
        <label className="field-label">Total Run (in)
          <input className="field-input" type="number" min="12" max="480" step="0.5"
            value={stairConfig.run} onChange={num('run', 12, 480)} />
        </label>
        <label className="field-label">Width (in)
          <input className="field-input" type="number" min="12" max="144" step="0.5"
            value={stairConfig.width} onChange={num('width', 12, 144)} />
        </label>
        <label className="field-label">Number of Steps
          <input className="field-input" type="number" min="1" max="60" step="1"
            value={stairConfig.steps} onChange={num('steps', 1, 60)} />
        </label>
        <label className="field-label">Tube Size
          <select className="field-input" value={stairConfig.tubeSize} onChange={sel('tubeSize')}>
            {TUBE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="field-label field-checkbox">
          <input type="checkbox" checked={stairConfig.railingEnabled} onChange={toggle('railingEnabled')} />
          <span>Railing Enabled</span>
        </label>

        {stairConfig.railingEnabled && (
          <>
            <label className="field-label">Handrail Height (in)
              <input className="field-input" type="number" min="30" max="48" step="0.5"
                value={stairConfig.handrailHeight} onChange={num('handrailHeight', 30, 48)} />
            </label>
            <label className="field-label">Guard/Pin Opening (in)
              <input className="field-input" type="number" min="1" max="6" step="0.125"
                value={stairConfig.pinOpening} onChange={num('pinOpening', 1, 6)} />
            </label>
            <label className="field-label">Post Spacing (in)
              <input className="field-input" type="number" min="12" max="96" step="1"
                value={stairConfig.postSpacing} onChange={num('postSpacing', 12, 96)} />
            </label>
          </>
        )}
      </section>

      {/* Results */}
      <section className="panel-section">
        <h3 className="section-title">Results</h3>
        <div className="results-grid">
          <span className="result-label">Angle</span>
          <span className="result-value">{fmtDeg(calc.angleDeg)}</span>
          <span className="result-label">Riser Height</span>
          <span className="result-value">{fmtIn(calc.riserHeight)}</span>
          <span className="result-label">Tread Depth</span>
          <span className="result-value">{fmtIn(calc.treadDepth)}</span>
          <span className="result-label">Stringer Length</span>
          <span className="result-value">{fmtIn(calc.stringerLength)}</span>
          {stairConfig.railingEnabled && (
            <>
              <span className="result-label">Post Count</span>
              <span className="result-value">{calc.postCount}</span>
              <span className="result-label">Handrail Length</span>
              <span className="result-value">{fmtIn(calc.handrailLength)}</span>
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
              <th>Length"</th>
              <th>Profile</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((item, i) => (
              <tr key={i}>
                <td>{item.part}</td>
                <td>{item.qty}</td>
                <td>{item.lengthIn}</td>
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

    </aside>
  );
}
