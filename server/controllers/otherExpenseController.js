import { OtherExpense } from '../models/index.js';
import { notFound, paging, parseDate } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { formatPaise } from '../utils/money.js';

const NOT_DELETED = { deletedAt: null };

export async function list(req, res) {
  const { category, from, to } = req.query;
  const { page, limit, skip } = paging(req.query, 20, 200);
  const query = { ...NOT_DELETED };
  if (category) query.category = category;
  if (from || to) query.date = { ...(from ? { $gte: parseDate(from) } : {}), ...(to ? { $lte: parseDate(to) } : {}) };
  const [total, items, sumRows] = await Promise.all([
    OtherExpense.countDocuments(query),
    OtherExpense.find(query).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    OtherExpense.aggregate([{ $match: query }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), sum: sumRows[0]?.sum || 0 });
}

export async function create(req, res) {
  const expense = await OtherExpense.create({ ...req.body, date: parseDate(req.body.date), createdBy: req.admin.id });
  await audit(req, 'expense.recorded', 'OtherExpense', expense._id, `${expense.category}: ${formatPaise(expense.amount)} — ${expense.description}`);
  res.status(201).json(expense);
}

export async function update(req, res) {
  const expense = await OtherExpense.findOne({ _id: req.params.id, ...NOT_DELETED });
  if (!expense) throw notFound('Expense not found');
  Object.assign(expense, req.body, { date: req.body.date ? parseDate(req.body.date) : expense.date });
  await expense.save();
  await audit(req, 'expense.updated', 'OtherExpense', expense._id, `Updated ${expense.category} expense (${formatPaise(expense.amount)})`);
  res.json(expense);
}

export async function remove(req, res) {
  const expense = await OtherExpense.findOne({ _id: req.params.id, ...NOT_DELETED });
  if (!expense) throw notFound('Expense not found');
  expense.deletedAt = new Date();
  await expense.save();
  await audit(req, 'expense.deleted', 'OtherExpense', expense._id, `Removed ${expense.category} expense (${formatPaise(expense.amount)})`);
  res.json({ ok: true });
}
