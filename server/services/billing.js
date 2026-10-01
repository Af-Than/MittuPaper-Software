/**
 * Billing engine - PURE functions only (no database, no clock, no I/O).
 *
 * Conventions
 *  - Money is an integer number of paise.
 *  - Dates are "YYYY-MM-DD" strings (or Date objects, normalised through toKey) and are
 *    handled in UTC so a server timezone can never shift a delivery to another day.
 *  - Weekdays: 0 = Sunday ... 6 = Saturday.
 */

export const pad2 = (n) => String(n).padStart(2, '0');

export const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Number of days in a calendar month (month is 1-12). Handles leap years. */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export const dateKey = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

/** Normalise a Date | ISO string | null into a YYYY-MM-DD key (or null). */
export function toKey(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function weekdayOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Rate (paise) effective on a given date: the entry with the latest effectiveFrom <= date.
 * If the date is before the first entry, the earliest rate is used.
 */
export function rateOn(rates, key) {
  if (!rates || rates.length === 0) return 0;
  const sorted = rates
    .map((r, i) => ({ rate: r.ratePerCopy, k: toKey(r.effectiveFrom), i }))
    .sort((a, b) => (a.k === b.k ? a.i - b.i : a.k < b.k ? -1 : 1));
  let applicable = sorted[0];
  for (const r of sorted) {
    if (r.k <= key) applicable = r;
    else break;
  }
  return applicable.rate;
}

/** Derive balance and status from the money fields of a bill. */
export function settleBill({ currentCharges, previousDue, amountPaid }) {
  const totalPayable = currentCharges + previousDue;
  const balance = Math.max(0, totalPayable - amountPaid);
  const status = balance === 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';
  return { totalPayable, balance, status };
}

/**
 * Record a payment against a bill's money fields. Throws when invalid.
 * Returns the updated { amountPaid, totalPayable, balance, status }.
 */
export function applyPayment(bill, amount) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Payment must be a positive amount');
  const { balance } = settleBill(bill);
  if (amount > balance) throw new Error('Payment exceeds the outstanding balance');
  const amountPaid = bill.amountPaid + amount;
  return { amountPaid, ...settleBill({ ...bill, amountPaid }) };
}

/**
 * Recompute a customer's chain of bills (ordered oldest -> newest) so each bill's previousDue
 * equals the balance of the bill before it. `openingDue` is the balance carried into the first.
 * Returns new bill objects with previousDue/totalPayable/balance/status refreshed.
 */
export function chainBills(bills, openingDue = 0) {
  let carry = openingDue;
  return bills.map((b) => {
    const next = { ...b, previousDue: carry };
    Object.assign(next, settleBill(next));
    carry = next.balance;
    return next;
  });
}

/**
 * Compute a customer's bill for one month.
 *
 * @param {object}   p
 * @param {number}   p.year
 * @param {number}   p.month  1-12
 * @param {object[]} p.subscriptions  [{ publicationId, publicationName, mode, weekdays,
 *                                      copiesPerMonth, quantity, startDate, endDate, rateHistory }]
 * @param {object[]} p.adjustments    [{ publication (id|null), date, type, quantity }]
 * @param {number}   p.previousDue    balance carried from the previous bill (paise)
 *
 * fixedPerMonth subscriptions are delivered/billed once, on the first active day of the month.
 * Skipped copies in that month reduce the fixed count; extras are added on their own date.
 */
