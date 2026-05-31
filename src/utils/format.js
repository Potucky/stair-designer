export const fmt1 = (n) => (typeof n === 'number' ? n.toFixed(1) : '—');
export const fmt2 = (n) => (typeof n === 'number' ? n.toFixed(2) : '—');
export const fmt3 = (n) => (typeof n === 'number' ? n.toFixed(3) : '—');
export const fmtIn = (n) => `${fmt3(n)}"`;
export const fmtDeg = (n) => `${fmt1(n)}°`;

export const INCH_TO_MM = 25.4;
export const fmtUnit = (n, units) => {
  if (typeof n !== 'number') return '—';
  if (units === 'mm') return `${(n * INCH_TO_MM).toFixed(1)} mm`;
  return `${n.toFixed(3)}"`;
};
