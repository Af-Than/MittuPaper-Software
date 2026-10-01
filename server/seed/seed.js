/**
 * Seed script.   npm run seed            -> create admins + demo data (skips demo data if present)
 *                npm run seed -- --reset -> wipe the database first, then seed everything
 * Safe to re-run. Admin accounts are the ONLY way accounts are created (no signup route).
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import {
  Admin, AuditLog, Bill, Customer, DeliveryAdjustment, Employee, FuelEntry, LoginLog, OtherExpense,
  Payment, Publication, RepairEntry, SalaryAdvance, SalaryPayment, Subscription, Vehicle,
} from '../models/index.js';
import { generateBill, recordPayment } from '../services/billingService.js';
import { daysInMonth, pad2 } from '../services/billing.js';
import { netSalary } from '../services/expenses.js';
import { formatPaise, monthLabel } from '../utils/money.js';
import { parseDate, parseIST } from '../utils/http.js';

const RESET = process.argv.includes('--reset');
const SEED_MONTHS = 6; // number of past months to generate bills for

// Deterministic pseudo-random numbers so every demo looks the same
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260101);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// ---------- month helpers (relative to today so the demo is always "recent") ----------
const now = new Date();
const curIdx = now.getUTCFullYear() * 12 + now.getUTCMonth();
const months = Array.from({ length: SEED_MONTHS }, (_, i) => {
  const k = curIdx - (SEED_MONTHS - i);
  return { year: Math.floor(k / 12), month: (k % 12) + 1 };
});
const monthAt = (i) => {
  const k = curIdx - (SEED_MONTHS - i);
  return { year: Math.floor(k / 12), month: (k % 12) + 1 };
};
const ymd = (i, day) => {
  const { year, month } = monthAt(i);
  return `${year}-${pad2(month)}-${pad2(Math.min(day, daysInMonth(year, month)))}`;
};
const todayKey = now.toISOString().slice(0, 10);

// ---------- demo data ----------
const PUBLICATIONS = [
  // name, type, language, frequency, [ [rate paise, effective date | {m: idx, d: day}] ]
  ['Mathrubhumi', 'newspaper', 'Malayalam', 'daily', [[900, '2024-01-01'], [1000, { m: 3, d: 15 }]]],
  ['Malayala Manorama', 'newspaper', 'Malayalam', 'daily', [[1000, '2024-01-01'], [1100, { m: 5, d: 1 }]]],
  ['Deshabhimani', 'newspaper', 'Malayalam', 'daily', [[800, '2024-01-01']]],
  ['Madhyamam', 'newspaper', 'Malayalam', 'daily', [[900, '2024-01-01']]],
  ['Kerala Kaumudi', 'newspaper', 'Malayalam', 'daily', [[900, '2024-01-01']]],
  ['Deepika', 'newspaper', 'Malayalam', 'daily', [[900, '2024-01-01']]],
  ['Janmabhumi', 'newspaper', 'Malayalam', 'daily', [[800, '2024-01-01']]],
  ['The Hindu', 'newspaper', 'English', 'daily', [[1400, '2024-01-01'], [1500, { m: 2, d: 10 }]]],
  ['Vanitha', 'magazine', 'Malayalam', 'fortnightly', [[6000, '2024-01-01']]],
  ['Grihalakshmi', 'magazine', 'Malayalam', 'monthly', [[4500, '2024-01-01']]],
  ['Balarama', 'magazine', 'Malayalam', 'weekly', [[2500, '2024-01-01']]],
  ['Bhashaposhini', 'magazine', 'Malayalam', 'monthly', [[3500, '2024-01-01']]],
  ['Mathrubhumi Arogya Masika', 'magazine', 'Malayalam', 'monthly', [[4000, '2024-01-01']]],
  ['Kalakaumudi', 'magazine', 'Malayalam', 'weekly', [[3000, '2024-01-01']]],
];

// Subscription shorthand: 'daily' | 'monfri' | 'sun' | 'satsun' | ['wk', dayIndex] | ['fixed', n]
// optional 3rd item overrides: { start: ymdString, end: ymdString }
const CUSTOMERS = [
  ['Rajesh Nair', '12/45 Vellayambalam Road, Thiruvananthapuram 695010', '9847012345', [['Mathrubhumi', 'daily'], ['The Hindu', 'monfri'], ['Vanitha', ['fixed', 2]]]],
  ['അനിൽ കുമാർ', 'ശ്രീനിലയം, പേരൂർക്കട, തിരുവനന്തപുരം - 695005', '9447123456', [['Malayala Manorama', 'daily'], ['Balarama', ['wk', 4]]]],
  ['Sunitha Menon', 'Kailas, Kadavanthra, Kochi 682020', '9895234567', [['Mathrubhumi', 'daily'], ['Grihalakshmi', ['fixed', 1]]]],
  ['സുനിത രാജൻ', 'അമ്പാടി, ചേർത്തല, ആലപ്പുഴ - 688524', '9946345678', [['Deshabhimani', 'daily']]],
  ['Mohammed Shafi', 'Pulikkal House, Kondotty, Malappuram 673638', '9744456789', [['Madhyamam', 'daily']]],
  ['ലക്ഷ്മി നായർ', 'പുതുപ്പറമ്പിൽ ഹൗസ്, കോട്ടയം - 686001', '9961567890', [['Malayala Manorama', 'daily'], ['Vanitha', ['fixed', 2]], ['Bhashaposhini', ['fixed', 1]]]],
  ['Joseph Mathew', 'Kizhakkethil, Pala, Kottayam 686575', '9495678901', [['Deepika', 'daily'], ['Balarama', ['wk', 4]]]],
  ['ബിന്ദു രാജേഷ്', 'കാരക്കാട്ട് ഹൗസ്, തൃശ്ശൂർ - 680001', '9846789012', [['Mathrubhumi', 'daily']]],
  ['Sheela Thomas', 'Vattakkunnel, Muvattupuzha, Ernakulam 686661', '9847890123', [['Malayala Manorama', 'monfri'], ['Grihalakshmi', ['fixed', 1]]]],
  ['സജീവൻ ടി.കെ.', 'നെല്ലിക്കുന്ന്, കോഴിക്കോട് - 673001', '9745901234', [['Mathrubhumi', 'daily'], ['Kalakaumudi', ['wk', 0]]]],
  ['Fathima Beevi', 'Beevi Manzil, Thalassery, Kannur 670101', '9946012987', [['Madhyamam', 'daily'], ['Bhashaposhini', ['fixed', 1]]]],
  ['ജോസഫ് മാത്യു', 'ഈസ്റ്റ് ഹിൽ, കണ്ണൂർ - 670002', '9895123450', [['Deepika', 'satsun']]],
  ['Anand Krishnan', 'Sreevalsam, Attingal, Thiruvananthapuram 695101', '9447234501', [['Kerala Kaumudi', 'daily'], ['Mathrubhumi Arogya Masika', ['fixed', 1]]]],
  ['Priya Varghese', 'Mangalath, Thiruvalla, Pathanamthitta 689101', '9961345012', [['Malayala Manorama', 'daily', { start: 'm2:12' }]]],
  ['ഗീത ശ്രീകുമാർ', 'ഗീതാഞ്ജലി, കൊല്ലം - 691001', '9846456123', [['Kerala Kaumudi', 'daily'], ['Vanitha', ['fixed', 2]]]],
  ['Suresh Babu', 'TC 25/1043, Pattom, Thiruvananthapuram 695004', '9847567234', [['The Hindu', 'daily'], ['Mathrubhumi', 'daily']]],
  ['Abdul Rahman', 'Rahmath, Beach Road, Kozhikode 673032', '9744678345', [['Madhyamam', 'daily'], ['The Hindu', 'sun', { end: 'm4:20' }]]],
  ['Latha Pillai', 'Chandrika, Kottarakkara, Kollam 691506', '9961789456', [['Janmabhumi', 'daily'], ['Balarama', ['wk', 4]]]],
  ['ഷാജി ജോൺ', 'കല്ലറയ്ക്കൽ, കുമരകം, കോട്ടയം - 686563', '9495890567', [['Malayala Manorama', 'daily'], ['Grihalakshmi', ['fixed', 1]]]],
  ['Divya Menon', 'Flat 4B, Sreekandath Apartments, Palarivattom, Kochi 682025', '9895901678', [['The Hindu', 'daily'], ['Mathrubhumi', 'sun'], ['Vanitha', ['fixed', 2]]]],
];

const WEEKDAY_PRESETS = { daily: [0, 1, 2, 3, 4, 5, 6], monfri: [1, 2, 3, 4, 5], sun: [0], satsun: [0, 6] };
const resolveDate = (v, fallback) => {
  if (!v) return fallback;
  const m = /^m(\d):(\d+)$/.exec(v);
  return m ? ymd(Number(m[1]), Number(m[2])) : v;
};

const NOTES = { 0: 'Prefers delivery before 6 AM', 5: 'Gate key with the neighbour', 15: 'Pays at the end of each month' };

async function seedAdmins() {
  for (const a of env.admins) {
    const existing = await Admin.findOne({ username: a.username });
    if (existing) {
      existing.name = a.name;
      await existing.save();
      console.log(`  • admin "${a.username}" already exists (password unchanged)`);
    } else {
      await Admin.create({ username: a.username, name: a.name, passwordHash: await bcrypt.hash(a.password, 10) });
      console.log(`  • created admin "${a.username}" / password: ${a.password}`);
    }
  }
}

async function seedDemo(admins) {
  // ---- publications ----
  const pubs = {};
  for (const [name, type, language, frequency, rates] of PUBLICATIONS) {
    pubs[name] = await Publication.create({
      name, type, language, frequency,
      rates: rates.map(([rate, when]) => ({
        ratePerCopy: rate,
        effectiveFrom: parseDate(typeof when === 'string' ? when : ymd(when.m, when.d)),
        setBy: admins[0].name,
      })),
    });
  }
  console.log(`  • ${PUBLICATIONS.length} publications`);

  // ---- customers + subscriptions ----
  const customers = [];
  const subsOf = new Map();
  for (const [i, [name, address, phone, plan]] of CUSTOMERS.entries()) {
    const c = await Customer.create({ name, address, phone, notes: NOTES[i] || '' });
    customers.push(c);
    subsOf.set(String(c._id), []);
    for (const [pubName, kind, opts = {}] of plan) {
      const isFixed = Array.isArray(kind) && kind[0] === 'fixed';
      const weekdays = isFixed ? [] : Array.isArray(kind) ? [kind[1]] : WEEKDAY_PRESETS[kind];
      const sub = await Subscription.create({
        customer: c._id,
        publication: pubs[pubName]._id,
        startDate: parseDate(resolveDate(opts.start, '2025-04-01')),
        endDate: opts.end ? parseDate(resolveDate(opts.end)) : null,
        mode: isFixed ? 'fixedPerMonth' : 'weekdays',
        weekdays,
        copiesPerMonth: isFixed ? kind[1] : 0,
      });
      subsOf.get(String(c._id)).push({ sub, pubName });
    }
  }
  console.log(`  • ${customers.length} customers with subscriptions`);

  // ---- delivery adjustments (the "purchasing history") ----
  const adj = [];
  const dailyPub = (c) => {
    const s = subsOf.get(String(c._id)).find((x) => x.sub.mode === 'weekdays');
    return s ? s.sub.publication : null;
  };
  const push = (c, publication, date, type, note, quantity = 1) =>
    adj.push({ customer: c._id, publication, date: parseDate(date), type, quantity, note });

  // Two holiday holds: one for everything (newspapers), one for a single paper
  for (let d = 10; d <= 14; d++) push(customers[0], null, ymd(4, d), 'skipped', 'Family trip — hold all papers');
  for (let d = 3; d <= 8; d++) push(customers[7], dailyPub(customers[7]), ymd(3, d), 'skipped', 'Out of station');
  for (let n = 0; n < 12; n++) {
    const c = pick(customers);
    const pub = dailyPub(c);
    if (pub) push(c, pub, ymd(between(0, 5), between(1, 28)), 'skipped', pick(['Not at home', 'Festival holiday', 'Paper not needed']));
  }
  for (let n = 0; n < 5; n++) {
    const c = pick(customers);
    const pub = dailyPub(c);
    if (pub) push(c, pub, ymd(between(1, 5), between(1, 28)), 'extra', pick(['Guest staying', 'Special edition', 'Extra copy for office']));
  }
  await DeliveryAdjustment.insertMany(adj);
  console.log(`  • ${adj.length} skipped/extra adjustments`);

  // ---- bills and payments, oldest month first ----
  // Three customers are reserved to deliberately demonstrate 1, 2 and 3 months of due-months
  // on the very first run: their most recent N months are forced unpaid, every earlier month
  // for them is forced fully paid, so the due-months ledger shows exactly N months pending.
  const FORCE_DUE_MONTHS = { [String(customers[0]._id)]: 1, [String(customers[1]._id)]: 2, [String(customers[2]._id)]: 3 };

  let billCount = 0;
  let payCount = 0;
  for (let mi = 0; mi < months.length; mi++) {
    const { year, month } = months[mi];
    const admin = admins[mi % 2];
    const [fullP, partialP] = mi < 3 ? [0.8, 0.95] : mi < months.length - 1 ? [0.55, 0.8] : [0.4, 0.7];

    for (const c of customers) {
      if (!subsOf.get(String(c._id)).length) continue;
      const bill = await generateBill(c._id, year, month, { id: admin._id, name: admin.name });
      if (bill.totalPayable === 0) continue;
      billCount++;

      // Payment date: during the following month (never in the future)
      const nextMonthPrefix = mi + 1 < months.length ? ymd(mi + 1, 1).slice(0, 8) : todayKey.slice(0, 8);
      const maxDay = mi + 1 < months.length ? 22 : Number(todayKey.slice(8, 10));
      const payDate = () => `${nextMonthPrefix}${pad2(Math.max(1, Math.min(maxDay, between(2, 22))))}`;
      const payer = { id: admins[(mi + 1) % 2]._id, name: admins[(mi + 1) % 2].name };
      const mode = () => pick(['cash', 'cash', 'upi']);

      // Target this month's own bill explicitly, so the seed controls exactly which months
      // stay pending (and therefore how many due-months each customer ends up showing).
      const forceDue = FORCE_DUE_MONTHS[String(c._id)];
      const monthsFromEnd = months.length - mi;
      let roll = rnd();
      if (forceDue) roll = monthsFromEnd <= forceDue ? 1 : 0; // 1 = force unpaid, 0 = force fully paid

      if (roll < fullP) {
        if (bill.balance > 3000 && rnd() < 0.15 && !forceDue) {
          const first = Math.round((bill.balance * 0.5) / 100) * 100;
          await recordPayment({ customer: c._id, targetBillId: bill._id, amount: first, date: parseDate(payDate()), mode: 'cash', note: 'Part payment', admin: payer });
          await recordPayment({ customer: c._id, targetBillId: bill._id, amount: bill.balance - first, date: parseDate(payDate()), mode: 'upi', note: 'Balance paid', admin: payer });
          payCount += 2;
        } else {
          await recordPayment({ customer: c._id, targetBillId: bill._id, amount: bill.balance, date: parseDate(payDate()), mode: mode(), note: '', admin: payer });
          payCount++;
        }
      } else if (roll < partialP) {
        const part = Math.round((bill.balance * (0.4 + rnd() * 0.3)) / 1000) * 1000;
        if (part >= 1000 && part < bill.balance) {
          await recordPayment({ customer: c._id, targetBillId: bill._id, amount: part, date: parseDate(payDate()), mode: mode(), note: 'Partial payment', admin: payer });
          payCount++;
        }
      }
    }
    await AuditLog.create({
      admin: admin._id, adminName: admin.name, action: 'bill.generated', entity: 'Bill', entityId: '',
      summary: `Bulk-generated ${monthLabel(year, month)} bills`,
      createdAt: parseDate(`${ymd(mi, 28)}`),
    });
  }
  console.log(`  • ${billCount} bills over ${months.length} months, ${payCount} payments`);

  // ---- a little activity history so the Activity page is not empty ----
  const ago = (days, hour) => new Date(Date.now() - days * 86400000 - (24 - hour) * 3600000 / 4);
  const UA = {
    chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    mobile: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0',
  };
  const logins = [
    [admins[0], true, '192.168.1.24', UA.chrome, 6], [admins[1], true, '192.168.1.31', UA.edge, 5],
    [admins[0], true, '192.168.1.24', UA.chrome, 4], [null, false, '103.77.12.9', UA.mobile, 3, 'admin'],
    [admins[1], true, '192.168.1.31', UA.edge, 2], [admins[0], true, '192.168.1.40', UA.mobile, 1],
  ];
  for (const [a, success, ip, ua, days, uname] of logins) {
    await LoginLog.create({
      admin: a?._id || null, username: a?.username || uname, adminName: a?.name || '',
      success, ip, userAgent: ua, createdAt: ago(days, 10),
    });
  }
  for (const [pub, , , , rates] of PUBLICATIONS) {
    if (rates.length > 1) {
      const [rate, when] = rates[rates.length - 1];
      const prev = rates[rates.length - 2][0];
      await AuditLog.create({
        admin: admins[0]._id, adminName: admins[0].name, action: 'rate.changed', entity: 'Publication',
        entityId: String(pubs[pub]._id),
        summary: `${pub}: ${formatPaise(prev)} → ${formatPaise(rate)} per copy, effective ${ymd(when.m, when.d)}`,
        createdAt: ago(20 + (when.m || 0), 11),
      });
    }
  }

  // ---- Delivery routes: assign a few customers to an employee + named route (Part C) ----
  const employees = await seedExpenses(admins);
  const routeAssignments = [
    [customers[0], employees[0], 'Pattom Route'], [customers[1], employees[0], 'Pattom Route'],
    [customers[5], employees[1], 'Kottayam Town'], [customers[6], employees[1], 'Kottayam Town'],
    [customers[9], employees[2], 'Kozhikode Beach Road'], [customers[15], employees[3], 'Kochi Central'],
  ];
  for (const [c, e, routeName] of routeAssignments) {
    c.employee = e._id;
    c.routeName = routeName;
    await c.save();
  }
  console.log(`  • ${routeAssignments.length} customers assigned to delivery routes`);
}

// ================= Expense module seed data =================

const EMPLOYEES = [
  ['Rajeev Pillai', '9961012345', 'supervisor', 20000_00],
  ['സുരേഷ് ബാബു', '9847123450', 'delivery', 14000_00],
  ['Noufal Rahman', '9744234501', 'delivery', 13000_00],
  ['ബിജു തോമസ്', '9895345612', 'delivery', 15000_00],
];

// 4 vehicles per employee, a realistic mix of makes/types.
const VEHICLE_TEMPLATES = [
  ['bike', 'Hero Splendor', 'petrol'],
  ['scooter', 'Honda Activa', 'petrol'],
  ['scooter', 'TVS XL100', 'petrol'],
  ['ev-scooter', 'Ather 450X', 'electric'],
];
const EXTRA_VEHICLES = [
  ['bike', 'Bajaj Platina', 'petrol'],
  ['auto', 'Piaggio Ape', 'petrol'],
  ['mini-van', 'Tata Ace', 'diesel'],
  ['scooter', 'TVS Jupiter', 'petrol'],
];

const REPAIR_CATEGORIES = ['service', 'tyre', 'brake', 'engine', 'battery', 'electrical', 'other'];
const WORKSHOPS = ['Highway Motors', 'Sree Auto Works', 'City Service Point', 'Balan\'s Garage'];
const OTHER_CATEGORIES = ['rent', 'electricity', 'phone-internet', 'stationery-packing', 'miscellaneous'];
const OTHER_DESCRIPTIONS = {
  rent: 'Monthly office/godown rent', electricity: 'Electricity bill', 'phone-internet': 'Broadband + mobile recharge',
  'stationery-packing': 'Packing covers and stationery', miscellaneous: 'Miscellaneous office expense',
};

/** IST datetime string "YYYY-MM-DDTHH:mm" for a seed month index + day + hour. */
const istAt = (mi, day, hour = 8, minute = 0) => `${ymd(mi, day)}T${pad2(hour)}:${pad2(minute)}`;

