import mongoose from 'mongoose';
import { Bill, Customer, Payment, Subscription } from '../models/index.js';
import { dueSummaryMap } from './billingService.js';
import { pendingOf } from './dues.js';

const oid = (id) => new mongoose.Types.ObjectId(String(id));

/**
 * Year matrix: one row per customer, a { billed, paid, balance } cell per month.
 *  billed  = the month's current charges
 *  paid    = amount paid against that month's bill
 *  balance = that bill's OWN unpaid balance (its month's charges minus what was paid on it)
 * "outstanding" for the year is every bill's pending amount, dated on or before this year
 * (the due-months ledger — never a single carried-forward number).
 */
export async function yearlyReport(year, customerId) {
  const filter = { year };
  if (customerId) filter.customer = oid(customerId);
  const custFilter = customerId ? { customer: oid(customerId) } : {};
  const [bills, allBills] = await Promise.all([
    Bill.find(filter).populate('customer', 'name phone').lean(),
    // every bill up to and including this year, to compute "as of year end" outstanding correctly
    Bill.find({ ...custFilter, year: { $lte: year } }).select('customer year currentCharges amountPaid').lean(),
  ]);

  const pendingByCustomer = new Map();
  for (const b of allBills) {
    const key = String(b.customer);
    pendingByCustomer.set(key, (pendingByCustomer.get(key) || 0) + pendingOf(b));
  }

  const byCustomer = new Map();
  for (const b of bills) {
    if (!b.customer) continue;
    const key = String(b.customer._id);
    if (!byCustomer.has(key)) {
      byCustomer.set(key, {
        customer: { id: key, name: b.customer.name, phone: b.customer.phone },
        months: {},
        totalBilled: 0,
        totalPaid: 0,
        outstanding: pendingByCustomer.get(key) || 0,
      });
    }
    const row = byCustomer.get(key);
    row.months[b.month] = { billed: b.currentCharges, paid: b.amountPaid, balance: b.balance, status: b.status };
    row.totalBilled += b.currentCharges;
    row.totalPaid += b.amountPaid;
  }

  const rows = [...byCustomer.values()].sort((a, b) => a.customer.name.localeCompare(b.customer.name));
  const monthTotals = {};
  for (let m = 1; m <= 12; m++) monthTotals[m] = { billed: 0, paid: 0, balance: 0 };
  const totals = { billed: 0, paid: 0, outstanding: 0 };
  for (const r of rows) {
    for (const [m, c] of Object.entries(r.months)) {
      monthTotals[m].billed += c.billed;
      monthTotals[m].paid += c.paid;
      monthTotals[m].balance += c.balance;
    }
    totals.billed += r.totalBilled;
    totals.paid += r.totalPaid;
    totals.outstanding += r.outstanding;
  }
  return { year, rows, monthTotals, totals };
}

const monthKey = (y, m) => y * 12 + (m - 1);

export async function dashboardSummary() {
  const today = new Date();
  const [totalCustomers, activeSubscriptions, latestBill] = await Promise.all([
    Customer.countDocuments({ active: true }),
    Subscription.countDocuments({ $or: [{ endDate: null }, { endDate: { $gte: today } }] }),
    Bill.findOne().sort({ year: -1, month: -1 }).select('year month').lean(),
  ]);

  // Reference month: the most recent month that has bills (falls back to the current month).
  const ref = latestBill
    ? { year: latestBill.year, month: latestBill.month }
    : { year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 };

  // Last 6 months ending at the reference month.
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const k = monthKey(ref.year, ref.month) - i;
    months.push({ year: Math.floor(k / 12), month: (k % 12) + 1 });
  }
  const from = new Date(Date.UTC(months[0].year, months[0].month - 1, 1));
  const to = new Date(Date.UTC(ref.year, ref.month, 1));

  const [billedRows, paidRows] = await Promise.all([
    Bill.aggregate([
      { $match: { $or: months.map((m) => ({ year: m.year, month: m.month })) } },
      { $group: { _id: { y: '$year', m: '$month' }, billed: { $sum: '$currentCharges' } } },
    ]),
    Payment.aggregate([
      { $match: { date: { $gte: from, $lt: to } } },
      { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, collected: { $sum: '$amount' } } },
    ]),
  ]);
  const billedMap = new Map(billedRows.map((r) => [monthKey(r._id.y, r._id.m), r.billed]));
  const paidMap = new Map(paidRows.map((r) => [monthKey(r._id.y, r._id.m), r.collected]));
  const chart = months.map((m) => ({
    year: m.year,
    month: m.month,
    billed: billedMap.get(monthKey(m.year, m.month)) || 0,
    collected: paidMap.get(monthKey(m.year, m.month)) || 0,
  }));
  const current = chart[chart.length - 1];

  // Outstanding = every bill's pending amount across every customer; top 5 by total due.
  const allIds = await Customer.find({}).distinct('_id');
  const dueMap = await dueSummaryMap(allIds);
  let outstanding = 0;
  const dues = [];
  for (const id of allIds) {
    const d = dueMap.get(String(id));
    if (d && d.due > 0) {
      outstanding += d.due;
      dues.push({ customerId: String(id), balance: d.due, oldest: d.oldest, monthsDue: d.months.length });
    }
  }
  dues.sort((a, b) => b.balance - a.balance);
  const top = dues.slice(0, 5);
  const custs = await Customer.find({ _id: { $in: top.map((t) => t.customerId) } })
    .select('name phone')
    .lean();
  const nameOf = new Map(custs.map((c) => [String(c._id), c]));

  return {
    reference: ref,
    stats: {
      totalCustomers,
      activeSubscriptions,
      billed: current.billed,
      collected: current.collected,
      outstanding,
      customersWithDues: dues.length,
    },
    chart,
    topDues: top.map((t) => ({
      customerId: t.customerId,
      balance: t.balance,
      monthsDue: t.monthsDue,
      year: t.oldest?.year,
      month: t.oldest?.month,
      name: nameOf.get(t.customerId)?.name || 'Unknown',
      phone: nameOf.get(t.customerId)?.phone || '',
    })),
  };
}
