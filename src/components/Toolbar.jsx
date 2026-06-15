import ToolButton from './ToolButton.jsx';

export default function Toolbar({ activeTool, onToolSelect, onViewChange, showDimensions, onToggleDimensions, manualDimensionsCount = 0, onUndoLastManualDimension, onOpenSidePdf, onOpen3dPdf, activePdfDraftMode = null }) {
  const activeTools = [
    { id: 'select',       label: 'Select',       icon: '↖' },
    { id: 'measure',      label: 'Measure',      icon: '📏' },
    { id: 'stair',        label: 'Straight Stair', icon: '🪜' },
    { id: 'railing',      label: 'Railing',      icon: '⊟' },
    { id: 'dimension',    label: 'Dimension',    icon: '↔' },
    { id: 'text',         label: 'Text',         icon: 'T' },
  ];

  const viewTools = [
    { id: 'top',    label: 'Top View',  icon: '⊙' },
    { id: 'side',   label: 'Side View', icon: '▭' },
    { id: '3d',     label: '3D View',   icon: '◈' },
  ];

  const handleView = (id) => {
    onViewChange(id);
    onToolSelect(id);
  };

  return (
    <aside className="toolbar">
      <div className="tool-group">
        {activeTools.map((t) => (
          <ToolButton
            key={t.id}
            label={t.label}
            icon={t.icon}
            active={activeTool === t.id}
            onClick={() => onToolSelect(t.id)}
          />
        ))}
      </div>

      <div className="tool-divider" />

      <div className="tool-group">
        {viewTools.map((t) => (
          <ToolButton
            key={t.id}
            label={t.label}
            icon={t.icon}
            active={activeTool === t.id}
            onClick={() => handleView(t.id)}
          />
        ))}
      </div>

      <div className="tool-divider" />

      <div className="tool-group">
        <ToolButton
          label="Dims"
          icon="👁"
          active={showDimensions}
          onClick={onToggleDimensions}
        />
        <ToolButton
          label="Undo Dim"
          icon="↩"
          active={false}
          disabled={manualDimensionsCount === 0}
          onClick={onUndoLastManualDimension}
        />
      </div>

      <div className="tool-divider" />

      <div className="tool-group">
        <ToolButton
          label="Side PDF"
          icon="📄"
          active={activePdfDraftMode === 'side'}
          onClick={onOpenSidePdf}
        />
        <ToolButton
          label="3D PDF"
          icon="📐"
          active={activePdfDraftMode === '3d'}
          onClick={onOpen3dPdf}
        />
      </div>

    </aside>
  );
}
