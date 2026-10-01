import { describe, it, expect } from 'vitest';
import {
  computeMonthlyBill,
  rateOn,
  settleBill,
  applyPayment,
  chainBills,
  daysInMonth,
  isLeapYear,
} from '../services/billing.js';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const rates = (...entries) => entries.map(([ratePerCopy, effectiveFrom]) => ({ ratePerCopy, effectiveFrom }));

const sub = (over = {}) => ({
  publicationId: 'p1',
  publicationName: 'Mathrubhumi',
  mode: 'weekdays',
  weekdays: ALL_DAYS,
  quantity: 1,
  startDate: '2020-01-01',
  endDate: null,
  rateHistory: rates([1000, '2020-01-01']),
  ...over,
});

const bill = (over = {}) =>
  computeMonthlyBill({ year: 2025, month: 1, subscriptions: [sub()], adjustments: [], previousDue: 0, ...over });

describe('calendar helpers', () => {
  it('knows month lengths and leap years', () => {
    expect(daysInMonth(2025, 1)).toBe(31);
    expect(daysInMonth(2025, 4)).toBe(30);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });
});

describe('rateOn', () => {
  it('picks the rate effective on the date', () => {
    const r = rates([900, '2024-01-01'], [1000, '2025-01-15']);
    expect(rateOn(r, '2024-06-01')).toBe(900);
    expect(rateOn(r, '2025-01-14')).toBe(900);
    expect(rateOn(r, '2025-01-15')).toBe(1000);
  });
  it('falls back to the earliest rate before the first entry', () => {
    expect(rateOn(rates([900, '2024-01-01']), '2020-01-01')).toBe(900);
  });
});

describe('daily vs custom weekdays', () => {
  it('Daily = 7 days a week (31 copies in January)', () => {
    const b = bill();
    expect(b.lineItems[0].copies).toBe(31);
    expect(b.currentCharges).toBe(31 * 1000);
    expect(b.days).toHaveLength(31);
  });

  it('Sunday-only counts only Sundays (Jan 2025 has 4)', () => {
    const b = bill({ subscriptions: [sub({ weekdays: [0] })] });
    expect(b.lineItems[0].copies).toBe(4);
    expect(b.currentCharges).toBe(4000);
  });

  it('Mon-Fri counts weekdays only (Jan 2025 has 23)', () => {
    const b = bill({ subscriptions: [sub({ weekdays: [1, 2, 3, 4, 5] })] });
    expect(b.lineItems[0].copies).toBe(23);
  });

  it('fixedPerMonth bills the fixed copy count once', () => {
    const b = bill({
      subscriptions: [sub({ mode: 'fixedPerMonth', copiesPerMonth: 2, weekdays: [], rateHistory: rates([4000, '2020-01-01']) })],
    });
    expect(b.lineItems[0].copies).toBe(2);
    expect(b.currentCharges).toBe(8000);
  });
});

describe('mid-month rate change', () => {
  it('splits copies across the old and new rate', () => {
    const b = bill({ subscriptions: [sub({ rateHistory: rates([1000, '2020-01-01'], [1200, '2025-01-15']) })] });
    // 14 days at 1000 (1-14) + 17 days at 1200 (15-31)
    expect(b.currentCharges).toBe(14 * 1000 + 17 * 1200);
    expect(b.lineItems[0].segments).toEqual([
      { ratePerCopy: 1000, copies: 14, amount: 14000 },
      { ratePerCopy: 1200, copies: 17, amount: 20400 },
    ]);
    expect(b.lineItems[0].ratePerCopy).toBe(1200);
  });

  it('does not change past months when a later rate is added', () => {
    const r = rates([1000, '2020-01-01'], [1500, '2025-03-01']);
    const jan = bill({ subscriptions: [sub({ rateHistory: r })] });
    expect(jan.currentCharges).toBe(31 * 1000);
  });
});

describe('skipped and extra deliveries', () => {
  it('subtracts skipped days and adds extra copies', () => {
    const adjustments = [
      ...[10, 11, 12, 13, 14].map((d) => ({ publication: 'p1', date: `2025-01-${d}`, type: 'skipped', quantity: 1 })),
      { publication: 'p1', date: '2025-01-20', type: 'extra', quantity: 2 },
    ];
    const b = bill({ adjustments });
    expect(b.lineItems[0].copies).toBe(31 - 5 + 2);
    expect(b.lineItems[0].skippedCopies).toBe(5);
    expect(b.lineItems[0].extraCopies).toBe(2);
    expect(b.currentCharges).toBe(28 * 1000);
    expect(b.days[19].copies).toBe(3); // 20 Jan: 1 regular + 2 extra
  });

  it('an "all publications" skip applies to every subscription', () => {
    const subs = [sub(), sub({ publicationId: 'p2', publicationName: 'The Hindu' })];
    const b = bill({ subscriptions: subs, adjustments: [{ publication: null, date: '2025-01-05', type: 'skipped', quantity: 1 }] });
    expect(b.lineItems.map((l) => l.copies)).toEqual([30, 30]);
  });

  it('skipping a non-delivery weekday changes nothing', () => {
    const b = bill({
      subscriptions: [sub({ weekdays: [0] })],
      adjustments: [{ publication: 'p1', date: '2025-01-06', type: 'skipped', quantity: 1 }], // a Monday
    });
    expect(b.lineItems[0].copies).toBe(4);
  });

  it('an "all publications" hold does not cancel a fixedPerMonth magazine', () => {
    const b = bill({
      subscriptions: [sub({ mode: 'fixedPerMonth', copiesPerMonth: 2, rateHistory: rates([4000, '2020-01-01']) })],
      adjustments: [{ publication: null, date: '2025-01-09', type: 'skipped', quantity: 1 }],
    });
    expect(b.lineItems[0].copies).toBe(2);
  });

  it('skips reduce a fixedPerMonth count', () => {
    const b = bill({
      subscriptions: [sub({ mode: 'fixedPerMonth', copiesPerMonth: 2, rateHistory: rates([4000, '2020-01-01']) })],
      adjustments: [{ publication: 'p1', date: '2025-01-09', type: 'skipped', quantity: 1 }],
    });
    expect(b.lineItems[0].copies).toBe(1);
  });
});

