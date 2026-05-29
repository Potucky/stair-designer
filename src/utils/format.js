export const fmt1 = (n) => (typeof n === 'number' ? n.toFixed(1) : '—');
export const fmt2 = (n) => (typeof n === 'number' ? n.toFixed(2) : '—');
export const fmt3 = (n) => (typeof n === 'number' ? n.toFixed(3) : '—');
export const fmtIn = (n) => `${fmt3(n)}"`;
export const fmtDeg = (n) => `${fmt1(n)}°`;
