import { Employee, SalaryPayment, Vehicle } from '../models/index.js';
import { costForEmployees } from '../services/expenseService.js';
import { salaryStatus } from '../services/expenses.js';
import { escapeRegex, notFound, paging } from '../utils/http.js';
import { audit } from '../utils/audit.js';

const NOT_DELETED = { deletedAt: null };

export async function list(req, res) {
  const { q, active } = req.query;
  const { page, limit, skip } = paging(req.query, 12, 100);
  const query = { ...NOT_DELETED };
  if (q && q.trim()) query.name = new RegExp(escapeRegex(q.trim()), 'i');
  if (active === 'true') query.active = true;
  if (active === 'false') query.active = false;

  const [total, employees] = await Promise.all([
    Employee.countDocuments(query),
    Employee.find(query).collation({ locale: 'en' }).sort({ name: 1 }).skip(skip).limit(limit).lean(),
  ]);
  const ids = employees.map((e) => e._id);
  const today = new Date();
  const [vehicleCounts, costs, paidThisMonth] = await Promise.all([
    Vehicle.aggregate([{ $match: { ...NOT_DELETED, assignedEmployee: { $in: ids } } }, { $group: { _id: '$assignedEmployee', n: { $sum: 1 } } }]),
    costForEmployees(ids, today.getUTCFullYear(), today.getUTCMonth() + 1),
    SalaryPayment.find({ ...NOT_DELETED, forYear: today.getUTCFullYear(), forMonth: today.getUTCMonth() + 1, employee: { $in: ids } }).lean(),
  ]);
  const vcMap = new Map(vehicleCounts.map((v) => [String(v._id), v.n]));
  const paidMap = new Map(paidThisMonth.map((p) => [String(p.employee), p]));

  const items = employees.map((e) => {
    const paid = paidMap.get(String(e._id));
    const status = salaryStatus({ year: today.getUTCFullYear(), month: today.getUTCMonth() + 1, dueDay: e.salaryDueDay, paidOn: paid?.paidOn || null, today });
    return {
      ...e,
      vehicleCount: vcMap.get(String(e._id)) || 0,
      monthCost: costs.get(String(e._id)) || { fuel: 0, repairs: 0 },
      salaryStatus: status,
    };
  });
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function get(req, res) {
  const employee = await Employee.findOne({ _id: req.params.id, ...NOT_DELETED }).lean();
  if (!employee) throw notFound('Employee not found');
  const vehicles = await Vehicle.find({ ...NOT_DELETED, assignedEmployee: employee._id }).lean();
  res.json({ ...employee, vehicles });
}

export async function create(req, res) {
  const employee = await Employee.create({ ...req.body, createdBy: req.admin.id });
  await audit(req, 'employee.created', 'Employee', employee._id, `Added employee ${employee.name}`);
  res.status(201).json(employee);
}

export async function update(req, res) {
  const before = await Employee.findOne({ _id: req.params.id, ...NOT_DELETED });
  if (!before) throw notFound('Employee not found');
  const prev = before.toObject();
  Object.assign(before, req.body);
  await before.save();
  await audit(req, 'employee.updated', 'Employee', before._id, `Updated ${before.name}${prev.active !== before.active ? (before.active ? ' (reactivated)' : ' (deactivated)') : ''}`);
  res.json(before);
}

export async function remove(req, res) {
  const employee = await Employee.findOne({ _id: req.params.id, ...NOT_DELETED });
  if (!employee) throw notFound('Employee not found');
  employee.deletedAt = new Date();
  await employee.save();
  await audit(req, 'employee.deleted', 'Employee', employee._id, `Removed employee ${employee.name}`);
  res.json({ ok: true });
}
