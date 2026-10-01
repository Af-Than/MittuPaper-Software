import {
  Bill, Customer, DeliveryAdjustment, Employee, FuelEntry, OtherExpense, Payment, Publication,
  RepairEntry, SalaryPayment, Subscription, Vehicle,
} from '../models/index.js';
import { costBreakdown, expenseAlerts, monthlyTrend, profitAndLossReport, recentActivity } from '../services/expenseService.js';
import { computeMonthlyBill } from '../services/billing.js';
import { fuelLogWorkbook, ledgerWorkbook, profitLossWorkbook, repairsLogWorkbook, salaryRegisterWorkbook, sendWorkbook } from '../services/excel.js';
import { monthLabel } from '../utils/money.js';
import { parseDate } from '../utils/http.js';

const NOT_DELETED = { deletedAt: null };

export async function dashboard(req, res) {
  const year = Number(req.query.year) || new Date().getUTCFullYear();
  const month = Number(req.query.month) || new Date().getUTCMonth() + 1;
  const [pnl, trend, alerts, activity, breakdown] = await Promise.all([
    profitAndLossReport({ year, month }),
    monthlyTrend(12),
    expenseAlerts(),
    recentActivity(15),
    costBreakdown({ year, month }),
  ]);
  res.json({ year, month, pnl, trend, alerts, activity, ...breakdown });
}

export async function profitLoss(req, res) {
  const year = Number(req.query.year);
  const month = req.query.month ? Number(req.query.month) : undefined;
  res.json(await profitAndLossReport({ year, month }));
}

/** Merges all four expense types into one sorted (newest first) list, matching the given filters. */
async function buildLedgerRows({ type, employee, vehicle, from, to, minAmount, maxAmount }) {
  const dateFilter = (field) => (from || to ? { [field]: { ...(from ? { $gte: parseDate(from) } : {}), ...(to ? { $lte: parseDate(to) } : {}) } } : {});
  const CAP = 2000;

  const rows = [];
  if (!type || type === 'fuel') {
    const q = { ...NOT_DELETED, ...dateFilter('fuelledAt'), ...(vehicle ? { vehicle } : {}), ...(employee ? { employee } : {}) };
    const docs = await FuelEntry.find(q).populate('vehicle', 'registrationNumber').populate('employee', 'name').sort({ fuelledAt: -1 }).limit(CAP).lean();
    rows.push(...docs.map((d) => ({ id: String(d._id), type: 'fuel', date: d.fuelledAt, description: `Fuel — ${d.litres}L @ ${d.station || 'station'}`, vehicle: d.vehicle?.registrationNumber, employee: d.employee?.name, amount: d.amount, createdAt: d.createdAt, createdBy: d.createdBy })));
  }
  if (!type || type === 'repair') {
    const q = { ...NOT_DELETED, ...dateFilter('repairedAt'), ...(vehicle ? { vehicle } : {}) };
    const docs = await RepairEntry.find(q).populate('vehicle', 'registrationNumber').sort({ repairedAt: -1 }).limit(CAP).lean();
    rows.push(...docs.map((d) => ({ id: String(d._id), type: 'repair', date: d.repairedAt, description: `${d.category} — ${d.description}`, vehicle: d.vehicle?.registrationNumber, employee: null, amount: d.total, createdAt: d.createdAt, createdBy: d.createdBy })));
  }
  if (!type || type === 'salary') {
    const q = { ...NOT_DELETED, ...dateFilter('paidOn'), ...(employee ? { employee } : {}) };
    const docs = await SalaryPayment.find(q).populate('employee', 'name').sort({ paidOn: -1 }).limit(CAP).lean();
    rows.push(...docs.map((d) => ({ id: String(d._id), type: 'salary', date: d.paidOn, description: `Salary — ${d.employee?.name || ''}`, vehicle: null, employee: d.employee?.name, amount: d.netPaid, createdAt: d.createdAt, createdBy: d.recordedBy })));
  }
  if (!type || type === 'other') {
    const q = { ...NOT_DELETED, ...dateFilter('date') };
    const docs = await OtherExpense.find(q).sort({ date: -1 }).limit(CAP).lean();
    rows.push(...docs.map((d) => ({ id: String(d._id), type: 'other', date: d.date, description: `${d.category} — ${d.description}`, vehicle: null, employee: null, amount: d.amount, createdAt: d.createdAt, createdBy: d.createdBy })));
  }

  let filtered = rows;
  if (minAmount) filtered = filtered.filter((r) => r.amount >= Number(minAmount));
  if (maxAmount) filtered = filtered.filter((r) => r.amount <= Number(maxAmount));
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  return filtered;
}

/** One unified, searchable ledger of every expense type. Paginated in memory after merging. */
export async function ledger(req, res) {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 25, 200);
  const filtered = await buildLedgerRows(req.query);
  const total = filtered.length;
  const totalAmount = filtered.reduce((n, r) => n + r.amount, 0);
  const pageSkip = (page - 1) * limit;
  const items = filtered.slice(pageSkip, pageSkip + limit);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), totalAmount });
}

