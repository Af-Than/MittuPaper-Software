import { describe, it, expect } from 'vitest';
import {
  averageMileage, costPerKm, daysUntil, hasMileageDrop, isDuplicateSalary, mileageBetweenFullTanks, netSalary, profitAndLoss, salaryStatus,
} from '../services/expenses.js';

const e = (id, fuelledAt, odometer, litres, fullTank = true) => ({ id, fuelledAt, odometer, litres, fullTank });

describe('mileageBetweenFullTanks', () => {
  it('computes km/l between consecutive full tanks', () => {
    const entries = [e('a', '2026-01-01', 1000, 10), e('b', '2026-01-10', 1300, 25)];
    const rows = mileageBetweenFullTanks(entries);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ km: 300, litres: 25, kmPerLitre: 12 });
  });

  it('a partial-tank fill in between is folded into the next full-tank interval', () => {
    const entries = [e('a', '2026-01-01', 1000, 10), e('b', '2026-01-05', 1150, 10, false), e('c', '2026-01-10', 1300, 15)];
    const rows = mileageBetweenFullTanks(entries);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ km: 300, litres: 25, kmPerLitre: 12 });
  });

  it('ignores entries before the first full tank (no anchor yet)', () => {
    const entries = [e('a', '2026-01-01', 1000, 10, false), e('b', '2026-01-05', 1100, 10)];
    expect(mileageBetweenFullTanks(entries)).toEqual([]);
  });

  it('handles out-of-order input by sorting on fuelledAt', () => {
    const entries = [e('b', '2026-01-10', 1300, 25), e('a', '2026-01-01', 1000, 10)];
    const rows = mileageBetweenFullTanks(entries);
    expect(rows[0].km).toBe(300);
  });

  it('produces multiple intervals across several fills', () => {
    const entries = [e('a', '2026-01-01', 1000, 10), e('b', '2026-01-10', 1300, 25), e('c', '2026-01-20', 1600, 24)];
    const rows = mileageBetweenFullTanks(entries);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ km: 300, litres: 24, kmPerLitre: 12.5 });
  });
});

describe('averageMileage', () => {
  it('averages across all intervals (km-weighted)', () => {
    const entries = [e('a', '2026-01-01', 1000, 10), e('b', '2026-01-10', 1300, 25), e('c', '2026-01-20', 1600, 24)];
    // total km 600, total litres 49 -> 12.24...
    expect(averageMileage(entries)).toBeCloseTo(600 / 49, 5);
  });
  it('is null with fewer than one full interval', () => {
    expect(averageMileage([e('a', '2026-01-01', 1000, 10)])).toBeNull();
  });
});

describe('hasMileageDrop', () => {
  it('flags a drop of more than the threshold against the vehicle\'s own prior average', () => {
    // prior average 12.5 km/l over 2 intervals, latest interval drops to 9 km/l (28% drop)
    const entries = [
      e('a', '2026-01-01', 0, 10),
      e('b', '2026-01-10', 150, 12), // 150/12=12.5
      e('c', '2026-01-20', 300, 12), // 150/12=12.5
      e('d', '2026-01-30', 390, 10), // 90/10=9
    ];
    expect(hasMileageDrop(entries, 0.2)).toBe(true);
  });
  it('is false when mileage is stable', () => {
    const entries = [e('a', '2026-01-01', 0, 10), e('b', '2026-01-10', 150, 12), e('c', '2026-01-20', 300, 12)];
    expect(hasMileageDrop(entries, 0.2)).toBe(false);
  });
  it('is false with fewer than two intervals', () => {
    expect(hasMileageDrop([e('a', '2026-01-01', 0, 10), e('b', '2026-01-10', 150, 12)])).toBe(false);
  });
});

describe('costPerKm', () => {
  it('divides total cost by km covered', () => {
    expect(costPerKm({ fuelTotal: 5000, repairTotal: 2000, kmCovered: 350 })).toBeCloseTo(20, 5);
  });
  it('is null when no distance was covered', () => {
    expect(costPerKm({ fuelTotal: 5000, repairTotal: 0, kmCovered: 0 })).toBeNull();
  });
});

describe('salaryStatus', () => {
  it('is on-time when paid on or before the due date', () => {
    expect(salaryStatus({ year: 2026, month: 8, dueDay: 1, paidOn: new Date('2026-08-01') })).toMatchObject({ status: 'paid', daysLate: 0 });
    expect(salaryStatus({ year: 2026, month: 8, dueDay: 5, paidOn: new Date('2026-08-03') }).status).toBe('paid');
  });
  it('is paid-late with the correct day count', () => {
    expect(salaryStatus({ year: 2026, month: 8, dueDay: 1, paidOn: new Date('2026-08-06') })).toMatchObject({ status: 'paid-late', daysLate: 5 });
  });
  it('is pending (and overdue) when unpaid past the due date', () => {
    const r = salaryStatus({ year: 2026, month: 8, dueDay: 1, paidOn: null, today: new Date('2026-08-15') });
    expect(r).toMatchObject({ status: 'pending', overdue: true });
  });
  it('is pending (not yet overdue) before the due date', () => {
    const r = salaryStatus({ year: 2026, month: 9, dueDay: 5, paidOn: null, today: new Date('2026-09-02') });
    expect(r).toMatchObject({ status: 'pending', overdue: false });
  });
});

describe('netSalary', () => {
  it('adds bonus and subtracts deductions and advance recovery', () => {
    expect(netSalary({ baseSalary: 15000_00, bonus: 500_00, deductions: 200_00, advanceRecovered: 1000_00 })).toBe(14300_00);
  });
  it('never goes negative', () => {
    expect(netSalary({ baseSalary: 1000, deductions: 5000 })).toBe(0);
  });
});

describe('profitAndLoss', () => {
  it('computes net profit and margin without publisher cost', () => {
    const r = profitAndLoss({ income: 100000, fuel: 20000, repairs: 10000, salaries: 30000, other: 5000 });
    expect(r.totalExpenses).toBe(65000);
    expect(r.netProfit).toBe(35000);
    expect(r.marginPct).toBeCloseTo(35, 5);
  });
  it('includes publisher cost as an expense line when given', () => {
    const r = profitAndLoss({ income: 100000, fuel: 20000, repairs: 10000, salaries: 30000, other: 5000, publisherCost: 15000 });
    expect(r.totalExpenses).toBe(80000);
    expect(r.netProfit).toBe(20000);
  });
  it('margin is null with zero income (avoids divide-by-zero)', () => {
    expect(profitAndLoss({ income: 0, fuel: 100 }).marginPct).toBeNull();
  });
});

describe('isDuplicateSalary', () => {
  const existing = [{ employee: 'e1', forYear: 2026, forMonth: 8 }];
  it('detects an existing payment for the same employee+month', () => {
    expect(isDuplicateSalary(existing, 'e1', 2026, 8)).toBe(true);
  });
  it('is false for a different month or employee', () => {
    expect(isDuplicateSalary(existing, 'e1', 2026, 9)).toBe(false);
    expect(isDuplicateSalary(existing, 'e2', 2026, 8)).toBe(false);
  });
});

describe('daysUntil', () => {
  it('is positive for a future date and negative once past', () => {
    const today = new Date('2026-09-01T00:00:00Z');
    expect(daysUntil(new Date('2026-09-15T00:00:00Z'), today)).toBe(14);
    expect(daysUntil(new Date('2026-08-20T00:00:00Z'), today)).toBeLessThan(0);
  });
  it('is null when there is no date', () => {
    expect(daysUntil(null)).toBeNull();
  });
});
