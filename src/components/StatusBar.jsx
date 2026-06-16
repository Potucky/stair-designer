import { fmtDeg, fmtUnit } from '../utils/format.js';
import supabase from '../lib/supabaseClient.js';

export default function StatusBar({ activeTool, calc, warnings, units }) {
  const supabaseConfigured = Boolean(supabase);
  const errorCount = warnings.filter((w) => w.level === 'error').length;
  const warnCount = warnings.filter((w) => w.level === 'warning').length;

  return (
    <footer className="status-bar">
      <span>Tool: <strong>{activeTool || 'select'}</strong></span>
      <span>|</span>
      <span>Angle: <strong>{fmtDeg(calc.angleDeg)}</strong></span>
      <span>|</span>
      <span>Riser: <strong>{calc.riserHeight > 0 ? fmtUnit(calc.riserHeight, units) : '—'}</strong></span>
      <span>|</span>
      <span>Units: <strong>{units === 'mm' ? 'mm' : units === 'in16' ? 'Inch 1/16' : 'Inch 1/8'}</strong></span>
      <span>|</span>
      {errorCount > 0 && <span className="status-error">⚠ {errorCount} error{errorCount !== 1 ? 's' : ''}</span>}
      {warnCount > 0 && <span className="status-warn"> {warnCount} warning{warnCount !== 1 ? 's' : ''}</span>}
      {errorCount === 0 && warnCount === 0 && <span className="status-ok">✓ No issues</span>}
      <span>|</span>
      <span className={supabaseConfigured ? 'status-ok' : 'status-warn'}>
        Supabase: {supabaseConfigured ? 'Configured' : 'Not configured'}
      </span>
    </footer>
  );
}
