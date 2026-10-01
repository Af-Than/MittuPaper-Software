import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';
import { dateStr, dateTimeStr, idParam, monthQuery, objectId, paise, phone, registrationNumber, pageQuery, yearNum, monthNum } from '../utils/schemas.js';

import * as auth from '../controllers/authController.js';
import * as customers from '../controllers/customerController.js';
import * as publications from '../controllers/publicationController.js';
import * as subscriptions from '../controllers/subscriptionController.js';
import * as adjustments from '../controllers/adjustmentController.js';
import * as bills from '../controllers/billController.js';
import * as payments from '../controllers/paymentController.js';
import * as reports from '../controllers/reportController.js';
import * as employees from '../controllers/employeeController.js';
import * as vehicles from '../controllers/vehicleController.js';
import * as fuel from '../controllers/fuelController.js';
import * as repairs from '../controllers/repairController.js';
import * as salaries from '../controllers/salaryController.js';
import * as otherExpenses from '../controllers/otherExpenseController.js';
import * as expenseReports from '../controllers/expenseReportController.js';

const router = Router();
const h = asyncHandler;

// ---------- Auth (the only public routes) ----------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts. Please try again in a few minutes.', code: 'RATE_LIMITED' } },
});
router.post(
  '/auth/login',
  loginLimiter,
  validate(z.object({ username: z.string().trim().min(1, 'Enter your username'), password: z.string().min(1, 'Enter your password') })),
  h(auth.login)
);
router.post('/auth/logout', auth.logout);

// Everything below requires a signed-in admin.
router.use(requireAuth);
router.get('/auth/me', auth.me);

// ---------- Dashboard ----------
router.get('/dashboard', h(reports.dashboard));

// ---------- Customers ----------
const customerBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  address: z.string().trim().min(1, 'Address is required').max(300),
  phone,
  notes: z.string().trim().max(500).optional().default(''),
  active: z.boolean().optional(),
  employee: objectId.nullable().optional(),
  routeName: z.string().trim().max(80).optional().default(''),
});
router.get(
  '/customers',
  validate(pageQuery.extend({ q: z.string().optional(), filter: z.enum(['all', 'active', 'inactive', 'dues', 'overdue']).optional() }).passthrough(), 'query'),
  h(customers.list)
);
router.post('/customers', validate(customerBody), h(customers.create));
router.get('/customers/:id', validate(idParam, 'params'), h(customers.get));
router.put('/customers/:id', validate(idParam, 'params'), validate(customerBody), h(customers.update));
router.delete('/customers/:id', validate(idParam, 'params'), h(customers.remove));

// ---------- Publications & rates ----------
const pubBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  type: z.enum(['newspaper', 'magazine']),
  language: z.string().trim().min(1, 'Language is required'),
  frequency: z.enum(['daily', 'weekly', 'fortnightly', 'monthly']),
  active: z.boolean().optional(),
});
router.get('/publications', validate(z.object({ type: z.enum(['newspaper', 'magazine']).optional() }).passthrough(), 'query'), h(publications.list));
router.post(
  '/publications',
  validate(pubBody.extend({ initialRate: paise, agencyCost: paise.optional().default(0), effectiveFrom: dateStr.optional() })),
  h(publications.create)
);
router.put('/publications/:id', validate(idParam, 'params'), validate(pubBody.partial()), h(publications.update));
router.post(
  '/publications/:id/rates',
  validate(idParam, 'params'),
  validate(z.object({ ratePerCopy: paise, agencyCostPerCopy: paise.optional().default(0), effectiveFrom: dateStr })),
  h(publications.addRate)
);

// ---------- Subscriptions ----------
const subBody = z
  .object({
    customer: objectId,
    publication: objectId,
    startDate: dateStr,
    endDate: dateStr.nullable().optional(),
    mode: z.enum(['weekdays', 'fixedPerMonth']),
    weekdays: z.array(z.number().int().min(0).max(6)).default([]),
    copiesPerMonth: z.coerce.number().int().min(0).default(0),
    quantity: z.coerce.number().int().min(1).default(1),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'weekdays' && v.weekdays.length === 0)
      ctx.addIssue({ code: 'custom', path: ['weekdays'], message: 'Choose at least one delivery day' });
    if (v.mode === 'fixedPerMonth' && v.copiesPerMonth < 1)
      ctx.addIssue({ code: 'custom', path: ['copiesPerMonth'], message: 'Enter copies per month (at least 1)' });
    if (v.endDate && v.endDate < v.startDate)
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot be before the start date' });
  });
