/**
 * Database-backed billing orchestration. All arithmetic lives in billing.js (pure);
 * this module loads inputs, persists bills and keeps the carry-forward chain consistent.
 */
import mongoose from 'mongoose';
import { Bill, Customer, DeliveryAdjustment, Payment, Subscription } from '../models/index.js';
import { computeMonthlyBill, settleBill, daysInMonth } from './billing.js';
import { HttpError, conflict, notFound } from '../utils/http.js';
import { monthLabel } from '../utils/money.js';

const before = (year, month) => ({ $or: [{ year: { $lt: year } }, { year, month: { $lt: month } }] });
const after = (year, month) => ({ $or: [{ year: { $gt: year } }, { year, month: { $gt: month } }] });

/** The customer's most recent bill strictly before the given month (its balance carries forward). */
export function previousBillFor(customerId, year, month) {
  return Bill.findOne({ customer: customerId, ...before(year, month) }).sort({ year: -1, month: -1 });
}

export function hasLaterBill(customerId, year, month) {
  return Bill.exists({ customer: customerId, ...after(year, month) });
}

/** Map<customerId, { balance, year, month, billId }> of each customer's latest bill. */
export async function latestBillMap(customerIds) {
  const match = customerIds ? [{ $match: { customer: { $in: customerIds } } }] : [];
  const rows = await Bill.aggregate([
    ...match,
    { $sort: { year: -1, month: -1 } },
    {
      $group: {
        _id: '$customer',
        balance: { $first: '$balance' },
        year: { $first: '$year' },
        month: { $first: '$month' },
        billId: { $first: '$_id' },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

/** Adds `carriedForward: true` to bills that have a newer bill for the same customer. */
export async function annotateBills(bills) {
  const ids = [...new Set(bills.map((b) => String(b.customer?._id || b.customer)))];
  const latest = await latestBillMap(ids.map((i) => new mongoose.Types.ObjectId(i)));
  return bills.map((b) => {
    const l = latest.get(String(b.customer?._id || b.customer));
    const carriedForward = !!l && (l.year > b.year || (l.year === b.year && l.month > b.month));
    return { ...(b.toObject ? b.toObject() : b), carriedForward };
  });
}

/** Compute (without saving) a customer's bill for a month using live subscriptions & adjustments. */
export async function computeForCustomer(customerId, year, month) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month - 1, daysInMonth(year, month)));

  const [subs, adjustments, prev] = await Promise.all([
    Subscription.find({
      customer: customerId,
      startDate: { $lte: monthEnd },
      $or: [{ endDate: null }, { endDate: { $gte: monthStart } }],
    }).populate('publication'),
    DeliveryAdjustment.find({ customer: customerId, date: { $gte: monthStart, $lte: monthEnd } }).lean(),
    previousBillFor(customerId, year, month),
  ]);

  const subscriptions = subs
    .filter((s) => s.publication)
    .map((s) => ({
      publicationId: String(s.publication._id),
      publicationName: s.publication.name,
      mode: s.mode,
      weekdays: s.weekdays,
      copiesPerMonth: s.copiesPerMonth,
      quantity: s.quantity,
      startDate: s.startDate,
      endDate: s.endDate,
      rateHistory: s.publication.rates,
    }));

  const computed = computeMonthlyBill({
    year,
    month,
    subscriptions,
    adjustments,
    previousDue: prev ? prev.balance : 0,
  });
  return { computed, previousBill: prev };
}

/**
 * Re-chain every bill AFTER the given month so previousDue / total / balance / status follow the
 * changed balance. Amounts already paid on later bills are kept.
 */
export async function cascadeFrom(customerId, year, month, startingBalance) {
  const later = await Bill.find({ customer: customerId, ...after(year, month) }).sort({ year: 1, month: 1 });
  let carry = startingBalance;
  for (const b of later) {
    b.previousDue = carry;
    Object.assign(b, settleBill(b));
    await b.save();
    carry = b.balance;
  }
}

/** Generate (or refresh) one customer's bill. Fully paid bills are locked. */
export async function generateBill(customerId, year, month, admin) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw notFound('Customer not found');

  const existing = await Bill.findOne({ customer: customerId, year, month });
  if (existing && existing.balance === 0 && existing.amountPaid > 0) {
    throw conflict(`The ${monthLabel(year, month)} bill is already fully paid and cannot be regenerated`);
  }

  const { computed } = await computeForCustomer(customerId, year, month);
  const bill = existing || new Bill({ customer: customerId, year, month });
  bill.lineItems = computed.lineItems.map((l) => ({ ...l, publication: l.publicationId }));
  bill.days = computed.days.map((d) => ({
    ...d,
    items: d.items.map((i) => ({ ...i, publication: i.publicationId })),
  }));
  bill.currentCharges = computed.currentCharges;
  bill.previousDue = computed.previousDue;
  bill.amountPaid = existing ? existing.amountPaid : 0;
  Object.assign(bill, settleBill(bill));
  bill.generatedAt = new Date();
  bill.generatedBy = admin?.id;
  bill.generatedByName = admin?.name || '';
  await bill.save();

  await cascadeFrom(customerId, year, month, bill.balance);
  return bill;
}

/** Generate bills for every active customer that has something to bill (or a due to carry). */
export async function generateAll(year, month, admin) {
  const customers = await Customer.find({ active: true }).sort({ name: 1 });
  const result = { generated: 0, skippedPaid: 0, skippedEmpty: 0, failed: [] };
  for (const c of customers) {
    try {
      const existing = await Bill.findOne({ customer: c._id, year, month });
      if (existing && existing.balance === 0 && existing.amountPaid > 0) {
        result.skippedPaid++;
        continue;
      }
      const { computed } = await computeForCustomer(c._id, year, month);
      if (!existing && computed.lineItems.length === 0 && computed.previousDue === 0) {
        result.skippedEmpty++;
        continue;
      }
      await generateBill(c._id, year, month, admin);
      result.generated++;
    } catch (err) {
      result.failed.push({ customer: c.name, message: err.message });
    }
  }
  return result;
}

/**
 * Record a payment. Only a customer's latest bill accepts payments: dues of earlier months are
 * already rolled into it, so paying there keeps the carry-forward chain consistent.
 */
export async function recordPayment({ billId, amount, date, mode, note, admin }) {
  const bill = await Bill.findById(billId);
  if (!bill) throw notFound('Bill not found');

  if (await hasLaterBill(bill.customer, bill.year, bill.month)) {
    throw conflict(
      `This bill's balance has been carried forward into a later bill. Record the payment against the customer's latest bill instead.`
    );
  }
  if (bill.balance === 0) throw conflict('This bill is already fully paid');
  if (amount > bill.balance) throw new HttpError(400, 'Payment exceeds the outstanding balance', 'BAD_REQUEST');

  const payment = await Payment.create({
    customer: bill.customer,
    bill: bill._id,
    amount,
    date,
    mode,
    note,
    recordedBy: admin?.id,
    recordedByName: admin?.name || '',
  });
  bill.amountPaid += amount;
  Object.assign(bill, settleBill(bill));
  await bill.save();
  return { payment, bill };
}

/** Remove a customer and everything that belongs to them. */
export async function deleteCustomerCascade(customerId) {
  await Promise.all([
    Subscription.deleteMany({ customer: customerId }),
    DeliveryAdjustment.deleteMany({ customer: customerId }),
    Payment.deleteMany({ customer: customerId }),
    Bill.deleteMany({ customer: customerId }),
  ]);
  await Customer.findByIdAndDelete(customerId);
}
