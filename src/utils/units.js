export const INCH_TO_MM = 25.4;

function gcd(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1;
}

// Parse construction-format inch strings into decimal inches.
// Accepts: "48-1/8", "48 1/8", "1/8", "36", "18.5", "48-1/8"", etc.
// Returns null on invalid input.
export function parseImperialInputToInches(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim().replace(/"$/, '').trim();
  if (!s) return null;

  if (s.includes('/')) {
    // "48-1/8" or "48 1/8" — whole number + separator + fraction
    const m = s.match(/^(\d+(?:\.\d+)?)[\s\-]+(\d+)\/(\d+)$/);
    if (m) {
      const den = parseInt(m[3], 10);
      if (den === 0) return null;
      return parseFloat(m[1]) + parseInt(m[2], 10) / den;
    }
    // "1/8" — bare fraction, no whole number
    const mf = s.match(/^(\d+)\/(\d+)$/);
    if (mf) {
      const den = parseInt(mf[2], 10);
      if (den === 0) return null;
      return parseInt(mf[1], 10) / den;
    }
    return null;
  }

  const v = parseFloat(s);
  if (!isNaN(v) && isFinite(v)) return v;
  return null;
}

// Format a decimal inch value as a fraction string, e.g. 48.125 -> "48-1/8".
// denominator: 8 for in8 mode, 16 for in16 mode.
export function formatInchesFraction(value, denominator) {
  if (typeof value !== 'number' || !isFinite(value)) return '—';
  const rounded = Math.round(value * denominator) / denominator;
  const whole = Math.floor(rounded);
  const fracNumerator = Math.round((rounded - whole) * denominator);

  if (fracNumerator === 0) return String(whole);

  const g = gcd(fracNumerator, denominator);
  return `${whole}-${fracNumerator / g}/${denominator / g}`;
}

// Format a decimal inch value for display in an editable field (no unit suffix).
export function formatDimensionByUnit(value, unitMode) {
  if (typeof value !== 'number' || !isFinite(value)) return '—';
  if (unitMode === 'mm') return (value * INCH_TO_MM).toFixed(1);
  if (unitMode === 'in16') return formatInchesFraction(value, 16);
  return formatInchesFraction(value, 8);
}

// Parse user input string into decimal inches, interpreting based on unit mode.
// mm input is converted from mm to inches. Returns null on invalid input.
export function parseDimensionByUnit(str, unitMode) {
  if (str === null || str === undefined) return null;
  const s = String(str).trim();
  if (!s) return null;

  if (unitMode === 'mm') {
    const mm = parseFloat(s);
    if (!isNaN(mm) && isFinite(mm)) return mm / INCH_TO_MM;
    return null;
  }

  return parseImperialInputToInches(s);
}