router.get('/subscriptions', validate(z.object({ customer: objectId.optional() }).passthrough(), 'query'), h(subscriptions.list));
router.post('/subscriptions', validate(subBody), h(subscriptions.create));
router.put('/subscriptions/:id', validate(idParam, 'params'), validate(subBody), h(subscriptions.update));
router.delete('/subscriptions/:id', validate(idParam, 'params'), h(subscriptions.remove));

// ---------- Delivery adjustments (skipped / extra) ----------
router.get(
  '/adjustments',
  validate(z.object({ customer: objectId, year: yearNum.optional(), month: monthNum.optional() }).passthrough(), 'query'),
  h(adjustments.list)
);
router.post(
  '/adjustments',
  validate(
    z
      .object({
        customer: objectId,
        publication: objectId.nullable().optional().default(null),
        date: dateStr,
        type: z.enum(['skipped', 'extra']),
        quantity: z.coerce.number().int().min(1).max(100).default(1),
        note: z.string().trim().max(200).optional().default(''),
      })
      .refine((v) => v.type === 'skipped' || v.publication, { path: ['publication'], message: 'Choose a publication for extra copies' })
  ),
  h(adjustments.create)
);
router.delete('/adjustments/:id', validate(idParam, 'params'), h(adjustments.remove));

// ---------- Bills ----------
const billListQuery = pageQuery
  .extend({
    year: yearNum.optional(),
    month: monthNum.optional(),
    status: z.enum(['unpaid', 'partial', 'paid']).optional(),
    customer: objectId.optional(),
    q: z.string().optional(),
    minAgeMonths: z.coerce.number().int().min(1).optional(),
  })
  .passthrough();
router.get('/bills', validate(billListQuery, 'query'), h(bills.list));
router.get('/bills/view', validate(monthQuery.extend({ customer: objectId }).passthrough(), 'query'), h(bills.view));
router.post('/bills/generate', validate(monthQuery.extend({ customer: objectId })), h(bills.generate));
router.post('/bills/generate-all', validate(z.object({ year: yearNum, month: monthNum })), h(bills.generateAll));
router.get('/bills/:id', validate(idParam, 'params'), h(bills.get));

// ---------- Payments ----------
router.get(
  '/payments',
  validate(pageQuery.extend({ q: z.string().optional(), customer: objectId.optional(), mode: z.enum(['cash', 'upi', 'other']).optional() }).passthrough(), 'query'),
  h(payments.list)
);
router.get('/payments/due', validate(z.object({ customer: objectId }).passthrough(), 'query'), h(payments.due));
router.post(
  '/payments',
  validate(
    z.object({
      customer: objectId,
      amount: z.coerce.number().int().min(1, 'Enter an amount greater than zero'),
      date: dateStr,
      mode: z.enum(['cash', 'upi', 'other']).default('cash'),
      note: z.string().trim().max(200).optional().default(''),
      // Omit to auto-allocate oldest pending month first; pass a specific bill id to pay only that month.
      targetBillId: objectId.optional(),
    })
  ),
  h(payments.create)
);

// ---------- Reports, exports, activity ----------
router.get('/reports/yearly', validate(z.object({ year: yearNum, customer: objectId.optional() }).passthrough(), 'query'), h(reports.yearly));
router.get('/export/bill', validate(monthQuery.extend({ customer: objectId }).passthrough(), 'query'), h(reports.exportBill));
router.get('/export/monthly', validate(monthQuery.passthrough(), 'query'), h(reports.exportMonthly));
router.get('/export/yearly', validate(z.object({ year: yearNum, customer: objectId.optional() }).passthrough(), 'query'), h(reports.exportYearly));
router.get('/activity/logins', validate(pageQuery.passthrough(), 'query'), h(reports.logins));
router.get('/activity/audit', validate(pageQuery.passthrough(), 'query'), h(reports.audits));

// ================= Expense module =================

// ---------- Employees ----------
const employeeBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone,
  role: z.enum(['delivery', 'supervisor']).default('delivery'),
  joinDate: dateStr,
  monthlySalary: paise,
  salaryDueDay: z.coerce.number().int().min(1).max(28).default(1),
  active: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().default(''),
});
router.get('/employees', validate(pageQuery.extend({ q: z.string().optional(), active: z.enum(['true', 'false']).optional() }).passthrough(), 'query'), h(employees.list));
router.post('/employees', validate(employeeBody), h(employees.create));
router.get('/employees/:id', validate(idParam, 'params'), h(employees.get));
router.put('/employees/:id', validate(idParam, 'params'), validate(employeeBody.partial()), h(employees.update));
router.delete('/employees/:id', validate(idParam, 'params'), h(employees.remove));

