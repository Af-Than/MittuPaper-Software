import { AuditLog, Bill, Customer, LoginLog } from '../models/index.js';
import { dashboardSummary, yearlyReport } from '../services/reports.js';
import { customerBillWorkbook, monthlyWorkbook, sendWorkbook, yearlyWorkbook } from '../services/excel.js';
import { billFilter } from './billController.js';
import { dueSummaryMap, liveDueBreakdown } from '../services/billingService.js';
import { notFound, paging } from '../utils/http.js';

export async function dashboard(_req, res) {
  res.json(await dashboardSummary());
}

export async function yearly(req, res) {
  const { year, customer } = req.query;
  res.json(await yearlyReport(Number(year), customer || undefined));
}

export async function logins(req, res) {
  const { page, limit, skip } = paging(req.query, 20, 100);
  const [total, items] = await Promise.all([
    LoginLog.countDocuments(),
    LoginLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function audits(req, res) {
  const { page, limit, skip } = paging(req.query, 20, 100);
  const [total, items] = await Promise.all([
    AuditLog.countDocuments(),
    AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

// ---- Excel downloads ----

export async function exportBill(req, res) {
  const { customer: customerId, year, month } = req.query;
  const [customer, bill] = await Promise.all([
    Customer.findById(customerId).lean(),
    Bill.findOne({ customer: customerId, year, month }).lean(),
  ]);
  if (!customer) throw notFound('Customer not found');
  if (!bill) throw notFound('Generate the bill first, then download it');
  bill.dueBreakdown = await liveDueBreakdown(customerId, Number(year), Number(month), { excludeBillId: bill._id });
  const wb = customerBillWorkbook(bill, customer);
  await sendWorkbook(res, wb, `bill-${year}-${String(month).padStart(2, '0')}-${String(customer._id).slice(-6)}.xlsx`);
}

export async function exportMonthly(req, res) {
  const { year, month } = req.query;
  const filter = await billFilter(req.query);
  const bills = await Bill.find(filter).select('-days').populate('customer', 'name phone').lean();
  bills.sort((a, b) => (a.customer?.name || '').localeCompare(b.customer?.name || ''));
  const dueMap = await dueSummaryMap(bills.map((b) => b.customer?._id).filter(Boolean));
  for (const b of bills) b.dueMonths = dueMap.get(String(b.customer?._id))?.months || [];
  await sendWorkbook(res, monthlyWorkbook(bills, year, month), `monthly-bills-${year}-${String(month).padStart(2, '0')}.xlsx`);
}

export async function exportYearly(req, res) {
  const { year, customer } = req.query;
  const report = await yearlyReport(year, customer || undefined);
  await sendWorkbook(res, yearlyWorkbook(report), `yearly-report-${year}.xlsx`);
}
