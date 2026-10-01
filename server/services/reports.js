import mongoose from 'mongoose';
import { Bill, Customer, Payment, Subscription } from '../models/index.js';
import { latestBillMap } from './billingService.js';

const oid = (id) => new mongoose.Types.ObjectId(String(id));

/**
 * Year matrix: one row per customer, a { billed, paid, balance } cell per month.
 *  billed  = the month's current charges
 *  paid    = amount paid against that month's bill
 *  balance = that bill's outstanding balance (includes carried dues)
 * "outstanding" for the year is the balance on the customer's last bill of the year
 * (summing monthly balances would double-count carried dues).
 */
export async function yearlyReport(year, customerId) {
  const filter = { year };
  if (customerId) filter.customer = oid(customerId);
  const bills = await Bill.find(filter).populate('customer', 'name phone').lean();

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
        outstanding: 0,
        lastMonth: 0,
      });
    }
    const row = byCustomer.get(key);
    row.months[b.month] = { billed: b.currentCharges, paid: b.amountPaid, balance: b.balance, status: b.status };
    row.totalBilled += b.currentCharges;
    row.totalPaid += b.amountPaid;
    if (b.month > row.lastMonth) {
      row.lastMonth = b.month;
      row.outstanding = b.balance;
    }
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

  // Outstanding = balance on each customer's latest bill; top 5 by amount.
  const latest = await latestBillMap();
  let outstanding = 0;
  const dues = [];
  for (const [cid, l] of latest) {
    if (l.balance > 0) {
      outstanding += l.balance;
      dues.push({ customerId: cid, balance: l.balance, year: l.year, month: l.month });
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
      ...t,
      name: nameOf.get(t.customerId)?.name || 'Unknown',
      phone: nameOf.get(t.customerId)?.phone || '',
    })),
  };
}
