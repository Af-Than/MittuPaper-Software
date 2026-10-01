import { describe, it, expect } from 'vitest';
import { allPendingWithAge, allocatePayment, allocateToBill, buildDueBreakdown, oldestDueSummary, pendingBills, pendingOf, totalPending } from '../services/dues.js';

const bill = (year, month, currentCharges, amountPaid = 0, billId) => ({ billId: billId || `${year}-${month}`, year, month, currentCharges, amountPaid });

describe('pendingOf', () => {
  it('is the unpaid portion of a single bill, never negative', () => {
    expect(pendingOf(bill(2026, 7, 30000, 10000))).toBe(20000);
    expect(pendingOf(bill(2026, 7, 30000, 30000))).toBe(0);
    expect(pendingOf(bill(2026, 7, 30000, 50000))).toBe(0);
  });
});

describe('buildDueBreakdown — 3-month chain', () => {
  const bills = [bill(2026, 7, 30000, 0), bill(2026, 8, 20000, 0), bill(2026, 9, 10000, 0)];

  it('lists every earlier unpaid month, oldest first, with correct age', () => {
    const d = buildDueBreakdown(bills, 2026, 10);
    expect(d).toHaveLength(3);
    expect(d.map((x) => x.month)).toEqual([7, 8, 9]);
    expect(d.map((x) => x.ageInMonths)).toEqual([3, 2, 1]);
    expect(totalPending(d)).toBe(60000);
  });

  it('excludes the reference month itself and anything not yet due', () => {
    const d = buildDueBreakdown(bills, 2026, 9); // viewing September's own bill
    expect(d.map((x) => x.month)).toEqual([7, 8]);
  });

  it('a gap month with zero charges contributes nothing', () => {
    const withGap = [bill(2026, 7, 30000, 0), bill(2026, 8, 0, 0), bill(2026, 9, 10000, 0)];
    const d = buildDueBreakdown(withGap, 2026, 10);
    expect(d.map((x) => x.month)).toEqual([7, 9]);
  });

  it('a bill with nothing pending (paid) is excluded', () => {
    const paidMiddle = [bill(2026, 7, 30000, 0), bill(2026, 8, 20000, 20000), bill(2026, 9, 10000, 0)];
    const d = buildDueBreakdown(paidMiddle, 2026, 10);
    expect(d.map((x) => x.month)).toEqual([7, 9]);
  });

  it('empty when nothing is pending', () => {
    expect(buildDueBreakdown([bill(2026, 7, 30000, 30000)], 2026, 8)).toEqual([]);
  });
});

describe('allocatePayment — oldest first', () => {
  it('clears only the oldest month when the payment covers just that', () => {
    const pending = pendingBills([bill(2026, 7, 30000, 0), bill(2026, 8, 20000, 0), bill(2026, 9, 10000, 0)]);
    const alloc = allocatePayment(pending, 30000);
    expect(alloc).toEqual([{ billId: '2026-7', amount: 30000 }]);
  });

  it('a partial payment leaves the remainder on the oldest month, touching only it', () => {
    const pending = pendingBills([bill(2026, 7, 30000, 0), bill(2026, 8, 20000, 0)]);
    const alloc = allocatePayment(pending, 10000);
    expect(alloc).toEqual([{ billId: '2026-7', amount: 10000 }]);
  });

  it('spills into later months once the oldest is fully covered', () => {
    const pending = pendingBills([bill(2026, 7, 30000, 0), bill(2026, 8, 20000, 0), bill(2026, 9, 10000, 0)]);
    const alloc = allocatePayment(pending, 45000);
    expect(alloc).toEqual([
      { billId: '2026-7', amount: 30000 },
      { billId: '2026-8', amount: 15000 },
    ]);
  });

  it('clears everything exactly when the payment equals total pending', () => {
    const pending = pendingBills([bill(2026, 7, 30000, 0), bill(2026, 8, 20000, 0), bill(2026, 9, 10000, 0)]);
    const alloc = allocatePayment(pending, 60000);
    expect(alloc.reduce((n, a) => n + a.amount, 0)).toBe(60000);
    expect(alloc).toHaveLength(3);
  });

  it('rejects a payment larger than the total outstanding balance', () => {
    const pending = pendingBills([bill(2026, 7, 30000, 0)]);
    expect(() => allocatePayment(pending, 30001)).toThrow();
  });

  it('rejects zero, negative or non-integer amounts', () => {
    const pending = pendingBills([bill(2026, 7, 30000, 0)]);
    expect(() => allocatePayment(pending, 0)).toThrow();
    expect(() => allocatePayment(pending, -5)).toThrow();
    expect(() => allocatePayment(pending, 10.5)).toThrow();
  });

  it('skips bills already paid off when building the pending list', () => {
    const pending = pendingBills([bill(2026, 7, 30000, 30000), bill(2026, 8, 20000, 0)]);
    expect(pending).toEqual([{ billId: '2026-8', year: 2026, month: 8, pending: 20000 }]);
  });
});

describe('allocateToBill — manual month selection', () => {
  const pending = pendingBills([bill(2026, 7, 30000, 0), bill(2026, 8, 20000, 0)]);

  it('allocates fully to the chosen month, leaving others untouched', () => {
    expect(allocateToBill(pending, '2026-8', 20000)).toEqual([{ billId: '2026-8', amount: 20000 }]);
  });

  it('allows a partial payment on the chosen month', () => {
    expect(allocateToBill(pending, '2026-8', 5000)).toEqual([{ billId: '2026-8', amount: 5000 }]);
  });

  it('rejects an amount larger than that month\'s pending balance', () => {
    expect(() => allocateToBill(pending, '2026-8', 20001)).toThrow();
  });

  it('rejects a bill id with nothing pending', () => {
    expect(() => allocateToBill(pending, 'not-a-bill', 100)).toThrow();
  });
});

describe('oldestDueSummary', () => {
  it('summarises the oldest month and the count of pending months', () => {
    const d = buildDueBreakdown([bill(2026, 7, 30000, 0), bill(2026, 8, 20000, 0), bill(2026, 9, 10000, 0)], 2026, 10);
    expect(oldestDueSummary(d)).toEqual({ year: 2026, month: 7, months: 3, ageInMonths: 3 });
  });
  it('is null when nothing is due', () => {
    expect(oldestDueSummary([])).toBeNull();
  });
});

describe('allPendingWithAge — customer-wide "as of today" view', () => {
  it('includes the latest unpaid month (age 0) alongside older ones', () => {
    const bills = [bill(2026, 7, 30000, 0), bill(2026, 8, 20000, 0), bill(2026, 9, 10000, 0)];
    const d = allPendingWithAge(bills, 2026, 9);
    expect(d.map((x) => x.ageInMonths)).toEqual([2, 1, 0]);
    expect(d).toHaveLength(3);
  });
  it('clamps age at 0 when today is earlier than the bill (never negative)', () => {
    const d = allPendingWithAge([bill(2026, 9, 10000, 0)], 2026, 7);
    expect(d[0].ageInMonths).toBe(0);
  });
});
