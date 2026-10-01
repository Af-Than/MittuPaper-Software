import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';
import { dateStr, idParam, monthQuery, objectId, paise, phone, pageQuery, yearNum, monthNum } from '../utils/schemas.js';

import * as auth from '../controllers/authController.js';
import * as customers from '../controllers/customerController.js';
import * as publications from '../controllers/publicationController.js';
import * as subscriptions from '../controllers/subscriptionController.js';
import * as adjustments from '../controllers/adjustmentController.js';
import * as bills from '../controllers/billController.js';
import * as payments from '../controllers/paymentController.js';
import * as reports from '../controllers/reportController.js';

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
});
router.get(
  '/customers',
  validate(pageQuery.extend({ q: z.string().optional(), filter: z.enum(['all', 'active', 'inactive', 'dues']).optional() }).passthrough(), 'query'),
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
  validate(pubBody.extend({ initialRate: paise, effectiveFrom: dateStr.optional() })),
  h(publications.create)
);
router.put('/publications/:id', validate(idParam, 'params'), validate(pubBody.partial()), h(publications.update));
router.post(
  '/publications/:id/rates',
  validate(idParam, 'params'),
  validate(z.object({ ratePerCopy: paise, effectiveFrom: dateStr })),
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
router.post(
  '/payments',
  validate(
    z.object({
      bill: objectId,
      amount: z.coerce.number().int().min(1, 'Enter an amount greater than zero'),
      date: dateStr,
      mode: z.enum(['cash', 'upi', 'other']).default('cash'),
      note: z.string().trim().max(200).optional().default(''),
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

export default router;
