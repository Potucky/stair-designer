import { useState, useRef } from 'react';

const PROFILE_SIZES = (() => {
  const steps = [1, 1.5, 2, 2.5, 3, 3.5, 4];
  const sizes = [];
  for (const w of steps) {
    for (const h of steps) sizes.push(`${w}x${h}`);
  }
  return sizes;
})();
import { formatDimensionByUnit, parseDimensionByUnit } from '../utils/units.js';

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

function StepRangeChipInput({ value, onCommit }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const cancelRef = useRef(false);
  const valueAtFocusRef = useRef(null);

  const parseRange = (raw) => {
    const trimmed = raw.trim().replace(/\s+to\s+/i, '-').replace(/\s/g, '');
    const m = trimmed.match(/^(\d+)-(\d+)$/);
    if (!m) return null;
    let start = Math.max(1, parseInt(m[1], 10));
    let end = Math.min(99, parseInt(m[2], 10));
    if (end < 2) end = 2;
    if (start >= end) return null;
    return `${start}-${end}`;
  };

  const handleFocus = (e) => {
    cancelRef.current = false;
    valueAtFocusRef.current = value;
    setDraft(value);
    setFocused(true);
    requestAnimationFrame(() => { e.target.select(); });
  };

  const handleBlur = () => {
    if (!cancelRef.current) {
      const result = parseRange(draft);
      onCommit(result ?? valueAtFocusRef.current ?? '1-6');
    } else {
      onCommit(valueAtFocusRef.current ?? '1-6');
    }
    cancelRef.current = false;
    setFocused(false);
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur();
    else if (e.key === 'Escape') { cancelRef.current = true; e.target.blur(); }
  };

  return (
    <input
      className="chip-label step-range-chip-input"
      type="text"
      value={focused ? draft : `Step ${value}`}
      onChange={e => setDraft(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

// Editable field for inch/mm dimension values. Displays formatted fractions or mm.
// Parses user input on blur/Enter; does not reformat on every keystroke.
function DimensionDraftInput({ value, onCommit, units, className, style, allowZero = false }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const cancelRef = useRef(false);
  const valueAtFocusRef = useRef(null);

  const display = formatDimensionByUnit(value, units);

  const handleFocus = (e) => {
    cancelRef.current = false;
    valueAtFocusRef.current = value;
    const str = display !== '—' ? display : '';
    setDraft(str);
    setFocused(true);
    const el = e.target;
    requestAnimationFrame(() => { el.select(); });
  };

  const handleChange = (e) => { setDraft(e.target.value); };

  const handleBlur = () => {
    if (!cancelRef.current) {
      const v = parseDimensionByUnit(draft, units);
      if (v !== null && (allowZero ? v >= 0 : v > 0)) {
        onCommit(v);
      } else {
        onCommit(valueAtFocusRef.current);
      }
    } else {
      onCommit(valueAtFocusRef.current);
    }
    cancelRef.current = false;
    setFocused(false);
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur();
    else if (e.key === 'Escape') { cancelRef.current = true; e.target.blur(); }
  };

  return (
    <input
      className={className}
      style={style}
      type="text"
      value={focused ? draft : display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

export default function RightPanel({ project, setProject, stairConfig, setStairConfig, calc, onNewProject, onSaveProject, onOpenProject, units, compactPostTarget, onToggleCompactPostPlacement, activePdfDraftMode, pdfDrafts, selectedPdfDraftDimensionId, onUpdatePdfDraftDimension, onDeletePdfDraftDimension, onDeleteLastPdfDraftDimension, onClearAllPdfDraftDimensions, projectMode, iMeasureConfig, onIMeasureConfigChange }) {
  const [saveStatus, setSaveStatus] = useState(null);
  const [measureQtyDraft, setMeasureQtyDraft] = useState('');
  const [measureQtyFocused, setMeasureQtyFocused] = useState(false);

  const str = (field) => (e) => setProject((p) => ({ ...p, [field]: e.target.value }));

  const commitDim = (field) => (v) =>
    setStairConfig((s) => ({ ...s, [field]: v }));

  const commitSteps = (v) =>
    setStairConfig((s) => ({ ...s, steps: Math.max(1, Math.round(v)) }));

  const threeDDims = pdfDrafts?.threeD?.dimensions ?? [];
  const selectedDim = selectedPdfDraftDimensionId
    ? threeDDims.find(d => d.id === selectedPdfDraftDimensionId)
    : null;

  const commitIMeasure = (field) => (v) =>
    onIMeasureConfigChange((cfg) => ({ ...cfg, [field]: v }));

  // Railing controls are shared between iBuild and iMeasure — route reads/writes by mode.
  const railingConfig = projectMode === 'measure' ? iMeasureConfig : stairConfig;
  const setRailingConfig = projectMode === 'measure' ? onIMeasureConfigChange : setStairConfig;

  return (
    <aside className="right-panel">

      {/* 3D PDF Annotations — visible only while 3D PDF mode is active */}
      {activePdfDraftMode === '3d' && (
        <section className="panel-section" style={{ borderBottom: '2px solid #2563eb', background: '#f0f5ff' }}>
          <h3 className="section-title" style={{ color: '#1d4ed8' }}>3D PDF Annotations</h3>

          {selectedDim ? (
            <>
              <label className="field-label" style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: '#1e3a5f' }}>Label / Value</span>
                <input
                  className="field-input"
                  value={selectedDim.label ?? ''}
                  onChange={e => onUpdatePdfDraftDimension(selectedDim.id, { label: e.target.value })}
                  placeholder='e.g. 36" or 72 1/2"'
                  autoFocus
                />
              </label>
              <button
                className="panel-btn panel-btn-danger"
                style={{ width: '100%', marginBottom: 6 }}
                onClick={() => onDeletePdfDraftDimension(selectedDim.id)}
              >
                Delete Selected Dimension
              </button>
            </>
          ) : (
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, lineHeight: '1.4' }}>
              {threeDDims.length > 0
                ? 'Click a dimension line to select it and edit its label.'
                : 'Double-click point A, then point B to add a dimension.'}
            </p>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className="panel-btn"
              onClick={onDeleteLastPdfDraftDimension}
              disabled={threeDDims.length === 0}
            >
              Delete Last
            </button>
            <button
              className="panel-btn panel-btn-danger"
              onClick={onClearAllPdfDraftDimensions}
              disabled={threeDDims.length === 0}
            >
              Clear All
            </button>
          </div>
          {threeDDims.length > 0 && (
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 5 }}>
              {threeDDims.length} dimension{threeDDims.length !== 1 ? 's' : ''}
            </div>
          )}
        </section>
      )}

      {/* Project */}
      <section className="panel-section">
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
        </div>
        <div className="project-label-grid">
          <span className="chip-label">Project Name</span>
          <input className="field-input" value={project.name} onChange={str('name')} placeholder="My Stair Project" />
          <span className="chip-label">Client Name</span>
          <input className="field-input" value={project.client} onChange={str('client')} placeholder="Client" />
        </div>
      </section>

      {projectMode === 'measure' && (
        <section className="panel-section">
          <div className="im-grid">
            {/* Row 1: Angle | Post C-C */}
            <span className="chip-label">Angle</span>
            <NumericDraftInput
              className="field-input"
              inputMode="decimal"
              value={iMeasureConfig?.angleDeg ?? 0}
              onCommit={commitIMeasure('angleDeg')}
            />
            <span className="chip-label">Post C-C</span>
            <DimensionDraftInput
              className="field-input"
              units={units}
              value={iMeasureConfig?.postCenterDistanceIn ?? 0}
              onCommit={commitIMeasure('postCenterDistanceIn')}
            />

            {/* Row 2: Height | Step Range chip | Step Distance */}
            <span className="chip-label">Height</span>
            <DimensionDraftInput
              className="field-input"
              units={units}
              value={iMeasureConfig?.overallHeightIn ?? 36}
              onCommit={commitIMeasure('overallHeightIn')}
            />
            <StepRangeChipInput
              value={iMeasureConfig?.stepSizeRangeText ?? ''}
              onCommit={commitIMeasure('stepSizeRangeText')}
            />
            <DimensionDraftInput
              className="field-input"
              units={units}
              allowZero={true}
              value={iMeasureConfig?.stepSizeDistanceIn ?? 0}
              onCommit={commitIMeasure('stepSizeDistanceIn')}
            />

            {/* Row 3: BC Low | BC Height */}
            <span className="chip-label">BC Low</span>
            <DimensionDraftInput
              className="field-input"
              units={units}
              value={iMeasureConfig?.bcLowP1In ?? 0}
              onCommit={commitIMeasure('bcLowP1In')}
            />
            <span className="chip-label">BC Height</span>
            <DimensionDraftInput
              className="field-input"
              units={units}
              value={iMeasureConfig?.bcHeightIn ?? 0}
              onCommit={commitIMeasure('bcHeightIn')}
            />

            {/* Row 4: Horizontal | Vertical (read-only calculated) */}
            <span className="chip-label">Horizontal</span>
            <span className="field-input im-value-preview">
              {formatDimensionByUnit((iMeasureConfig?.postCenterDistanceIn ?? 0) * Math.cos((iMeasureConfig?.angleDeg ?? 0) * Math.PI / 180), units)}
            </span>
            <span className="chip-label">Vertical</span>
            <span className="field-input im-value-preview">
              {formatDimensionByUnit((iMeasureConfig?.postCenterDistanceIn ?? 0) * Math.sin((iMeasureConfig?.angleDeg ?? 0) * Math.PI / 180), units)}
            </span>

          </div>
        </section>
      )}

      {/* Section 1: Stair Setup */}
      <section className="panel-section">
        <div className="stair-kv-row">
          <span className="chip-label">Quantity Step</span>
          {projectMode === 'measure' ? (
            <input
              className="field-input"
              inputMode="numeric"
              value={measureQtyFocused ? measureQtyDraft : (iMeasureConfig?.quantityStep > 0 ? String(iMeasureConfig.quantityStep) : '')}
              onFocus={() => {
                setMeasureQtyDraft(iMeasureConfig?.quantityStep > 0 ? String(iMeasureConfig.quantityStep) : '');
                setMeasureQtyFocused(true);
              }}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                setMeasureQtyDraft(raw);
                const v = parseInt(raw, 10);
                onIMeasureConfigChange(cfg => ({ ...cfg, quantityStep: (Number.isFinite(v) && v > 0) ? v : 0 }));
              }}
              onBlur={() => setMeasureQtyFocused(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            />
          ) : (
            <NumericDraftInput className="field-input" inputMode="numeric" integer={true} value={stairConfig.steps} onCommit={commitSteps} />
          )}
          <button
            className={`panel-btn${(railingConfig.railingSideMode ?? 'left') === 'left' ? ' panel-btn-active' : ''}`}
            onClick={() => setRailingConfig(s => ({ ...s, railingSideMode: 'left' }))}
          >Left</button>
        </div>
        <div className="stair-kv-row">
          <span className="chip-label">Step Width</span>
          {projectMode === 'measure' ? (
            <DimensionDraftInput className="field-input" units={units} value={iMeasureConfig?.stepWidthIn ?? 48} onCommit={commitIMeasure('stepWidthIn')} />
          ) : (
            <DimensionDraftInput className="field-input" units={units} value={stairConfig.width} onCommit={commitDim('width')} />
          )}
          <button
            className={`panel-btn${(railingConfig.railingSideMode ?? 'left') === 'right' ? ' panel-btn-active' : ''}`}
            onClick={() => setRailingConfig(s => ({ ...s, railingSideMode: 'right' }))}
          >Right</button>
        </div>
        <div className="stair-kv-row">
          <span className="chip-label" style={projectMode === 'measure' ? { opacity: 0.45 } : {}}>Step Height</span>
          <DimensionDraftInput className="field-input" style={projectMode === 'measure' ? { opacity: 0.45, pointerEvents: 'none' } : {}} units={units} value={calc.riserHeight} onCommit={v => setStairConfig(s => ({ ...s, height: v * s.steps }))} />
          <button
            className={`panel-btn${(railingConfig.railingColorMode ?? 'color') !== 'black' ? ' panel-btn-active' : ''}`}
            onClick={() => setRailingConfig(s => ({ ...s, railingColorMode: 'color' }))}
          >Color</button>
        </div>
        <div className="stair-kv-row">
          <span className="chip-label" style={projectMode === 'measure' ? { opacity: 0.45 } : {}}>Step Length</span>
          <DimensionDraftInput className="field-input" style={projectMode === 'measure' ? { opacity: 0.45, pointerEvents: 'none' } : {}} units={units} value={calc.treadDepth} onCommit={v => setStairConfig(s => ({ ...s, run: v * s.steps }))} />
          <button
            className={`panel-btn${(railingConfig.railingColorMode ?? 'color') === 'black' ? ' panel-btn-active' : ''}`}
            onClick={() => setRailingConfig(s => ({ ...s, railingColorMode: 'black' }))}
          >Black</button>
        </div>

        <div className="stair-kv-row">
          <span className="chip-label">Top Landing</span>
          {projectMode === 'measure' ? (
            <DimensionDraftInput className="field-input" units={units} allowZero value={iMeasureConfig?.topLandingWidthIn ?? 0} onCommit={commitIMeasure('topLandingWidthIn')} />
          ) : (
            <DimensionDraftInput className="field-input" units={units} value={stairConfig.topLandingLength ?? 36} onCommit={commitDim('topLandingLength')} />
          )}
          {projectMode === 'measure' ? (
            <DimensionDraftInput className="field-input" units={units} value={iMeasureConfig?.topLandingLengthIn ?? 36} onCommit={commitIMeasure('topLandingLengthIn')} />
          ) : (
            <DimensionDraftInput className="field-input" units={units} value={stairConfig.topLandingWidth ?? stairConfig.width} onCommit={commitDim('topLandingWidth')} />
          )}
        </div>
      </section>

      {/* Section: Railing Components */}
      <section className="panel-section">
        <div>
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${compactPostTarget === 1 ? ' chip-label-active' : ''}`}
            title={compactPostTarget === 1 ? 'Cancel Post 1 placement' : 'Click to place Post 1 on any step or landing'}
            onClick={() => onToggleCompactPostPlacement(1)}
          >Post 1</button>
          <DimensionDraftInput className="field-input" units={units} value={railingConfig.post1HeightIn ?? 36} onCommit={v => setRailingConfig(s => ({ ...s, post1HeightIn: v }))} />
          <select className="field-input" value={railingConfig.post1Section ?? '2x2'} onChange={e => setRailingConfig(s => ({ ...s, post1Section: e.target.value }))}>
            {PROFILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
          <select className="field-input" value={railingConfig.post1Thickness ?? '1.8'} onChange={e => setRailingConfig(s => ({ ...s, post1Thickness: e.target.value }))}>
            <option value="1.8">1.8</option>
            <option value="1.4">1.4</option>
          </select>
        </div>
        {compactPostTarget === 1 && (
          <div className="post-tool-hint">Post 1 placement active — click a step or landing to place</div>
        )}
        </div>
        <div>
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${compactPostTarget === 2 ? ' chip-label-active' : ''}`}
            title={compactPostTarget === 2 ? 'Cancel Post 2 placement' : 'Click to place Post 2 on any step or landing'}
            onClick={() => onToggleCompactPostPlacement(2)}
          >Post 2</button>
          <DimensionDraftInput className="field-input" units={units} value={railingConfig.post2HeightIn ?? 36} onCommit={v => setRailingConfig(s => ({ ...s, post2HeightIn: v }))} />
          <select className="field-input" value={railingConfig.post2Section ?? '2x2'} onChange={e => setRailingConfig(s => ({ ...s, post2Section: e.target.value }))}>
            {PROFILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
          <select className="field-input" value={railingConfig.post2Thickness ?? '1.8'} onChange={e => setRailingConfig(s => ({ ...s, post2Thickness: e.target.value }))}>
            <option value="1.8">1.8</option>
            <option value="1.4">1.4</option>
          </select>
        </div>
        {compactPostTarget === 2 && (
          <div className="post-tool-hint">Post 2 placement active — click a step or landing to place</div>
        )}
        </div>
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${(railingConfig.compactTopHandrailEnabled ?? true) ? ' chip-label-active' : ''}`}
            onClick={() => setRailingConfig(s => ({ ...s, compactTopHandrailEnabled: !(s.compactTopHandrailEnabled ?? true) }))}
          >Top Handrail</button>
          <div className="rc-empty-cell" />
          <select className="field-input" value={railingConfig.handrailSection ?? '2x1'} onChange={e => setRailingConfig(s => ({ ...s, handrailSection: e.target.value }))}>
            {PROFILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
          <select className="field-input" value={railingConfig.handrailThickness ?? '1.8'} onChange={e => setRailingConfig(s => ({ ...s, handrailThickness: e.target.value }))}>
            <option value="1.8">1.8</option>
            <option value="1.4">1.4</option>
          </select>
        </div>
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${(railingConfig.compactBottomChannelEnabled ?? true) ? ' chip-label-active' : ''}`}
            onClick={() => setRailingConfig(s => ({ ...s, compactBottomChannelEnabled: !(s.compactBottomChannelEnabled ?? true) }))}
          >Bottom Channel</button>
          <div className="rc-empty-cell" />
          <select className="field-input" value={railingConfig.bottomChannelSection ?? '2x1'} onChange={e => setRailingConfig(s => ({ ...s, bottomChannelSection: e.target.value }))}>
            {PROFILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
          <select className="field-input" value={railingConfig.bottomChannelThickness ?? '1.8'} onChange={e => setRailingConfig(s => ({ ...s, bottomChannelThickness: e.target.value }))}>
            <option value="1.8">1.8</option>
            <option value="1.4">1.4</option>
          </select>
        </div>
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${(railingConfig.infillType ?? 'none') === 'vertical' ? ' chip-label-active' : ''}`}
            onClick={() => setRailingConfig(s => ({ ...s, infillType: 'vertical' }))}
          >Picket Vertica</button>
          <div className="rc-empty-cell" />
          <select className="field-input" value={railingConfig.picketVerticalSection ?? '1x1'} onChange={e => setRailingConfig(s => ({ ...s, picketVerticalSection: e.target.value }))}>
            {PROFILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
          <select className="field-input" value={railingConfig.picketVerticalThickness ?? '1.8'} onChange={e => setRailingConfig(s => ({ ...s, picketVerticalThickness: e.target.value }))}>
            <option value="1.8">1.8</option>
            <option value="1.4">1.4</option>
          </select>
        </div>
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${(railingConfig.infillType ?? 'none') === 'horizontalPicket' ? ' chip-label-active' : ''}`}
            onClick={() => setRailingConfig(s => ({ ...s, infillType: 'horizontalPicket' }))}
          >Picket Horizon</button>
          <div className="rc-empty-cell" />
          <select className="field-input" value={railingConfig.picketHorizontalSection ?? '1x1'} onChange={e => setRailingConfig(s => ({ ...s, picketHorizontalSection: e.target.value }))}>
            {PROFILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
          <select className="field-input" value={railingConfig.picketHorizontalThickness ?? '1.8'} onChange={e => setRailingConfig(s => ({ ...s, picketHorizontalThickness: e.target.value }))}>
            <option value="1.8">1.8</option>
            <option value="1.4">1.4</option>
          </select>
        </div>
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${(railingConfig.infillType ?? 'none') === 'horizontalCable' ? ' chip-label-active' : ''}`}
            onClick={() => setRailingConfig(s => ({ ...s, infillType: 'horizontalCable' }))}
          >Cable Horizon</button>
          <div className="rc-empty-cell" />
          <select className="field-input" value={railingConfig.cableSize ?? '1/8'} onChange={e => setRailingConfig(s => ({ ...s, cableSize: e.target.value }))}>
            <option value="1/8">1/8</option>
          </select>
          <select className="field-input" value={railingConfig.cableFinish ?? 'Black'} onChange={e => setRailingConfig(s => ({ ...s, cableFinish: e.target.value }))}>
            <option value="Black">Black</option>
            <option value="Chrome">Chrome</option>
          </select>
        </div>
        <div className="rc-comp-row-ext">
          <span className="chip-label">Lower End</span>
          <DimensionDraftInput
            className="field-input"
            units={units}
            value={stairConfig.railLowerExtensionIn ?? 0}
            allowZero
            onCommit={v => setStairConfig(s => ({ ...s, railLowerExtensionIn: Math.max(0, v) }))}
          />
          <span className="chip-label">Upper End</span>
          <DimensionDraftInput
            className="field-input"
            units={units}
            value={stairConfig.railUpperExtensionIn ?? 0}
            allowZero
            onCommit={v => setStairConfig(s => ({ ...s, railUpperExtensionIn: Math.max(0, v) }))}
          />
        </div>
      </section>

    </aside>
  );
}
