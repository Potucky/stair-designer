export default function ToolButton({ label, icon, active, disabled, comingSoon, onClick }) {
  return (
    <button
      className={`tool-btn${active ? ' tool-btn-active' : ''}${disabled ? ' tool-btn-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      title={comingSoon ? `${label} — Coming soon` : label}
      disabled={disabled}
    >
      <span className="tool-icon">{icon}</span>
      <span className="tool-label">{comingSoon ? `${label}*` : label}</span>
    </button>
  );
}
