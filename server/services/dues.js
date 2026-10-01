/**
 * Due-months ledger — PURE functions (no I/O), used on top of billing.js.
 *
 * Model: each bill tracks only ITS OWN month's charges and payments
 * (bill.pending = currentCharges - amountPaid). "Previous dues" shown anywhere are
 * DERIVED by scanning a customer's earlier bills for pending > 0 — never a single
 * stored rolled-up number — so the figures stay correct no matter which month a
 * late payment is allocated to.
 */

const key = (year, month) => year * 12 + month;

/** Pending amount for one bill (paise), never negative. */
export const pendingOf = (bill) => Math.max(0, (bill.currentCharges || 0) - (bill.amountPaid || 0));

/**
 * Every bill with pending > 0, strictly before (referenceYear, referenceMonth), oldest first,
 * annotated with how many months old each one is relative to the reference month.
 *
 * @param {object[]} bills  [{ billId, year, month, currentCharges, amountPaid }]
 */
export function buildDueBreakdown(bills, referenceYear, referenceMonth) {
  const ref = key(referenceYear, referenceMonth);
  return bills
    .map((b) => ({ billId: b.billId, year: b.year, month: b.month, billed: b.currentCharges, paid: b.amountPaid, pending: pendingOf(b) }))
    .filter((b) => b.pending > 0 && key(b.year, b.month) < ref)
    .sort((a, b) => key(a.year, a.month) - key(b.year, b.month))
    .map((b) => ({ ...b, ageInMonths: ref - key(b.year, b.month) }));
}

export const totalPending = (breakdown) => breakdown.reduce((n, b) => n + b.pending, 0);

/** Every bill (any month, including the current one) with pending > 0, oldest first. */
export function pendingBills(bills) {
  return bills
    .map((b) => ({ billId: b.billId, year: b.year, month: b.month, pending: pendingOf(b) }))
    .filter((b) => b.pending > 0)
    .sort((a, b) => key(a.year, a.month) - key(b.year, b.month));
}

/**
 * Allocate a payment across pending bills, oldest first, until the amount is used up.
 * Throws if the amount is not a positive integer or exceeds the total pending.
 */
export function allocatePayment(pending, amount) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Payment must be a positive amount');
  let remaining = amount;
  const allocations = [];
  for (const b of pending) {
    if (remaining <= 0) break;
    const take = Math.min(b.pending, remaining);
    if (take > 0) {
      allocations.push({ billId: b.billId, amount: take });
      remaining -= take;
    }
  }
  if (remaining > 0) throw new Error('Payment exceeds the total outstanding balance');
  return allocations;
}

/** Allocate a payment to one specific month only, capped at that month's pending amount. */
export function allocateToBill(pending, billId, amount) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Payment must be a positive amount');
  const target = pending.find((b) => String(b.billId) === String(billId));
  if (!target) throw new Error('That bill has no pending balance');
  if (amount > target.pending) throw new Error(`The amount cannot exceed the pending balance of ₹${(target.pending / 100).toFixed(2)} for that month`);
  return [{ billId: target.billId, amount }];
}

/**
 * Every pending bill (any month) with its age measured from "today" rather than from another
 * bill's month. Used for customer-wide due badges/cards, which should reflect what's owed as of
 * now regardless of which month was last billed. Age is clamped to 0 (never negative).
 */
export function allPendingWithAge(bills, todayYear, todayMonth) {
  const ref = key(todayYear, todayMonth);
  return pendingBills(bills).map((b) => ({ ...b, ageInMonths: Math.max(0, ref - key(b.year, b.month)) }));
}

/** A short "Pending since <month> (<n> months)" style summary for the oldest pending month. */
export function oldestDueSummary(breakdown) {
  if (!breakdown.length) return null;
  const oldest = breakdown[0];
  return { year: oldest.year, month: oldest.month, months: breakdown.length, ageInMonths: oldest.ageInMonths };
}
