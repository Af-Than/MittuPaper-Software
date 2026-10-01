const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** paise -> "₹1,234.50" */
export const money = (paise) => inr.format((paise || 0) / 100);
/** paise -> "₹1,235" (for chart axes / compact tiles) */
export const moneyWhole = (paise) => inrWhole.format((paise || 0) / 100);
/** Compact axis label: 123400 paise -> "₹1.2K" */
export function moneyCompact(paise) {
  const r = (paise || 0) / 100;
  if (r >= 100000) return `₹${(r / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `₹${r}`;
}
/** Rupee text input -> integer paise (NaN-safe: returns null if invalid) */
export function rupeesToPaise(value) {
  const n = Number(String(value).replace(/[₹,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
export const paiseToRupeeInput = (paise) => ((paise || 0) / 100).toFixed(2).replace(/\.00$/, '');

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const monthLabel = (year, month) => `${MONTHS[month - 1]} ${year}`;
export const pad2 = (n) => String(n).padStart(2, '0');
export const dateKey = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Local "today" as YYYY-MM-DD (the admin's own calendar day) */
export function todayKey() {
  const d = new Date();
  return dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
export function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** "2026-09-12" or ISO string -> "12 Sep 2026" */
export function formatDate(value) {
  if (!value) return '—';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}
/** ISO timestamp -> "12 Sep 2026, 4:05 pm" (viewer's local time) */
export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}
export const dateInput = (value) => (value ? String(value).slice(0, 10) : '');

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Summarise a weekday list: "Daily", "Mon–Fri", "Sun" or "Mon, Wed" */
export function describeWeekdays(days = []) {
  const set = [...new Set(days)].sort();
  if (set.length === 7) return 'Daily';
  if (set.length === 5 && set.join() === '1,2,3,4,5') return 'Mon–Fri';
  if (set.length === 2 && set.join() === '0,6') return 'Sat & Sun';
  return set.map((d) => WEEKDAYS[d]).join(', ') || '—';
}

/** Browser-side parser for user agents (good enough for the Activity table) */
export function describeUserAgent(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Unknown browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}
