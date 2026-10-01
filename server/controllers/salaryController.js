import { Employee, SalaryAdvance, SalaryPayment } from '../models/index.js';
import { isDuplicateSalary, netSalary, salaryStatus } from '../services/expenses.js';
import { conflict, notFound, paging, parseIST } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { formatPaise, monthLabel } from '../utils/money.js';

const NOT_DELETED = { deletedAt: null };

/** Grid of every active employee x the requested month, with status and (if paid) the payment. */
export async function grid(req, res) {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const [employees, payments, advances] = await Promise.all([
    Employee.find({ ...NOT_DELETED, active: true }).sort({ name: 1 }).lean(),
    SalaryPayment.find({ ...NOT_DELETED, forYear: year, forMonth: month }).lean(),
    SalaryAdvance.find(NOT_DELETED).lean(),
  ]);
  const paidMap = new Map(payments.map((p) => [String(p.employee), p]));
  const today = new Date();
  const items = employees.map((e) => {
    const paid = paidMap.get(String(e._id));
    const outstandingAdvance = advances
      .filter((a) => String(a.employee) === String(e._id))
      .reduce((n, a) => n + (a.amount - a.recoveredAmount), 0);
    return {
      employee: e,
      payment: paid || null,
      status: salaryStatus({ year, month, dueDay: e.salaryDueDay, paidOn: paid?.paidOn || null, today }),
      suggestedAdvanceRecovery: paid ? 0 : Math.min(outstandingAdvance, e.monthlySalary),
      outstandingAdvance,
    };
  });
  res.json(items);
}

export async function history(req, res) {
  const { employee } = req.query;
  const { page, limit, skip } = paging(req.query, 24, 100);
  const query = { ...NOT_DELETED, ...(employee ? { employee } : {}) };
  const [total, items] = await Promise.all([
    SalaryPayment.countDocuments(query),
    SalaryPayment.find(query).populate('employee', 'name').sort({ forYear: -1, forMonth: -1 }).skip(skip).limit(limit).lean(),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function pay(req, res) {
  const { employee: employeeId, forYear, forMonth, bonus = 0, deductions = 0, advanceRecovered = 0, paidOn, mode, reference, note } = req.body;
  const employee = await Employee.findOne({ _id: employeeId, ...NOT_DELETED });
  if (!employee) throw notFound('Employee not found');

  const existing = await SalaryPayment.find({ ...NOT_DELETED, employee: employeeId });
  if (isDuplicateSalary(existing, employeeId, forYear, forMonth)) {
    throw conflict(`${employee.name} has already been paid for ${monthLabel(forYear, forMonth)}`);
  }

  const netPaid = netSalary({ baseSalary: employee.monthlySalary, bonus, deductions, advanceRecovered });
  const payment = await SalaryPayment.create({
    employee: employeeId,
    forYear,
    forMonth,
    baseSalary: employee.monthlySalary,
    bonus,
    deductions,
    advanceRecovered,
    netPaid,
    paidOn: parseIST(paidOn),
    mode,
    reference,
    note,
    recordedBy: req.admin.id,
    recordedByName: req.admin.name,
  });

  if (advanceRecovered > 0) {
    const advances = await SalaryAdvance.find({ ...NOT_DELETED, employee: employeeId }).sort({ givenOn: 1 });
    let remaining = advanceRecovered;
    for (const a of advances) {
      if (remaining <= 0) break;
      const outstanding = a.amount - a.recoveredAmount;
      const take = Math.min(outstanding, remaining);
      if (take > 0) {
        a.recoveredAmount += take;
        remaining -= take;
        // eslint-disable-next-line no-await-in-loop
        await a.save();
      }
    }
  }

  await audit(req, 'salary.paid', 'SalaryPayment', payment._id, `Paid ${employee.name} for ${monthLabel(forYear, forMonth)}: ${formatPaise(netPaid)}`);
  res.status(201).json(await payment.populate('employee', 'name salaryDueDay'));
}

export async function slip(req, res) {
  const payment = await SalaryPayment.findOne({ _id: req.params.id, ...NOT_DELETED }).populate('employee', 'name phone role joinDate');
  if (!payment) throw notFound('Salary payment not found');
  res.json(payment);
}

export async function remove(req, res) {
  const payment = await SalaryPayment.findOne({ _id: req.params.id, ...NOT_DELETED }).populate('employee', 'name');
  if (!payment) throw notFound('Salary payment not found');
  if (payment.advanceRecovered > 0) {
    const advances = await SalaryAdvance.find({ ...NOT_DELETED, employee: payment.employee._id }).sort({ givenOn: -1 });
    let remaining = payment.advanceRecovered;
    for (const a of advances) {
      if (remaining <= 0) break;
      const give = Math.min(a.recoveredAmount, remaining);
      a.recoveredAmount -= give;
      remaining -= give;
      // eslint-disable-next-line no-await-in-loop
      await a.save();
    }
  }
  payment.deletedAt = new Date();
  await payment.save();
  await audit(req, 'salary.deleted', 'SalaryPayment', payment._id, `Removed ${monthLabel(payment.forYear, payment.forMonth)} salary payment for ${payment.employee?.name}`);
  res.json({ ok: true });
}

// ---- Advances ----
export async function listAdvances(req, res) {
  const { employee } = req.query;
  const query = { ...NOT_DELETED, ...(employee ? { employee } : {}) };
  res.json(await SalaryAdvance.find(query).populate('employee', 'name').sort({ givenOn: -1 }).lean());
}

export async function createAdvance(req, res) {
  const employee = await Employee.findOne({ _id: req.body.employee, ...NOT_DELETED });
  if (!employee) throw notFound('Employee not found');
  const advance = await SalaryAdvance.create({ ...req.body, givenOn: parseDate(req.body.givenOn), createdBy: req.admin.id });
  await audit(req, 'advance.given', 'SalaryAdvance', advance._id, `Advance of ${formatPaise(advance.amount)} to ${employee.name}`);
  res.status(201).json(await advance.populate('employee', 'name'));
}
