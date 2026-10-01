/**
 * Database-backed billing orchestration. Arithmetic lives in billing.js (per-month charges) and
 * dues.js (the cross-month due-months ledger); this module loads inputs, persists bills/payments
 * and keeps each bill's OWN balance independent of the others.
 *
 * Ledger model: every Bill tracks only its own month's currentCharges and amountPaid
 * (balance = currentCharges - amountPaid, status derived from that alone). "Previous dues" are
 * never stored as a single rolled-up number — they are always derived by scanning a customer's
 * earlier bills for a positive balance (dues.js). `previousDue`/`totalPayable` are kept on the
 * Bill only as a generation-time snapshot (fast list totals, Excel); the live figure is whatever
 * `liveDueBreakdown` returns, and every API response uses that, not the snapshot.
 */
import mongoose from 'mongoose';
import { Bill, Customer, DeliveryAdjustment, Payment, Subscription } from '../models/index.js';
import { computeMonthlyBill, daysInMonth } from './billing.js';
import { allPendingWithAge, allocatePayment, allocateToBill, buildDueBreakdown, pendingBills, pendingOf, totalPending } from './dues.js';
import { HttpError, conflict, notFound } from '../utils/http.js';
import { monthLabel } from '../utils/money.js';

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const statusOf = (bill) => (pendingOf(bill) === 0 ? 'paid' : bill.amountPaid > 0 ? 'partial' : 'unpaid');

/** Lean bill rows for one customer, ascending by month — the shape dues.js functions expect. */
async function ledgerRows(customerId, extra = {}) {
  const rows = await Bill.find({ customer: customerId, ...extra }).sort({ year: 1, month: 1 }).select('year month currentCharges amountPaid').lean();
  return rows.map((r) => ({ billId: r._id, year: r.year, month: r.month, currentCharges: r.currentCharges, amountPaid: r.amountPaid }));
}

/** The due-months breakdown for a bill's own invoice view: every earlier unpaid month. */
export async function liveDueBreakdown(customerId, year, month, { excludeBillId } = {}) {
  const rows = await ledgerRows(customerId);
  const filtered = excludeBillId ? rows.filter((r) => String(r.billId) !== String(excludeBillId)) : rows;
  return buildDueBreakdown(filtered, year, month);
}

/** Customer-wide "as of today" due list for cards, the dashboard and the monthly table. */
export async function customerDueSummary(customerId, today = new Date()) {
  const rows = await ledgerRows(customerId);
  return allPendingWithAge(rows, today.getUTCFullYear(), today.getUTCMonth() + 1);
}

/** Batched version of customerDueSummary for many customers at once (list/grid pages). */
export async function dueSummaryMap(customerIds, today = new Date()) {
  const ids = customerIds.map(oid);
  const rows = await Bill.find({ customer: { $in: ids } }).select('customer year month currentCharges amountPaid').lean();
  const byCustomer = new Map();
  for (const r of rows) {
    const k = String(r.customer);
    if (!byCustomer.has(k)) byCustomer.set(k, []);
    byCustomer.get(k).push({ billId: r._id, year: r.year, month: r.month, currentCharges: r.currentCharges, amountPaid: r.amountPaid });
  }
  const ty = today.getUTCFullYear();
  const tm = today.getUTCMonth() + 1;
  const out = new Map();
  for (const id of customerIds) {
    const pending = allPendingWithAge(byCustomer.get(String(id)) || [], ty, tm);
    out.set(String(id), { months: pending, due: pending.reduce((n, p) => n + p.pending, 0), oldest: pending[0] || null });
  }
  return out;
}

/** Recompute the previousDue/totalPayable SNAPSHOT on every bill of a customer (after any payment). */
async function refreshSnapshots(customerId) {
  const bills = await Bill.find({ customer: customerId }).sort({ year: 1, month: 1 });
  const rows = bills.map((b) => ({ billId: b._id, year: b.year, month: b.month, currentCharges: b.currentCharges, amountPaid: b.amountPaid }));
  for (const bill of bills) {
    const breakdown = buildDueBreakdown(rows, bill.year, bill.month);
    const previousDue = totalPending(breakdown);
    const changed = bill.previousDue !== previousDue || bill.totalPayable !== bill.currentCharges + previousDue;
    bill.previousDue = previousDue;
    bill.totalPayable = bill.currentCharges + previousDue;
    bill.balance = pendingOf(bill);
    bill.status = statusOf(bill);
    if (changed || bill.isModified()) await bill.save();
  }
}

