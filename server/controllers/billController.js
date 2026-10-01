import mongoose from 'mongoose';
import { Bill, Customer } from '../models/index.js';
import {
  computeForCustomer,
  dueSummaryMap,
  generateAll as generateAllBills,
  generateBill,
  liveDueBreakdown,
} from '../services/billingService.js';
import { totalPending } from '../services/dues.js';
import { escapeRegex, notFound, paging } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { monthLabel, formatPaise } from '../utils/money.js';

/** Build the Mongo filter shared by the list and its totals/export. `minAgeMonths` needs a
 * customer-id lookup first since "how overdue" is a cross-bill, not a per-bill, property. */
export async function billFilter({ year, month, status, customer, q, minAgeMonths }) {
  const f = {};
  if (year) f.year = Number(year);
  if (month) f.month = Number(month);
  if (status) f.status = status;
  if (customer) f.customer = new mongoose.Types.ObjectId(customer);
  if (q && q.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    const ids = await Customer.find({ $or: [{ name: rx }, { phone: rx }] }).distinct('_id');
    f.customer = { $in: ids };
  }
  if (minAgeMonths) {
    const ids = await Customer.find({}).distinct('_id');
    const map = await dueSummaryMap(ids);
    const overdue = ids.filter((id) => (map.get(String(id))?.oldest?.ageInMonths || 0) >= Number(minAgeMonths));
    const existing = f.customer?.$in || (f.customer ? [f.customer] : null);
    f.customer = { $in: existing ? overdue.filter((id) => existing.some((e) => String(e) === String(id))) : overdue };
  }
  return f;
}

/** Attach the live "due months" summary (as of today) to a page of bills, grouped by customer. */
async function withDueMonths(bills) {
  const ids = [...new Set(bills.map((b) => String(b.customer?._id || b.customer)))];
  const map = await dueSummaryMap(ids);
  return bills.map((b) => {
    const obj = b.toObject ? b.toObject() : b;
    const d = map.get(String(b.customer?._id || b.customer)) || { months: [], due: 0, oldest: null };
    return { ...obj, dueMonths: d.months, totalDue: d.due, oldestDue: d.oldest };
  });
}

export async function list(req, res) {
  const { page, limit, skip } = paging(req.query, 200, 500);
  const filter = await billFilter(req.query);
  const [total, bills, totalsRows] = await Promise.all([
    Bill.countDocuments(filter),
    Bill.find(filter).select('-days').populate('customer', 'name phone address').sort({ year: -1, month: -1 }).skip(skip).limit(limit),
    Bill.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          currentCharges: { $sum: '$currentCharges' },
          previousDue: { $sum: '$previousDue' },
          totalPayable: { $sum: '$totalPayable' },
          amountPaid: { $sum: '$amountPaid' },
          balance: { $sum: '$balance' },
        },
      },
    ]),
  ]);

  let items = await withDueMonths(bills);
  items = items.sort(
    (a, b) => b.year - a.year || b.month - a.month || (a.customer?.name || '').localeCompare(b.customer?.name || '')
  );
  const { _id, ...totals } = totalsRows[0] || {};
  res.json({
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    totals: { currentCharges: 0, previousDue: 0, totalPayable: 0, amountPaid: 0, balance: 0, ...totals },
  });
}

/**
 * Invoice view for customer + month: the saved bill (if generated) and a live computation, both
 * carrying the live due-months breakdown (never a stale stored number).
 */
export async function view(req, res) {
  const { customer: customerId, year, month } = req.query;
  const customer = await Customer.findById(customerId).lean();
  if (!customer) throw notFound('Customer not found');

  const [stored, { computed, dueBreakdown }] = await Promise.all([
    Bill.findOne({ customer: customerId, year, month }),
    computeForCustomer(customerId, year, month),
  ]);

  const bill = stored ? stored.toObject() : null;
  if (bill) bill.dueBreakdown = await liveDueBreakdown(customerId, year, month, { excludeBillId: bill._id });
  const stale = !!stored && (stored.currentCharges !== computed.currentCharges || stored.previousDue !== totalPending(dueBreakdown));
  res.json({ customer, bill, computed: { ...computed, dueBreakdown }, stale });
}

export async function get(req, res) {
  const bill = await Bill.findById(req.params.id).populate('customer', 'name phone address');
  if (!bill) throw notFound('Bill not found');
  const out = bill.toObject();
  out.dueBreakdown = await liveDueBreakdown(bill.customer._id, bill.year, bill.month, { excludeBillId: bill._id });
  res.json(out);
}

export async function generate(req, res) {
  const { customer, year, month } = req.body;
  const existed = await Bill.exists({ customer, year, month });
  const bill = await generateBill(customer, year, month, req.admin);
  const c = await Customer.findById(customer).select('name');
  await audit(
    req,
    existed ? 'bill.regenerated' : 'bill.generated',
    'Bill',
    bill._id,
    `${existed ? 'Refreshed' : 'Generated'} ${monthLabel(year, month)} bill for ${c?.name} (${formatPaise(bill.totalPayable)})`
  );
  const out = bill.toObject();
  out.dueBreakdown = await liveDueBreakdown(customer, year, month, { excludeBillId: bill._id });
  res.status(existed ? 200 : 201).json(out);
}

export async function generateAll(req, res) {
  const { year, month } = req.body;
  const result = await generateAllBills(year, month, req.admin);
  await audit(
    req,
    'bill.generated',
    'Bill',
    '',
    `Bulk-generated ${monthLabel(year, month)} bills: ${result.generated} generated, ${result.skippedPaid} paid (kept), ${result.skippedEmpty} with nothing to bill`
  );
  res.json(result);
}
