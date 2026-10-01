/** Format paise as a plain-text rupee string, e.g. 123450 -> "₹1,234.50" (Indian grouping). */
const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
export const formatPaise = (paise) => fmt.format((paise || 0) / 100);

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const monthLabel = (year, month) => `${MONTH_NAMES[month - 1]} ${year}`;
