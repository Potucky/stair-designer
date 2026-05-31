export default function Header({ onOpenJson, onSaveJson, onExportPdf, onPrint }) {
  const menus = ['File', 'Edit', 'View', 'Build', 'Materials', 'Export', 'Help'];

  return (
    <header className="app-header">
      <div className="header-left">
        <span className="app-title">Stair Designer</span>
        <nav className="top-menu">
          {menus.map((m) => (
            <span key={m} className="menu-item">{m}</span>
          ))}
        </nav>
      </div>
      <div className="header-right">
        <button className="header-btn" onClick={onOpenJson}>Open JSON</button>
        <button className="header-btn" onClick={onSaveJson}>Save JSON</button>
        <button className="header-btn header-btn-primary" onClick={onExportPdf}>Export PDF</button>
        <button className="header-btn" onClick={onPrint}>Print</button>
      </div>
    </header>
  );
}