/** Compute (without saving) a customer's bill for one month using live subscriptions & adjustments. */
export async function computeForCustomer(customerId, year, month) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month - 1, daysInMonth(year, month)));

  const [subs, adjustments, dueBreakdown] = await Promise.all([
    Subscription.find({
      customer: customerId,
      startDate: { $lte: monthEnd },
      $or: [{ endDate: null }, { endDate: { $gte: monthStart } }],
    }).populate('publication'),
    DeliveryAdjustment.find({ customer: customerId, date: { $gte: monthStart, $lte: monthEnd } }).lean(),
    liveDueBreakdown(customerId, year, month),
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

  const previousDue = totalPending(dueBreakdown);
  const computed = computeMonthlyBill({ year, month, subscriptions, adjustments, previousDue });
  return { computed, dueBreakdown };
}

/** Generate (or refresh) one customer's bill for a month. A fully paid bill is locked. */
export async function generateBill(customerId, year, month, admin) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw notFound('Customer not found');

  const existing = await Bill.findOne({ customer: customerId, year, month });
  if (existing && existing.balance === 0 && existing.amountPaid > 0) {
    throw conflict(`The ${monthLabel(year, month)} bill is already fully paid and cannot be regenerated`);
  }

  const { computed, dueBreakdown } = await computeForCustomer(customerId, year, month);
  const bill = existing || new Bill({ customer: customerId, year, month, amountPaid: 0 });
  bill.lineItems = computed.lineItems.map((l) => ({ ...l, publication: l.publicationId }));
  bill.days = computed.days.map((d) => ({ ...d, items: d.items.map((i) => ({ ...i, publication: i.publicationId })) }));
  bill.currentCharges = computed.currentCharges;
  bill.previousDue = totalPending(dueBreakdown);
  bill.totalPayable = bill.currentCharges + bill.previousDue;
  bill.balance = pendingOf(bill);
  bill.status = statusOf(bill);
  bill.generatedAt = new Date();
  bill.generatedBy = admin?.id;
  bill.generatedByName = admin?.name || '';
  await bill.save();
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
      const { computed, dueBreakdown } = await computeForCustomer(c._id, year, month);
      if (!existing && computed.lineItems.length === 0 && totalPending(dueBreakdown) === 0) {
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
 * Record a payment for a customer. By default it is allocated oldest-pending-month-first across
 * every bill with a balance; pass `targetBillId` to apply the whole amount to one chosen month
 * instead (capped at that month's own pending amount).
 */
export async function recordPayment({ customer, amount, date, mode, note, admin, targetBillId }) {
  const bills = await Bill.find({ customer }).sort({ year: 1, month: 1 });
  if (!bills.length) throw notFound('This customer has no bills yet');

  const pending = pendingBills(bills.map((b) => ({ billId: b._id, year: b.year, month: b.month, currentCharges: b.currentCharges, amountPaid: b.amountPaid })));
  if (!pending.length) throw conflict('This customer has no pending balance');

  let allocations;
  try {
    allocations = targetBillId ? allocateToBill(pending, targetBillId, amount) : allocatePayment(pending, amount);
  } catch (err) {
    throw new HttpError(400, err.message, 'BAD_REQUEST');
  }

  const byId = new Map(bills.map((b) => [String(b._id), b]));
  for (const a of allocations) {
    const bill = byId.get(String(a.billId));
    bill.amountPaid += a.amount;
    bill.balance = pendingOf(bill);
    bill.status = statusOf(bill);
    await bill.save();
  }

  const payment = await Payment.create({
    customer,
    bill: allocations[0].billId,
    allocations: allocations.map((a) => ({ bill: a.billId, amount: a.amount })),
    amount,
    date,
    mode,
    note,
    recordedBy: admin?.id,
    recordedByName: admin?.name || '',
  });

  await refreshSnapshots(customer);
  const touchedBills = allocations.map((a) => byId.get(String(a.billId)));
  return { payment, bills: touchedBills, allocations };
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
