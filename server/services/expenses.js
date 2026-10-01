/**
 * Expense module — PURE calculation functions (no I/O). Money is integer paise throughout.
 */

/**
 * Mileage (distance per unit of fuel) between consecutive FULL-TANK fuel entries of one vehicle.
 * Mileage is only meaningful between two full tanks (a partial fill understates distance/litre),
 * so partial-tank entries are used only to advance the running odometer, never as an endpoint.
 *
 * @param {object[]} entries  ascending by fuelledAt: [{ id, fuelledAt, odometer, litres, fullTank }]
 * @returns {object[]} one row per full-tank-to-full-tank interval: { fromId, toId, km, litres, kmPerLitre }
 */
export function mileageBetweenFullTanks(entries) {
  const sorted = [...entries].sort((a, b) => new Date(a.fuelledAt) - new Date(b.fuelledAt));
  const rows = [];
  let anchor = null; // last full-tank entry seen
  let litresSinceAnchor = 0;
  for (const e of sorted) {
    if (anchor === null) {
      if (e.fullTank) anchor = e;
      continue;
    }
    litresSinceAnchor += e.litres;
    if (e.fullTank) {
      const km = e.odometer - anchor.odometer;
      if (km > 0 && litresSinceAnchor > 0) {
        rows.push({ fromId: anchor.id, toId: e.id, from: anchor.fuelledAt, to: e.fuelledAt, km, litres: litresSinceAnchor, kmPerLitre: km / litresSinceAnchor });
      }
      anchor = e;
      litresSinceAnchor = 0;
    }
  }
  return rows;
}

/** Average km/l (or km/kWh) across all full-tank intervals; null when there isn't at least one. */
export function averageMileage(entries) {
  const rows = mileageBetweenFullTanks(entries);
  if (!rows.length) return null;
  const totalKm = rows.reduce((n, r) => n + r.km, 0);
  const totalLitres = rows.reduce((n, r) => n + r.litres, 0);
  return totalLitres > 0 ? totalKm / totalLitres : null;
}

/** True when the most recent mileage interval is more than `dropPct` worse than the vehicle's own average. */
export function hasMileageDrop(entries, dropPct = 0.2) {
  const rows = mileageBetweenFullTanks(entries);
  if (rows.length < 2) return false;
  const latest = rows[rows.length - 1];
  const priorRows = rows.slice(0, -1);
  const priorKm = priorRows.reduce((n, r) => n + r.km, 0);
  const priorLitres = priorRows.reduce((n, r) => n + r.litres, 0);
  if (priorLitres === 0) return false;
  const priorAvg = priorKm / priorLitres;
  if (priorAvg <= 0) return false;
  return (priorAvg - latest.kmPerLitre) / priorAvg > dropPct;
}

/** Total cost (paise) per km for a vehicle over a period: fuel + repairs, divided by km covered. */
export function costPerKm({ fuelTotal, repairTotal, kmCovered }) {
  if (!kmCovered || kmCovered <= 0) return null;
  return (fuelTotal + repairTotal) / kmCovered;
}

/**
 * Salary status for one employee-month, derived from the due day and when (if ever) it was paid.
 * `today`/`paidOn` are Dates; `dueDay` is 1-28.
 */
export function salaryStatus({ year, month, dueDay, paidOn, today = new Date() }) {
  const dueDate = new Date(Date.UTC(year, month - 1, dueDay));
  if (!paidOn) {
    const overdue = today > dueDate;
    return { status: overdue ? 'pending' : 'pending', overdue, daysLate: null };
  }
  const paidDate = new Date(Date.UTC(paidOn.getUTCFullYear(), paidOn.getUTCMonth(), paidOn.getUTCDate()));
  const diffDays = Math.round((paidDate - dueDate) / 86400000);
  if (diffDays <= 0) return { status: 'paid', overdue: false, daysLate: 0 };
  return { status: 'paid-late', overdue: false, daysLate: diffDays };
}

/** Net salary = base + bonus - deductions - advance recovered (all paise). Never negative. */
export function netSalary({ baseSalary, bonus = 0, deductions = 0, advanceRecovered = 0 }) {
  return Math.max(0, baseSalary + bonus - deductions - advanceRecovered);
}

/**
 * Profit & loss for a period.
 * @param {object} p
 * @param {number} p.income        collected payments (paise)
 * @param {number} p.fuel
 * @param {number} p.repairs
 * @param {number} p.salaries
 * @param {number} p.other
 * @param {number} [p.publisherCost] optional — copies delivered × agency cost per copy
 */
export function profitAndLoss({ income, fuel = 0, repairs = 0, salaries = 0, other = 0, publisherCost = 0 }) {
  const totalExpenses = fuel + repairs + salaries + other + publisherCost;
  const netProfit = income - totalExpenses;
  const marginPct = income > 0 ? (netProfit / income) * 100 : null;
  return { income, fuel, repairs, salaries, other, publisherCost, totalExpenses, netProfit, marginPct };
}

/** True when a SalaryPayment already exists for this employee+month (the duplicate guard). */
export function isDuplicateSalary(existingPayments, employeeId, year, month) {
  return existingPayments.some((p) => String(p.employee) === String(employeeId) && p.forYear === year && p.forMonth === month);
}

/** Days until a document (insurance/PUC/fitness) expires; negative means already expired. */
export function daysUntil(date, today = new Date()) {
  if (!date) return null;
  const d = new Date(date);
  return Math.ceil((d - today) / 86400000);
}