export function computeMonthlyBill({ year, month, subscriptions, adjustments = [], previousDue = 0 }) {
  const total = daysInMonth(year, month);
  const monthStart = dateKey(year, month, 1);
  const monthEnd = dateKey(year, month, total);

  // Index the month's adjustments by date.
  const adjByDate = new Map();
  for (const a of adjustments) {
    const k = toKey(a.date);
    if (k < monthStart || k > monthEnd) continue;
    if (!adjByDate.has(k)) adjByDate.set(k, []);
    adjByDate.get(k).push({ ...a, publication: a.publication ? String(a.publication) : null });
  }

  // Prepare each subscription that overlaps this month.
  const subs = [];
  for (const s of subscriptions) {
    const startKey = toKey(s.startDate);
    const endKey = toKey(s.endDate);
    if (startKey > monthEnd || (endKey && endKey < monthStart)) continue;
    const pid = String(s.publicationId);
    const prepared = {
      ...s,
      pid,
      startKey,
      endKey,
      quantity: s.quantity || 1,
      weekdays: s.weekdays || [],
    };
    if (s.mode === 'fixedPerMonth') {
      prepared.fixedDay = startKey > monthStart ? startKey : monthStart;
      // Skips anywhere in the active part of the month reduce the fixed monthly count.
      // Only skips that name this publication count: an "all publications" holiday hold
      // pauses daily/weekly deliveries but does not cancel a monthly magazine.
      let skippedTotal = 0;
      for (const [k, list] of adjByDate) {
        if (k < startKey || (endKey && k > endKey)) continue;
        for (const a of list) {
          if (a.type === 'skipped' && a.publication === pid) skippedTotal += a.quantity || 1;
        }
      }
      prepared.fixedSkipped = Math.min(s.copiesPerMonth || 0, skippedTotal);
    }
    subs.push(prepared);
  }

  const lineMap = new Map();
  for (const s of subs) {
    if (!lineMap.has(s.pid)) {
      lineMap.set(s.pid, {
        publicationId: s.pid,
        publicationName: s.publicationName,
        copies: 0,
        skippedCopies: 0,
        extraCopies: 0,
        ratePerCopy: rateOn(s.rateHistory, s.startKey > monthStart ? s.startKey : monthStart),
        amount: 0,
        segments: [],
      });
    }
  }

  const days = [];
  let running = 0;

  for (let d = 1; d <= total; d++) {
    const key = dateKey(year, month, d);
    const dayAdjs = adjByDate.get(key) || [];
    const items = [];
    let dayCopies = 0;
    let dayAmount = 0;

    for (const s of subs) {
      if (key < s.startKey || (s.endKey && key > s.endKey)) continue; // not subscribed that day

      const mine = dayAdjs.filter((a) => !a.publication || a.publication === s.pid);
      const skippedReq = mine.filter((a) => a.type === 'skipped').reduce((n, a) => n + (a.quantity || 1), 0);
      const extra = mine.filter((a) => a.type === 'extra').reduce((n, a) => n + (a.quantity || 1), 0);

      let base = 0;
      let skipped = 0;
      if (s.mode === 'fixedPerMonth') {
        if (key === s.fixedDay) {
          base = (s.copiesPerMonth || 0) - s.fixedSkipped;
          skipped = s.fixedSkipped;
        }
      } else {
        if (s.weekdays.includes(weekdayOf(key))) base = s.quantity;
        skipped = Math.min(base, skippedReq);
        base -= skipped;
      }

      const copies = base + extra;
      const line = lineMap.get(s.pid);
      line.skippedCopies += skipped;
      line.extraCopies += extra;
      if (copies <= 0) continue;

      const rate = rateOn(s.rateHistory, key);
      const amount = copies * rate;
      items.push({
        publicationId: s.pid,
        publicationName: s.publicationName,
        copies,
        ratePerCopy: rate,
        amount,
      });
      dayCopies += copies;
      dayAmount += amount;

      line.copies += copies;
      line.amount += amount;
      line.ratePerCopy = rate;
      const seg = line.segments.find((x) => x.ratePerCopy === rate);
      if (seg) {
        seg.copies += copies;
        seg.amount += amount;
      } else {
        line.segments.push({ ratePerCopy: rate, copies, amount });
      }
    }

    running += dayAmount;
    days.push({
      date: key,
      weekday: weekdayOf(key),
      items,
      copies: dayCopies,
      amount: dayAmount,
      runningTotal: running,
    });
  }

  const lineItems = [...lineMap.values()];
  const currentCharges = lineItems.reduce((n, l) => n + l.amount, 0);
  const totalPayable = currentCharges + previousDue;

  return { year, month, lineItems, days, currentCharges, previousDue, totalPayable };
}