async function seedExpenses(admins) {
  // ---- employees ----
  const employees = [];
  for (const [name, phone, role, salary] of EMPLOYEES) {
    employees.push(await Employee.create({ name, phone, role, joinDate: parseDate('2024-06-01'), monthlySalary: salary, salaryDueDay: 1, createdBy: admins[0]._id }));
  }

  // ---- vehicles: 4 per employee ----
  const vehicles = [];
  let regCounter = 1;
  for (const [ei, emp] of employees.entries()) {
    const templates = ei === 0 ? [...VEHICLE_TEMPLATES.slice(0, 3), EXTRA_VEHICLES[2]] : VEHICLE_TEMPLATES;
    for (const [type, makeModel, fuelType] of templates) {
      const reg = `KL-${pad2(between(7, 55))}-${pick(['A', 'B', 'C'])}${pick(['A', 'B', 'C', 'D'])}-${String(1000 + regCounter * 37).slice(-4)}`;
      regCounter++;
      // Deliberately: one vehicle's insurance already expired, one's PUC expiring within 30 days.
      const docOffsetInsurance = regCounter === 2 ? -10 : between(40, 400);
      const docOffsetPuc = regCounter === 4 ? 18 : between(20, 300);
      const today = new Date();
      const addDays = (n) => new Date(today.getTime() + n * 86400000);
      vehicles.push(
        await Vehicle.create({
          registrationNumber: reg,
          type,
          makeModel,
          fuelType,
          assignedEmployee: emp._id,
          odometer: between(3000, 18000),
          insuranceExpiry: addDays(docOffsetInsurance),
          pollutionExpiry: addDays(docOffsetPuc),
          fitnessExpiry: fuelType === 'electric' ? null : addDays(between(100, 600)),
          nextServiceDueKm: between(8000, 20000),
          createdBy: admins[0]._id,
        })
      );
    }
  }
  console.log(`  • ${employees.length} employees, ${vehicles.length} vehicles`);

  // ---- fuel entries: 3-6 per vehicle per month, odometer increasing, occasional partial fill ----
  let fuelCount = 0;
  for (const v of vehicles) {
    let odo = Math.max(1000, v.odometer - 4000);
    for (let mi = 0; mi < months.length; mi++) {
      const fillsThisMonth = v.fuelType === 'electric' ? between(2, 4) : between(3, 6);
      // The 4th vehicle created (regCounter tracking not kept per-vehicle; use array index 3) gets a mileage drop in the last month.
      const isDropVehicle = vehicles.indexOf(v) === 3;
      for (let f = 0; f < fillsThisMonth; f++) {
        const day = Math.min(28, Math.floor((f + 1) * (28 / fillsThisMonth)));
        const baseLitres = v.type === 'mini-van' ? between(6, 9) : between(2, 4);
        const litres = v.fuelType === 'electric' ? between(3, 5) : baseLitres;
        const normalKmPerLitre = v.type === 'mini-van' ? 18 : v.fuelType === 'electric' ? 35 : 45;
        const kmPerLitre = isDropVehicle && mi === months.length - 1 ? normalKmPerLitre * 0.6 : normalKmPerLitre;
        const km = Math.round(litres * kmPerLitre);
        odo += km;
        const pricePerLitre = v.fuelType === 'diesel' ? 9200 : v.fuelType === 'electric' ? 1000 : 10500;
        const amount = Math.round(litres * pricePerLitre);
        const fullTank = f === fillsThisMonth - 1 || rnd() < 0.7;
        // eslint-disable-next-line no-await-in-loop
        await FuelEntry.create({
          vehicle: v._id, employee: v.assignedEmployee, fuelledAt: parseIST(istAt(mi, day, between(7, 19))),
          litres, pricePerLitre, amount, odometer: odo, station: pick(['Highway Fuels', 'BPCL Bunk', 'IOC Station', 'Green Charge Point']),
          fullTank, paymentMode: pick(['cash', 'cash', 'upi']), createdBy: admins[mi % 2]._id,
        });
        fuelCount++;
      }
    }
    v.odometer = odo;
    // eslint-disable-next-line no-await-in-loop
    await v.save();
  }
  console.log(`  • ${fuelCount} fuel entries`);

  // ---- repairs: ~25 across vehicles, a few pending ----
  let repairCount = 0;
  const totalRepairs = 25;
  for (let n = 0; n < totalRepairs; n++) {
    const v = pick(vehicles);
    const mi = between(0, months.length - 1);
    const category = pick(REPAIR_CATEGORIES);
    const partsCost = between(200, 3000) * 100;
    const labourCost = between(100, 800) * 100;
    const pending = n % 7 === 0; // a few left pending
    await RepairEntry.create({
      vehicle: v._id, repairedAt: parseIST(istAt(mi, between(1, 27), between(9, 18))), category,
      description: `${category.charAt(0).toUpperCase() + category.slice(1)} work on ${v.makeModel}`,
      workshop: pick(WORKSHOPS), partsCost, labourCost, total: partsCost + labourCost,
      odometer: v.odometer - between(0, 2000), status: pending ? 'pending' : 'completed',
      paymentMode: pick(['cash', 'cash', 'upi']), createdBy: admins[n % 2]._id,
    });
    repairCount++;
  }
  console.log(`  • ${repairCount} repair entries`);

  // ---- salary advances (2) ----
  const advance1 = await SalaryAdvance.create({ employee: employees[1]._id, amount: 300000, givenOn: parseDate(ymd(1, 10)), reason: 'Medical emergency', createdBy: admins[0]._id });
  const advance2 = await SalaryAdvance.create({ employee: employees[2]._id, amount: 200000, givenOn: parseDate(ymd(2, 15)), reason: 'Festival advance', createdBy: admins[1]._id });
  console.log('  • 2 salary advances');

  // ---- salaries: paid for all employees in prior months (a few late), current month mostly pending ----
  let salaryCount = 0;
  for (let mi = 0; mi < months.length - 1; mi++) {
    for (const [ei, emp] of employees.entries()) {
      const late = rnd() < 0.2;
      const payDay = late ? between(6, 12) : between(1, 4);
      let advanceRecovered = 0;
      if (ei === 1 && mi >= 1) advanceRecovered = Math.min(50000, advance1.amount - advance1.recoveredAmount);
      if (ei === 2 && mi >= 2) advanceRecovered = Math.min(40000, advance2.amount - advance2.recoveredAmount);
      const netPaid = netSalary({ baseSalary: emp.monthlySalary, advanceRecovered });
      // eslint-disable-next-line no-await-in-loop
      await SalaryPayment.create({
        employee: emp._id, forYear: months[mi].year, forMonth: months[mi].month, baseSalary: emp.monthlySalary,
        advanceRecovered, netPaid, paidOn: parseIST(istAt(mi, payDay, 11)), mode: pick(['cash', 'cash', 'bank']),
        recordedBy: admins[mi % 2]._id, recordedByName: admins[mi % 2].name,
      });
      if (advanceRecovered > 0) {
        const advance = ei === 1 ? advance1 : advance2;
        advance.recoveredAmount += advanceRecovered;
        // eslint-disable-next-line no-await-in-loop
        await advance.save();
      }
      salaryCount++;
    }
  }
  // Current (most recent) seeded month: pay employees[0] and employees[3] on time, leave 1 & 2 pending.
  const lastMi = months.length - 1;
  for (const ei of [0, 3]) {
    const emp = employees[ei];
    const netPaid = netSalary({ baseSalary: emp.monthlySalary });
    await SalaryPayment.create({
      employee: emp._id, forYear: months[lastMi].year, forMonth: months[lastMi].month, baseSalary: emp.monthlySalary,
      netPaid, paidOn: parseIST(istAt(lastMi, 2, 10)), mode: 'cash', recordedBy: admins[0]._id, recordedByName: admins[0].name,
    });
    salaryCount++;
  }
  console.log(`  • ${salaryCount} salary payments (employees[1] and [2] left pending for the latest month)`);

  // ---- other expenses: ~30 across 6 months ----
  let otherCount = 0;
  for (let mi = 0; mi < months.length; mi++) {
    await OtherExpense.create({ category: 'rent', amount: 800000, date: parseDate(ymd(mi, 1)), description: OTHER_DESCRIPTIONS.rent, paymentMode: 'other', createdBy: admins[0]._id });
    await OtherExpense.create({ category: 'electricity', amount: between(80, 180) * 100, date: parseDate(ymd(mi, 5)), description: OTHER_DESCRIPTIONS.electricity, paymentMode: 'upi', createdBy: admins[mi % 2]._id });
    otherCount += 2;
    for (let n = 0; n < 3; n++) {
      const category = pick(OTHER_CATEGORIES.slice(2));
      await OtherExpense.create({ category, amount: between(100, 1500) * 100, date: parseDate(ymd(mi, between(2, 27))), description: OTHER_DESCRIPTIONS[category], paymentMode: pick(['cash', 'upi']), createdBy: admins[mi % 2]._id });
      otherCount++;
    }
  }
  console.log(`  • ${otherCount} other expense entries`);

  return employees;
}

async function main() {
  await connectDB();
  console.log(`Connected to ${env.mongoUri}`);

  if (RESET) {
    console.log('--reset: clearing all collections');
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  }
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));

  console.log('Admins:');
  await seedAdmins();
  const admins = await Admin.find({ username: { $in: env.admins.map((a) => a.username) } }).sort({ username: 1 });

  const hasDemo = (await Customer.countDocuments()) > 0 || (await Publication.countDocuments()) > 0;
  if (hasDemo) {
    console.log('Demo data already present — skipping (run `npm run seed -- --reset` for a fresh start).');
  } else {
    console.log('Demo data:');
    await seedDemo(admins);
    console.log('Done.');
  }
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