// ---------- Vehicles ----------
const vehicleBody = z.object({
  registrationNumber,
  type: z.enum(['bike', 'scooter', 'mini-van', 'auto', 'ev-scooter']),
  makeModel: z.string().trim().max(80).optional().default(''),
  fuelType: z.enum(['petrol', 'diesel', 'electric']),
  assignedEmployee: objectId.nullable().optional(),
  status: z.enum(['active', 'in-repair', 'retired']).default('active'),
  odometer: z.coerce.number().int().min(0).default(0),
  insuranceExpiry: dateStr.nullable().optional(),
  pollutionExpiry: dateStr.nullable().optional(),
  fitnessExpiry: dateStr.nullable().optional(),
  lastServiceDate: dateStr.nullable().optional(),
  nextServiceDueKm: z.coerce.number().int().min(0).nullable().optional(),
  notes: z.string().trim().max(500).optional().default(''),
});
router.get('/vehicles', validate(pageQuery.extend({ q: z.string().optional(), employee: objectId.optional(), type: z.string().optional(), status: z.string().optional() }).passthrough(), 'query'), h(vehicles.list));
router.post('/vehicles', validate(vehicleBody), h(vehicles.create));
router.get('/vehicles/:id', validate(idParam, 'params'), h(vehicles.get));
router.put('/vehicles/:id', validate(idParam, 'params'), validate(vehicleBody.partial()), h(vehicles.update));
router.delete('/vehicles/:id', validate(idParam, 'params'), h(vehicles.remove));

// ---------- Fuel log ----------
const fuelBody = z.object({
  vehicle: objectId,
  employee: objectId.nullable().optional(),
  fuelledAt: dateTimeStr,
  litres: z.coerce.number().positive(),
  pricePerLitre: paise,
  amount: paise,
  odometer: z.coerce.number().int().min(0),
  station: z.string().trim().max(120).optional().default(''),
  fullTank: z.boolean().default(true),
  paymentMode: z.enum(['cash', 'upi', 'other']).default('cash'),
  receiptNo: z.string().trim().max(60).optional().default(''),
  note: z.string().trim().max(200).optional().default(''),
});
router.get('/fuel', validate(pageQuery.extend({ vehicle: objectId.optional(), employee: objectId.optional(), from: dateStr.optional(), to: dateStr.optional() }).passthrough(), 'query'), h(fuel.list));
router.post('/fuel', validate(fuelBody), h(fuel.create));
router.put('/fuel/:id', validate(idParam, 'params'), validate(fuelBody.partial()), h(fuel.update));
router.delete('/fuel/:id', validate(idParam, 'params'), h(fuel.remove));

// ---------- Repairs ----------
const repairBody = z.object({
  vehicle: objectId,
  repairedAt: dateTimeStr,
  category: z.enum(['service', 'tyre', 'brake', 'engine', 'battery', 'electrical', 'accident', 'other']),
  description: z.string().trim().min(1, 'Describe the repair').max(300),
  workshop: z.string().trim().max(120).optional().default(''),
  partsCost: paise.default(0),
  labourCost: paise.default(0),
  total: paise.optional(),
  odometer: z.coerce.number().int().min(0).nullable().optional(),
  invoiceNo: z.string().trim().max(60).optional().default(''),
  status: z.enum(['pending', 'completed']).default('completed'),
  nextServiceDate: dateStr.nullable().optional(),
  nextServiceKm: z.coerce.number().int().min(0).nullable().optional(),
  paymentMode: z.enum(['cash', 'upi', 'other']).default('cash'),
});
router.get('/repairs', validate(pageQuery.extend({ vehicle: objectId.optional(), category: z.string().optional(), status: z.string().optional(), from: dateStr.optional(), to: dateStr.optional() }).passthrough(), 'query'), h(repairs.list));
router.post('/repairs', validate(repairBody), h(repairs.create));
router.put('/repairs/:id', validate(idParam, 'params'), validate(repairBody.partial()), h(repairs.update));
router.delete('/repairs/:id', validate(idParam, 'params'), h(repairs.remove));

