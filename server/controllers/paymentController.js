import { Customer, Payment } from '../models/index.js';
import { recordPayment } from '../services/billingService.js';
import { escapeRegex, paging, parseDate } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { formatPaise, monthLabel } from '../utils/money.js';

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
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.aggregate([{ $match: filter }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), sum: sumRows[0]?.sum || 0 });
}

export async function create(req, res) {
  const { bill: billId, amount, date, mode, note } = req.body;
  const { payment, bill } = await recordPayment({ billId, amount, date: parseDate(date), mode, note, admin: req.admin });
  const c = await Customer.findById(bill.customer).select('name');
  await audit(
    req,
    'payment.recorded',
    'Payment',
    payment._id,
    `${formatPaise(amount)} (${mode}) from ${c?.name} against ${monthLabel(bill.year, bill.month)} bill`
  );
  res.status(201).json({ payment, bill });
}
