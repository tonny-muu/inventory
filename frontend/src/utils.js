export const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
export const monthStart = () => today().slice(0, 8) + '01';

export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
};

export const fmt = (v) =>
  Number(v ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// empty input -> 0 for optional amounts
export const num = (v) => (v === '' || v == null ? 0 : v);

// "2026-11-26 14:32:10" -> "2:32 PM"
export const timeOf = (dt) => {
  if (!dt) return '';
  const [h, m] = String(dt).slice(11, 16).split(':');
  const hh = Number(h);
  if (Number.isNaN(hh)) return '';
  return `${((hh + 11) % 12) + 1}:${m} ${hh >= 12 ? 'PM' : 'AM'}`;
};

// "2026-11-26 14:32:10" -> "2026-11-26 2:32 PM"
export const dateTimeOf = (dt) => (dt ? `${String(dt).slice(0, 10)} ${timeOf(dt)}` : '');

export const initials = (name) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');