/** Everything delivered to one employee's route on one date, for the printable delivery sheet. */
export async function deliverySheet(req, res) {
  const date = req.query.date; // YYYY-MM-DD
  const employeeId = req.query.employee;
  const [y, m, d] = date.split('-').map(Number);
  const dayStart = new Date(Date.UTC(y, m - 1, d));
  const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));

  const customerQuery = { active: true, ...(employeeId ? { employee: employeeId } : {}) };
  const customers = await Customer.find(customerQuery).sort({ routeName: 1, name: 1 }).lean();
  const ids = customers.map((c) => c._id);

  const [subs, adjustments] = await Promise.all([
    Subscription.find({ customer: { $in: ids }, startDate: { $lte: dayEnd }, $or: [{ endDate: null }, { endDate: { $gte: dayStart } }] }).populate('publication', 'name').lean(),
    DeliveryAdjustment.find({ customer: { $in: ids }, date: { $gte: dayStart, $lte: dayEnd } }).lean(),
  ]);

  const subsByCustomer = new Map();
  for (const s of subs) {
    const k = String(s.customer);
    if (!subsByCustomer.has(k)) subsByCustomer.set(k, []);
    subsByCustomer.get(k).push(s);
  }

  const rows = customers
    .map((c) => {
      const result = computeMonthlyBill({
        year: y,
        month: m,
        subscriptions: (subsByCustomer.get(String(c._id)) || [])
          .filter((s) => s.publication)
          .map((s) => ({ publicationId: String(s.publication._id), publicationName: s.publication.name, mode: s.mode, weekdays: s.weekdays, copiesPerMonth: s.copiesPerMonth, quantity: s.quantity, startDate: s.startDate, endDate: s.endDate, rateHistory: [{ ratePerCopy: 0, effectiveFrom: s.startDate }] })),
        adjustments: adjustments.filter((a) => String(a.customer) === String(c._id)).map((a) => ({ ...a, publication: a.publication ? String(a.publication) : null })),
      });
      const day = result.days.find((x) => x.date === date);
      return { customer: { id: c._id, name: c.name, address: c.address, phone: c.phone, routeName: c.routeName }, items: day?.items || [], copies: day?.copies || 0 };
    })
    .filter((r) => r.copies > 0);

  res.json({ date, employee: employeeId || null, rows, totalCustomers: rows.length, totalCopies: rows.reduce((n, r) => n + r.copies, 0) });
}

// ---- Excel exports ----

export async function exportFuel(req, res) {
  const { vehicle, employee, from, to } = req.query;
  const q = { deletedAt: null, ...(vehicle ? { vehicle } : {}), ...(employee ? { employee } : {}), ...((from || to) ? { fuelledAt: { ...(from ? { $gte: parseDate(from) } : {}), ...(to ? { $lte: parseDate(to) } : {}) } } : {}) };
  const entries = await FuelEntry.find(q).populate('vehicle', 'registrationNumber').populate('employee', 'name').sort({ fuelledAt: 1 }).lean();
  await sendWorkbook(res, fuelLogWorkbook(entries, from || to ? `${from || 'start'} to ${to || 'now'}` : 'All records'), `fuel-log-${Date.now()}.xlsx`);
}

export async function exportRepairs(req, res) {
  const { vehicle, category, status, from, to } = req.query;
  const q = { deletedAt: null, ...(vehicle ? { vehicle } : {}), ...(category ? { category } : {}), ...(status ? { status } : {}), ...((from || to) ? { repairedAt: { ...(from ? { $gte: parseDate(from) } : {}), ...(to ? { $lte: parseDate(to) } : {}) } } : {}) };
  const entries = await RepairEntry.find(q).populate('vehicle', 'registrationNumber').sort({ repairedAt: 1 }).lean();
  await sendWorkbook(res, repairsLogWorkbook(entries, from || to ? `${from || 'start'} to ${to || 'now'}` : 'All records'), `repairs-log-${Date.now()}.xlsx`);
}

export async function exportSalaries(req, res) {
  const { year, month, employee } = req.query;
  const q = { deletedAt: null, ...(year ? { forYear: Number(year) } : {}), ...(month ? { forMonth: Number(month) } : {}), ...(employee ? { employee } : {}) };
  const payments = await SalaryPayment.find(q).populate('employee', 'name').sort({ forYear: 1, forMonth: 1 }).lean();
  const label = year && month ? monthLabel(Number(year), Number(month)) : year ? `Year ${year}` : 'All records';
  await sendWorkbook(res, salaryRegisterWorkbook(payments, label), `salary-register-${Date.now()}.xlsx`);
}

export async function exportLedger(req, res) {
  const items = await buildLedgerRows(req.query);
  await sendWorkbook(res, ledgerWorkbook(items, 'Filtered ledger'), `expense-ledger-${Date.now()}.xlsx`);
}

export async function exportProfitLoss(req, res) {
  const year = Number(req.query.year);
  const month = req.query.month ? Number(req.query.month) : undefined;
  const pnl = await profitAndLossReport({ year, month });
  await sendWorkbook(res, profitLossWorkbook(pnl, month ? monthLabel(year, month) : `Year ${year}`), `profit-loss-${Date.now()}.xlsx`);
}

export async function backup(_req, res) {
  const models = { Customer, Publication, Subscription, DeliveryAdjustment, Bill, Payment, Employee, Vehicle, FuelEntry, RepairEntry, SalaryPayment, OtherExpense };
  const data = {};
  for (const [name, Model] of Object.entries(models)) {
    // eslint-disable-next-line no-await-in-loop
    data[name] = await Model.find({}).lean();
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="papertrail-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ exportedAt: new Date().toISOString(), ...data });
}

export async function search(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ customers: [], vehicles: [], employees: [] });
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [customers, vehicles, employees] = await Promise.all([
    Customer.find({ $or: [{ name: rx }, { phone: rx }] }).select('name phone').limit(8).lean(),
    Vehicle.find({ ...NOT_DELETED, registrationNumber: rx }).select('registrationNumber type').limit(8).lean(),
    Employee.find({ ...NOT_DELETED, name: rx }).select('name phone').limit(8).lean(),
  ]);
  res.json({ customers, vehicles, employees });
}