describe('subscription date ranges', () => {
  it('handles mid-month start and end', () => {
    const b = bill({ subscriptions: [sub({ startDate: '2025-01-10', endDate: '2025-01-20' })] });
    expect(b.lineItems[0].copies).toBe(11);
  });

  it('subscriptions with zero deliveries still produce a 0 line item', () => {
    const b = bill({ subscriptions: [sub({ weekdays: [] })] });
    expect(b.lineItems).toHaveLength(1);
    expect(b.lineItems[0].copies).toBe(0);
    expect(b.currentCharges).toBe(0);
  });

  it('ignores subscriptions entirely outside the month', () => {
    const b = bill({ subscriptions: [sub({ startDate: '2025-02-01' }), sub({ publicationId: 'p3', endDate: '2024-12-31' })] });
    expect(b.lineItems).toHaveLength(0);
  });

  it('running total accumulates day by day', () => {
    const b = bill();
    expect(b.days[0].runningTotal).toBe(1000);
    expect(b.days[30].runningTotal).toBe(b.currentCharges);
  });
});

describe('leap year February', () => {
  it('bills 29 daily copies in Feb 2024 and 28 in Feb 2025', () => {
    expect(bill({ year: 2024, month: 2 }).lineItems[0].copies).toBe(29);
    expect(bill({ year: 2025, month: 2 }).lineItems[0].copies).toBe(28);
  });
  it('Feb 29 2024 is a Thursday', () => {
    const b = bill({ year: 2024, month: 2, subscriptions: [sub({ weekdays: [4] })] });
    expect(b.lineItems[0].copies).toBe(5);
  });
});

describe('payments and carry-forward', () => {
  const jan = { currentCharges: 30000, previousDue: 0, amountPaid: 0 };

  it('settleBill derives status', () => {
    expect(settleBill(jan).status).toBe('unpaid');
    expect(settleBill({ ...jan, amountPaid: 10000 })).toMatchObject({ balance: 20000, status: 'partial' });
    expect(settleBill({ ...jan, amountPaid: 30000 })).toMatchObject({ balance: 0, status: 'paid' });
  });

  it('a partial payment carries only the remaining balance forward', () => {
    const paid = { ...jan, ...applyPayment(jan, 10000) };
    const [, feb] = chainBills([paid, { currentCharges: 25000, amountPaid: 0 }]);
    expect(feb.previousDue).toBe(20000);
    expect(feb.totalPayable).toBe(45000);
    expect(feb.status).toBe('unpaid');
  });

  it('a fully paid bill clears and nothing carries forward', () => {
    const paid = { ...jan, ...applyPayment(jan, 30000) };
    expect(paid.status).toBe('paid');
    const [, feb] = chainBills([paid, { currentCharges: 25000, amountPaid: 0 }]);
    expect(feb.previousDue).toBe(0);
    expect(feb.totalPayable).toBe(25000);
  });

  it('dues chain across several months and clearing the latest bill clears everything', () => {
    let chain = chainBills([
      { currentCharges: 30000, amountPaid: 0 },
      { currentCharges: 20000, amountPaid: 0 },
      { currentCharges: 10000, amountPaid: 0 },
    ]);
    expect(chain.map((b) => b.totalPayable)).toEqual([30000, 50000, 60000]);
    chain[2] = { ...chain[2], ...applyPayment(chain[2], 60000) };
    expect(chain[2]).toMatchObject({ balance: 0, status: 'paid' });
  });

  it('regenerating an earlier bill updates every later previousDue', () => {
    const before = chainBills([
      { currentCharges: 30000, amountPaid: 0 },
      { currentCharges: 20000, amountPaid: 0 },
    ]);
    expect(before[1].previousDue).toBe(30000);
    const after = chainBills([
      { currentCharges: 28000, amountPaid: 0 }, // Jan regenerated after a skip was added
      { currentCharges: 20000, amountPaid: 0 },
    ]);
    expect(after[1].previousDue).toBe(28000);
    expect(after[1].totalPayable).toBe(48000);
  });

  it('rejects overpayment and non-positive payments', () => {
    expect(() => applyPayment(jan, 30001)).toThrow();
    expect(() => applyPayment(jan, 0)).toThrow();
    expect(() => applyPayment(jan, 10.5)).toThrow();
  });

  it('previousDue passed to computeMonthlyBill is included in the total', () => {
    const b = bill({ previousDue: 5000 });
    expect(b.totalPayable).toBe(31 * 1000 + 5000);
  });
});
