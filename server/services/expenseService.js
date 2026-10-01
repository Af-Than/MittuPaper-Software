/**
 * Database-backed expense orchestration: dashboard aggregates, alerts and P&L. CRUD with
 * soft-delete + audit trail lives directly in the controllers (thin, model-specific); this file
 * holds the cross-model aggregation that would otherwise be duplicated.
 */
import mongoose from 'mongoose';
import { Bill, Employee, FuelEntry, OtherExpense, Payment, Publication, RepairEntry, SalaryPayment, Vehicle } from '../models/index.js';
import { averageMileage, daysUntil, hasMileageDrop, profitAndLoss, salaryStatus } from './expenses.js';

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const NOT_DELETED = { deletedAt: null };
const monthRange = (year, month) => ({ $gte: new Date(Date.UTC(year, month - 1, 1)), $lt: new Date(Date.UTC(year, month, 1)) });
const yearRange = (year) => ({ $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) });

async function sumIn(Model, dateField, range, amountField = 'amount', extra = {}) {
  const rows = await Model.aggregate([{ $match: { ...NOT_DELETED, ...extra, [dateField]: range } }, { $group: { _id: null, sum: { $sum: `$${amountField}` } } }]);
  return rows[0]?.sum || 0;
}

/** Fuel + repair + salary + other expense totals for a calendar month or year. */
export async function expenseTotals(range) {
  const [fuel, repairs, salaries, other] = await Promise.all([
    sumIn(FuelEntry, 'fuelledAt', range),
    sumIn(RepairEntry, 'repairedAt', range, 'total'),
    sumIn(SalaryPayment, 'paidOn', range, 'netPaid'),
    sumIn(OtherExpense, 'date', range),
  ]);
  return { fuel, repairs, salaries, other, total: fuel + repairs + salaries + other };
}

/** Copies delivered x agency cost per copy, for the Profit & Loss "publisher cost" line. */
export async function publisherCostFor({ year, month }) {
  // Uses each bill's own (year, month) — the period it bills FOR, not when it was generated —
  // and the publication's rate at generation time (accurate unless the agency cost changed
  // mid-month, same simplification the customer-facing rate snapshot already makes).
  const filter = month ? { year, month } : { year };
  const bills = await Bill.find(filter).select('lineItems').lean();
  if (!bills.length) return 0;
  const pubIds = new Set();
  for (const b of bills) for (const l of b.lineItems) if (l.publication) pubIds.add(String(l.publication));
  const pubs = await Publication.find({ _id: { $in: [...pubIds] } }).select('rates').lean();
  const costOf = new Map(pubs.map((p) => [String(p._id), p.rates?.length ? p.rates[p.rates.length - 1].agencyCostPerCopy || 0 : 0]));
  let total = 0;
  for (const b of bills) for (const l of b.lineItems) total += (l.copies || 0) * (costOf.get(String(l.publication)) || 0);
  return total;
}

export async function profitAndLossReport({ year, month }) {
  const range = month ? monthRange(year, month) : yearRange(year);
  const [income, expenses, publisherCost] = await Promise.all([
    sumIn(Payment, 'date', range),
    expenseTotals(range),
    publisherCostFor({ year, month }),
  ]);
  return profitAndLoss({ income, ...expenses, publisherCost });
}

/** Monthly stacked totals (fuel/repair/salary/other + collected income) for the last N months. */
export async function monthlyTrend(months = 12) {
  const now = new Date();
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const range = monthRange(year, month);
    // eslint-disable-next-line no-await-in-loop
    const [expenses, income] = await Promise.all([expenseTotals(range), sumIn(Payment, 'date', range)]);
    out.push({ year, month, ...expenses, income });
  }
  return out;
}

