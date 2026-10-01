// Shared formatting/labels for the expense module (kept separate from lib/format.js for clarity).
export const VEHICLE_TYPE_LABEL = { bike: 'Bike', scooter: 'Scooter', 'mini-van': 'Mini-van', auto: 'Auto', 'ev-scooter': 'EV Scooter' };
export const FUEL_TYPE_LABEL = { petrol: 'Petrol', diesel: 'Diesel', electric: 'Electric' };
export const VEHICLE_STATUS_LABEL = { active: 'Active', 'in-repair': 'In repair', retired: 'Retired' };
export const REPAIR_CATEGORY_LABEL = { service: 'Service', tyre: 'Tyre', brake: 'Brake', engine: 'Engine', battery: 'Battery', electrical: 'Electrical', accident: 'Accident', other: 'Other' };
export const OTHER_CATEGORY_LABEL = { rent: 'Rent', electricity: 'Electricity', 'phone-internet': 'Phone/Internet', 'stationery-packing': 'Stationery/Packing', 'publisher-payment': 'Publisher payment', miscellaneous: 'Miscellaneous' };
export const LEDGER_TYPE_LABEL = { fuel: 'Fuel', repair: 'Repair', salary: 'Salary', other: 'Other' };
export const PAY_MODE_LABEL = { cash: 'Cash', upi: 'UPI', other: 'Other', bank: 'Bank' };
export const ROLE_LABEL = { delivery: 'Delivery', supervisor: 'Supervisor' };

// Validated categorical palette for the 4 expense categories (dataviz skill: validate_palette.js PASS)
export const CATEGORY_COLOR = { fuel: '#2F6FD0', repair: '#C96A0A', salary: '#6B4FCB', other: '#1E8F6B' };
export const INCOME_LINE_COLOR = '#0F1F3D';

export const salaryStatusMeta = (status) => {
  if (status === 'paid') return { label: 'Paid', tone: 'success' };
  if (status === 'paid-late') return { label: 'Paid late', tone: 'warning' };
  return { label: 'Pending', tone: 'danger' };
};
