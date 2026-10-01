import mongoose from 'mongoose';
import { Bill, Customer } from '../models/index.js';
import {
  annotateBills,
  computeForCustomer,
  generateAll as generateAllBills,
  generateBill,
  hasLaterBill,
} from '../services/billingService.js';
import { escapeRegex, notFound, paging } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { monthLabel, formatPaise } from '../utils/money.js';

/** Build the Mongo filter shared by the list and its totals. */
export async function billFilter({ year, month, status, customer, q }) {
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
  return f;
}

export async function list(req, res) {
  const { page, limit, skip } = paging(req.query, 200, 500);
  const filter = await billFilter(req.query);
  const [total, bills, totalsRows] = await Promise.all([
    Bill.countDocuments(filter),
    Bill.find(filter)
      .select('-days')
      .populate('customer', 'name phone address')
      .sort({ year: -1, month: -1 })
      .skip(skip)
      .limit(limit),
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

  let items = await annotateBills(bills);
  // Stable alphabetical order by customer name within the (usually single) month
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
 * Invoice view for customer + month: the saved bill (if generated) and a live computation.
 * `stale` tells the UI that subscriptions/adjustments changed since the bill was generated.
 */
export async function view(req, res) {
  const { customer: customerId, year, month } = req.query;
  const customer = await Customer.findById(customerId).lean();
  if (!customer) throw notFound('Customer not found');

  const [stored, { computed }] = await Promise.all([
    Bill.findOne({ customer: customerId, year, month }),
    computeForCustomer(customerId, year, month),
  ]);

  let bill = null;
  let latestBill = null;
  if (stored) {
    [bill] = await annotateBills([stored]);
    if (bill.carriedForward) {
      latestBill = await Bill.findOne({ customer: customerId }).sort({ year: -1, month: -1 }).select('year month').lean();
    }
  }
  const stale = !!stored && (stored.currentCharges !== computed.currentCharges || stored.previousDue !== computed.previousDue);
  res.json({ customer, bill, computed, stale, latestBill });
}

export async function get(req, res) {
  const bill = await Bill.findById(req.params.id).populate('customer', 'name phone address');
  if (!bill) throw notFound('Bill not found');
  const [out] = await annotateBills([bill]);
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
  const [out] = await annotateBills([bill]);
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