/** Cost per employee (fuel+repairs for the vehicles they are assigned, this month) + per vehicle. */
export async function costBreakdown({ year, month }) {
  const range = monthRange(year, month);
  const [vehicles, fuelRows, repairRows] = await Promise.all([
    Vehicle.find(NOT_DELETED).select('registrationNumber assignedEmployee').lean(),
    FuelEntry.aggregate([{ $match: { ...NOT_DELETED, fuelledAt: range } }, { $group: { _id: '$vehicle', sum: { $sum: '$amount' } } }]),
    RepairEntry.aggregate([{ $match: { ...NOT_DELETED, repairedAt: range } }, { $group: { _id: '$vehicle', sum: { $sum: '$total' } } }]),
  ]);
  const fuelByVehicle = new Map(fuelRows.map((r) => [String(r._id), r.sum]));
  const repairByVehicle = new Map(repairRows.map((r) => [String(r._id), r.sum]));
  const vehicleCosts = vehicles
    .map((v) => ({ vehicleId: String(v._id), registrationNumber: v.registrationNumber, cost: (fuelByVehicle.get(String(v._id)) || 0) + (repairByVehicle.get(String(v._id)) || 0) }))
    .filter((v) => v.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  const employees = await Employee.find(NOT_DELETED).select('name').lean();
  const costByEmployee = new Map();
  for (const v of vehicles) {
    if (!v.assignedEmployee) continue;
    const key = String(v.assignedEmployee);
    const cost = (fuelByVehicle.get(String(v._id)) || 0) + (repairByVehicle.get(String(v._id)) || 0);
    costByEmployee.set(key, (costByEmployee.get(key) || 0) + cost);
  }
  const employeeCosts = employees
    .map((e) => ({ employeeId: String(e._id), name: e.name, cost: costByEmployee.get(String(e._id)) || 0 }))
    .filter((e) => e.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  return { vehicleCosts: vehicleCosts.slice(0, 5), employeeCosts };
}

/** Fuel + repair cost this month for the vehicles each given employee is assigned, keyed by employee id. */
export async function costForEmployees(employeeIds, year, month) {
  const range = monthRange(year, month);
  const vehicles = await Vehicle.find({ ...NOT_DELETED, assignedEmployee: { $in: employeeIds } }).select('assignedEmployee').lean();
  const vehicleIdsByEmployee = new Map();
  for (const v of vehicles) {
    const k = String(v.assignedEmployee);
    if (!vehicleIdsByEmployee.has(k)) vehicleIdsByEmployee.set(k, []);
    vehicleIdsByEmployee.get(k).push(v._id);
  }
  const allVehicleIds = vehicles.map((v) => v._id);
  const [fuelRows, repairRows] = await Promise.all([
    FuelEntry.aggregate([{ $match: { ...NOT_DELETED, vehicle: { $in: allVehicleIds }, fuelledAt: range } }, { $group: { _id: '$vehicle', sum: { $sum: '$amount' } } }]),
    RepairEntry.aggregate([{ $match: { ...NOT_DELETED, vehicle: { $in: allVehicleIds }, repairedAt: range } }, { $group: { _id: '$vehicle', sum: { $sum: '$total' } } }]),
  ]);
  const fuelByVehicle = new Map(fuelRows.map((r) => [String(r._id), r.sum]));
  const repairByVehicle = new Map(repairRows.map((r) => [String(r._id), r.sum]));
  const out = new Map();
  for (const id of employeeIds) {
    const vIds = vehicleIdsByEmployee.get(String(id)) || [];
    let fuel = 0;
    let repairs = 0;
    for (const vid of vIds) {
      fuel += fuelByVehicle.get(String(vid)) || 0;
      repairs += repairByVehicle.get(String(vid)) || 0;
    }
    out.set(String(id), { fuel, repairs, vehicleCount: vIds.length });
  }
  return out;
}

/** Everything the Expense Dashboard's alerts panel needs, computed fresh each call. */
export async function expenseAlerts() {
  const [vehicles, employees, pendingRepairs] = await Promise.all([
    Vehicle.find(NOT_DELETED).lean(),
    Employee.find({ ...NOT_DELETED, active: true }).lean(),
    RepairEntry.find({ ...NOT_DELETED, status: 'pending' }).populate('vehicle', 'registrationNumber').lean(),
  ]);

  const docAlerts = [];
  for (const v of vehicles) {
    for (const [field, label] of [['insuranceExpiry', 'Insurance'], ['pollutionExpiry', 'PUC'], ['fitnessExpiry', 'Fitness']]) {
      const days = daysUntil(v[field]);
      if (days !== null && days <= 30) docAlerts.push({ vehicleId: String(v._id), registrationNumber: v.registrationNumber, doc: label, days, expired: days < 0 });
    }
  }
  docAlerts.sort((a, b) => a.days - b.days);

  const serviceDue = vehicles
    .filter((v) => v.nextServiceDueKm != null && v.odometer >= v.nextServiceDueKm)
    .map((v) => ({ vehicleId: String(v._id), registrationNumber: v.registrationNumber, odometer: v.odometer, dueKm: v.nextServiceDueKm }));

  // Mileage drop: needs each vehicle's fuel history
  const fuelByVehicle = await FuelEntry.aggregate([{ $match: NOT_DELETED }, { $sort: { fuelledAt: 1 } }, { $group: { _id: '$vehicle', entries: { $push: { id: '$_id', fuelledAt: '$fuelledAt', odometer: '$odometer', litres: '$litres', fullTank: '$fullTank' } } } }]);
  const mileageDrops = [];
  for (const row of fuelByVehicle) {
    if (hasMileageDrop(row.entries)) {
      const v = vehicles.find((x) => String(x._id) === String(row._id));
      if (v) mileageDrops.push({ vehicleId: String(v._id), registrationNumber: v.registrationNumber, average: averageMileage(row.entries) });
    }
  }

  // Salary pending/overdue for the current month
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const paidThisMonth = await SalaryPayment.find({ ...NOT_DELETED, forYear: year, forMonth: month }).select('employee').lean();
  const paidIds = new Set(paidThisMonth.map((p) => String(p.employee)));
  const salaryAlerts = employees
    .filter((e) => !paidIds.has(String(e._id)))
    .map((e) => ({ employeeId: String(e._id), name: e.name, ...salaryStatus({ year, month, dueDay: e.salaryDueDay, paidOn: null, today }) }))
    .filter((s) => s.status === 'pending');

  return {
    documents: docAlerts,
    serviceDue,
    mileageDrops,
    salaryPending: salaryAlerts,
    repairsPending: pendingRepairs.map((r) => ({ id: String(r._id), registrationNumber: r.vehicle?.registrationNumber, description: r.description, repairedAt: r.repairedAt })),
  };
}

/** Latest 15 expense entries across all types, for the dashboard activity feed. */
export async function recentActivity(limit = 15) {
  const [fuel, repairs, salaries, other] = await Promise.all([
    FuelEntry.find(NOT_DELETED).populate('vehicle', 'registrationNumber').sort({ createdAt: -1 }).limit(limit).lean(),
    RepairEntry.find(NOT_DELETED).populate('vehicle', 'registrationNumber').sort({ createdAt: -1 }).limit(limit).lean(),
    SalaryPayment.find(NOT_DELETED).populate('employee', 'name').sort({ createdAt: -1 }).limit(limit).lean(),
    OtherExpense.find(NOT_DELETED).sort({ createdAt: -1 }).limit(limit).lean(),
  ]);
  const rows = [
    ...fuel.map((f) => ({ type: 'fuel', id: String(f._id), description: `Fuel — ${f.vehicle?.registrationNumber || ''}`, amount: f.amount, at: f.createdAt, by: f.createdBy })),
    ...repairs.map((r) => ({ type: 'repair', id: String(r._id), description: `${r.category} — ${r.vehicle?.registrationNumber || ''}`, amount: r.total, at: r.createdAt, by: r.createdBy })),
    ...salaries.map((s) => ({ type: 'salary', id: String(s._id), description: `Salary — ${s.employee?.name || ''}`, amount: s.netPaid, at: s.createdAt, by: s.recordedBy })),
    ...other.map((o) => ({ type: 'other', id: String(o._id), description: `${o.category} — ${o.description}`, amount: o.amount, at: o.createdAt, by: o.createdBy })),
  ];
  return rows.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}

export { oid, NOT_DELETED, monthRange, yearRange };