// ---------- Salaries & advances ----------
router.get('/salaries/grid', validate(z.object({ year: yearNum, month: monthNum }).passthrough(), 'query'), h(salaries.grid));
router.get('/salaries', validate(pageQuery.extend({ employee: objectId.optional() }).passthrough(), 'query'), h(salaries.history));
router.post(
  '/salaries',
  validate(
    z.object({
      employee: objectId,
      forYear: yearNum,
      forMonth: monthNum,
      bonus: paise.default(0),
      deductions: paise.default(0),
      advanceRecovered: paise.default(0),
      paidOn: dateTimeStr,
      mode: z.enum(['cash', 'upi', 'bank']).default('cash'),
      reference: z.string().trim().max(80).optional().default(''),
      note: z.string().trim().max(200).optional().default(''),
    })
  ),
  h(salaries.pay)
);
router.get('/salaries/:id/slip', validate(idParam, 'params'), h(salaries.slip));
router.delete('/salaries/:id', validate(idParam, 'params'), h(salaries.remove));
router.get('/advances', validate(z.object({ employee: objectId.optional() }).passthrough(), 'query'), h(salaries.listAdvances));
router.post(
  '/advances',
  validate(z.object({ employee: objectId, amount: paise, givenOn: dateStr, reason: z.string().trim().max(200).optional().default('') })),
  h(salaries.createAdvance)
);

// ---------- Other expenses ----------
const otherExpenseBody = z.object({
  category: z.enum(['rent', 'electricity', 'phone-internet', 'stationery-packing', 'publisher-payment', 'miscellaneous']),
  amount: paise,
  date: dateStr,
  description: z.string().trim().min(1, 'Describe the expense').max(300),
  paymentMode: z.enum(['cash', 'upi', 'other']).default('cash'),
});
router.get('/other-expenses', validate(pageQuery.extend({ category: z.string().optional(), from: dateStr.optional(), to: dateStr.optional() }).passthrough(), 'query'), h(otherExpenses.list));
router.post('/other-expenses', validate(otherExpenseBody), h(otherExpenses.create));
router.put('/other-expenses/:id', validate(idParam, 'params'), validate(otherExpenseBody.partial()), h(otherExpenses.update));
router.delete('/other-expenses/:id', validate(idParam, 'params'), h(otherExpenses.remove));

// ---------- Expense dashboard, ledger, P&L, delivery sheet, search, backup ----------
router.get('/expenses/dashboard', validate(z.object({ year: yearNum.optional(), month: monthNum.optional() }).passthrough(), 'query'), h(expenseReports.dashboard));
router.get('/expenses/profit-loss', validate(z.object({ year: yearNum, month: monthNum.optional() }).passthrough(), 'query'), h(expenseReports.profitLoss));
router.get(
  '/expenses/ledger',
  validate(
    pageQuery
      .extend({
        type: z.enum(['fuel', 'repair', 'salary', 'other']).optional(),
        employee: objectId.optional(),
        vehicle: objectId.optional(),
        from: dateStr.optional(),
        to: dateStr.optional(),
        minAmount: z.coerce.number().optional(),
        maxAmount: z.coerce.number().optional(),
      })
      .passthrough(),
    'query'
  ),
  h(expenseReports.ledger)
);
router.get('/delivery-sheet', validate(z.object({ date: dateStr, employee: objectId.optional() }).passthrough(), 'query'), h(expenseReports.deliverySheet));
router.get('/search', validate(z.object({ q: z.string().optional() }).passthrough(), 'query'), h(expenseReports.search));
router.get('/backup', h(expenseReports.backup));
router.get('/export/fuel', validate(z.object({ vehicle: objectId.optional(), employee: objectId.optional(), from: dateStr.optional(), to: dateStr.optional() }).passthrough(), 'query'), h(expenseReports.exportFuel));
router.get('/export/repairs', validate(z.object({ vehicle: objectId.optional(), category: z.string().optional(), status: z.string().optional(), from: dateStr.optional(), to: dateStr.optional() }).passthrough(), 'query'), h(expenseReports.exportRepairs));
router.get('/export/salaries', validate(z.object({ year: yearNum.optional(), month: monthNum.optional(), employee: objectId.optional() }).passthrough(), 'query'), h(expenseReports.exportSalaries));
router.get('/export/ledger', validate(z.object({ type: z.string().optional(), employee: objectId.optional(), vehicle: objectId.optional(), from: dateStr.optional(), to: dateStr.optional() }).passthrough(), 'query'), h(expenseReports.exportLedger));
router.get('/export/profit-loss', validate(z.object({ year: yearNum, month: monthNum.optional() }).passthrough(), 'query'), h(expenseReports.exportProfitLoss));

export default router;
