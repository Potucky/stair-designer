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

export default function RightPanel({ project, setProject, stairConfig, setStairConfig, calc, warnings, materials, onNewProject, onSaveProject, onOpenProject, onExportPdf, units, activeTool, manualDimensions, onUpdateManualDimension, onDeleteManualDimension, manualPosts, postPlacementMode, onTogglePostPlacement, compactPostTarget, onToggleCompactPostPlacement, selectedManualPostId, onUpdateManualPost, onDeleteManualPost, topRailMode, onToggleTopRailMode, topRailFirstPostId, manualTopRails, onDeleteManualTopRail, selectedManualTopRailId, onSelectManualTopRail, onUpdateManualTopRail, topRailPathMode, onTopRailPathModeChange, structureMoveSelected, onToggleStructureMove, onMoveForward, onMoveBack, onMoveLeft, onMoveRight, onResetStructureOffset, structureOffsetXIn, structureOffsetZIn, fastRailsMode, fastRailsPrevPostId, onToggleFastRailsMode, manualTextAnnotations, onUpdateManualTextAnnotation, onDeleteManualTextAnnotation, pdfMirrored, onTogglePdfMirrored, activePdfDraftMode, pdfDrafts, selectedPdfDraftDimensionId, onUpdatePdfDraftDimension, onDeletePdfDraftDimension, onDeleteLastPdfDraftDimension, onClearAllPdfDraftDimensions }) {
  const [saveStatus, setSaveStatus] = useState(null);

  const str = (field) => (e) => setProject((p) => ({ ...p, [field]: e.target.value }));
  const toggle = (field) => (e) => setStairConfig((s) => ({ ...s, [field]: e.target.checked }));
  const sel = (field) => (e) => setStairConfig((s) => ({ ...s, [field]: e.target.value }));

  const commitDim = (field) => (v) =>
    setStairConfig((s) => ({ ...s, [field]: v }));

  const commitSteps = (v) =>
    setStairConfig((s) => ({ ...s, steps: Math.max(1, Math.round(v)) }));

  const threeDDims = pdfDrafts?.threeD?.dimensions ?? [];
  const selectedDim = selectedPdfDraftDimensionId
    ? threeDDims.find(d => d.id === selectedPdfDraftDimensionId)
    : null;

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
        <div className="chip-row" style={{ marginTop: 6 }}>
          <span className="chip-label">Project Name</span>
          <input className="field-input" style={{ flex: 1 }} value={project.name} onChange={str('name')} placeholder="My Stair Project" />
        </div>
        <div className="chip-row">
          <span className="chip-label">Client Name</span>
          <input className="field-input" style={{ flex: 1 }} value={project.client} onChange={str('client')} placeholder="Client" />
        </div>
      </section>

      {/* Section 1: Stair Setup */}
      <section className="panel-section">
        <div className="stair-kv-row">
          <span className="chip-label">Quantity Step</span>
          <NumericDraftInput className="field-input" inputMode="numeric" integer={true} value={stairConfig.steps} onCommit={commitSteps} />
          <button
            className={`panel-btn${(stairConfig.railingSideMode ?? 'left') === 'left' ? ' panel-btn-active' : ''}`}
            onClick={() => setStairConfig(s => ({ ...s, railingSideMode: 'left' }))}
          >Left</button>
        </div>
        <div className="stair-kv-row">
          <span className="chip-label">Step Width</span>
          <DimensionDraftInput className="field-input" units={units} value={stairConfig.width} onCommit={commitDim('width')} />
          <button
            className={`panel-btn${(stairConfig.railingSideMode ?? 'left') === 'right' ? ' panel-btn-active' : ''}`}
            onClick={() => setStairConfig(s => ({ ...s, railingSideMode: 'right' }))}
          >Right</button>
        </div>
        <div className="stair-kv-row">
          <span className="chip-label">Step Height</span>
          <DimensionDraftInput className="field-input" units={units} value={calc.riserHeight} onCommit={v => setStairConfig(s => ({ ...s, height: v * s.steps }))} />
          <button
            className={`panel-btn${(stairConfig.railingColorMode ?? 'color') !== 'black' ? ' panel-btn-active' : ''}`}
            onClick={() => setStairConfig(s => ({ ...s, railingColorMode: 'color' }))}
          >Color</button>
        </div>
        <div className="stair-kv-row">
          <span className="chip-label">Step Length</span>
          <DimensionDraftInput className="field-input" units={units} value={calc.treadDepth} onCommit={v => setStairConfig(s => ({ ...s, run: v * s.steps }))} />
          <button
            className={`panel-btn${(stairConfig.railingColorMode ?? 'color') === 'black' ? ' panel-btn-active' : ''}`}
            onClick={() => setStairConfig(s => ({ ...s, railingColorMode: 'black' }))}
          >Black</button>
        </div>

        <div className="stair-kv-row">
          <span className="chip-label">Top Landing</span>
          <DimensionDraftInput className="field-input" units={units} value={stairConfig.topLandingLength ?? 36} onCommit={commitDim('topLandingLength')} />
          <DimensionDraftInput className="field-input" units={units} value={stairConfig.topLandingWidth ?? stairConfig.width} onCommit={commitDim('topLandingWidth')} />
        </div>
      </section>

      {/* Section: Railing Components */}
      <section className="panel-section">
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${compactPostTarget === 1 ? ' chip-label-active' : ''}`}
            title={compactPostTarget === 1 ? 'Cancel Post 1 placement' : 'Click to place Post 1 on any step or landing'}
            onClick={() => onToggleCompactPostPlacement(1)}
          >Post 1</button>
          <DimensionDraftInput className="field-input" units={units} value={stairConfig.post1HeightIn ?? 36} onCommit={v => setStairConfig(s => ({ ...s, post1HeightIn: v }))} />
          <select className="field-input" value={stairConfig.post1Section ?? '2x2'} onChange={e => setStairConfig(s => ({ ...s, post1Section: e.target.value }))}>
            {PROFILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
          <select className="field-input" value={stairConfig.post1Thickness ?? '1.8'} onChange={e => setStairConfig(s => ({ ...s, post1Thickness: e.target.value }))}>
            <option value="1.8">1.8</option>
            <option value="1.4">1.4</option>
          </select>
        </div>
        {compactPostTarget === 1 && (
          <div className="post-tool-hint">Post 1 placement active — click a step or landing to place</div>
        )}
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${compactPostTarget === 2 ? ' chip-label-active' : ''}`}
            title={compactPostTarget === 2 ? 'Cancel Post 2 placement' : 'Click to place Post 2 on any step or landing'}
            onClick={() => onToggleCompactPostPlacement(2)}
          >Post 2</button>
          <DimensionDraftInput className="field-input" units={units} value={stairConfig.post2HeightIn ?? 36} onCommit={v => setStairConfig(s => ({ ...s, post2HeightIn: v }))} />
          <select className="field-input" value={stairConfig.post2Section ?? '2x2'} onChange={e => setStairConfig(s => ({ ...s, post2Section: e.target.value }))}>
            {PROFILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
          <select className="field-input" value={stairConfig.post2Thickness ?? '1.8'} onChange={e => setStairConfig(s => ({ ...s, post2Thickness: e.target.value }))}>
            <option value="1.8">1.8</option>
            <option value="1.4">1.4</option>
          </select>
        </div>
        {compactPostTarget === 2 && (
          <div className="post-tool-hint">Post 2 placement active — click a step or landing to place</div>
        )}
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${(stairConfig.compactTopHandrailEnabled ?? true) ? ' chip-label-active' : ''}`}
            onClick={() => setStairConfig(s => ({ ...s, compactTopHandrailEnabled: !(s.compactTopHandrailEnabled ?? true) }))}
          >Top Handrail</button>
          <div className="rc-empty-cell" />
          <select className="field-input" value={stairConfig.handrailSection ?? '2x1'} onChange={e => setStairConfig(s => ({ ...s, handrailSection: e.target.value }))}>
            {PROFILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
          <select className="field-input" value={stairConfig.handrailThickness ?? '1.8'} onChange={e => setStairConfig(s => ({ ...s, handrailThickness: e.target.value }))}>
            <option value="1.8">1.8</option>
            <option value="1.4">1.4</option>
          </select>
        </div>
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${(stairConfig.compactBottomChannelEnabled ?? true) ? ' chip-label-active' : ''}`}
            onClick={() => setStairConfig(s => ({ ...s, compactBottomChannelEnabled: !(s.compactBottomChannelEnabled ?? true) }))}
          >Bottom Channel</button>
          <div className="rc-empty-cell" />
          <select className="field-input" value={stairConfig.bottomChannelSection ?? '2x1'} onChange={e => setStairConfig(s => ({ ...s, bottomChannelSection: e.target.value }))}>
            {PROFILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
          <select className="field-input" value={stairConfig.bottomChannelThickness ?? '1.8'} onChange={e => setStairConfig(s => ({ ...s, bottomChannelThickness: e.target.value }))}>
            <option value="1.8">1.8</option>
            <option value="1.4">1.4</option>
          </select>
        </div>
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${(stairConfig.infillType ?? 'none') === 'vertical' ? ' chip-label-active' : ''}`}
            onClick={() => setStairConfig(s => ({ ...s, infillType: 'vertical' }))}
          >Picket Vertical</button>
          <div className="rc-empty-cell" />
          <select className="field-input" value={stairConfig.picketVerticalSection ?? '1x1'} onChange={e => setStairConfig(s => ({ ...s, picketVerticalSection: e.target.value }))}>
            {PROFILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
          <select className="field-input" value={stairConfig.picketVerticalThickness ?? '1.8'} onChange={e => setStairConfig(s => ({ ...s, picketVerticalThickness: e.target.value }))}>
            <option value="1.8">1.8</option>
            <option value="1.4">1.4</option>
          </select>
        </div>
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${(stairConfig.infillType ?? 'none') === 'horizontalPicket' ? ' chip-label-active' : ''}`}
            onClick={() => setStairConfig(s => ({ ...s, infillType: 'horizontalPicket' }))}
          >Picket Horizontal</button>
          <div className="rc-empty-cell" />
          <select className="field-input" value={stairConfig.picketHorizontalSection ?? '1x1'} onChange={e => setStairConfig(s => ({ ...s, picketHorizontalSection: e.target.value }))}>
            {PROFILE_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
          <select className="field-input" value={stairConfig.picketHorizontalThickness ?? '1.8'} onChange={e => setStairConfig(s => ({ ...s, picketHorizontalThickness: e.target.value }))}>
            <option value="1.8">1.8</option>
            <option value="1.4">1.4</option>
          </select>
        </div>
        <div className="rc-comp-row">
          <button
            className={`chip-label chip-label-btn${(stairConfig.infillType ?? 'none') === 'horizontalCable' ? ' chip-label-active' : ''}`}
            onClick={() => setStairConfig(s => ({ ...s, infillType: 'horizontalCable' }))}
          >Cable Horizontal</button>
          <div className="rc-empty-cell" />
          <select className="field-input" value={stairConfig.cableSize ?? '1/8'} onChange={e => setStairConfig(s => ({ ...s, cableSize: e.target.value }))}>
            <option value="1/8">1/8</option>
          </select>
          <select className="field-input" value={stairConfig.cableFinish ?? 'Black'} onChange={e => setStairConfig(s => ({ ...s, cableFinish: e.target.value }))}>
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
