import { Customer, Payment } from '../models/index.js';
import { recordPayment, customerDueSummary } from '../services/billingService.js';
import { escapeRegex, notFound, paging, parseDate } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { formatPaise } from '../utils/money.js';

export async function list(req, res) {
  const { q, customer, mode } = req.query;
  const { page, limit, skip } = paging(req.query, 20, 100);
  const filter = {};
  if (customer) filter.customer = customer;
  if (mode) filter.mode = mode;
  if (q && q.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    const ids = await Customer.find({ $or: [{ name: rx }, { phone: rx }] }).distinct('_id');
    filter.$or = [{ customer: { $in: ids } }, { note: rx }];
  }
  const [total, items, sumRows] = await Promise.all([
    Payment.countDocuments(filter),
    Payment.find(filter)
      .populate('customer', 'name phone')
      .populate('bill', 'month year')
      .populate('allocations.bill', 'month year')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.aggregate([{ $match: filter }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), sum: sumRows[0]?.sum || 0 });
}

/** The customer's pending months, oldest first — what the Payment modal needs to render. */
export async function due(req, res) {
  const customer = await Customer.findById(req.query.customer).select('name');
  if (!customer) throw notFound('Customer not found');
  const months = await customerDueSummary(customer._id);
  res.json({ customer, months, totalDue: months.reduce((n, m) => n + m.pending, 0) });
}

export async function create(req, res) {
  const { customer, amount, date, mode, note, targetBillId } = req.body;
  const { payment, allocations } = await recordPayment({ customer, amount, date: parseDate(date), mode, note, admin: req.admin, targetBillId });
  const c = await Customer.findById(customer).select('name');
  await audit(
    req,
    'payment.recorded',
    'Payment',
    payment._id,
    `${formatPaise(amount)} (${mode}) from ${c?.name} — allocated across ${payment.allocations.length} month(s)`
  );
  res.status(201).json({ payment, allocations });
}
