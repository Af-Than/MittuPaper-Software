# PaperTrail — Newspaper & Magazine Delivery Management

A MERN-stack system for newspaper delivery agencies: customers, subscriptions, rate history, day-by-day billing with a due-months ledger, payments, Excel statements, an admin activity log, and a fleet/payroll **expense module** (employees, vehicles, fuel, repairs, salaries) with a Profit & Loss report.
The product name lives in one file per side: `client/src/lib/brand.js` and `server/config/brand.js`.

## Prerequisites
- Node.js 18+ (developed on Node 24)
- MongoDB running locally on `127.0.0.1:27017`

## Setup
```bash
npm install                 # installs server + client (npm workspaces)
cp .env.example .env        # already present after first setup; edit if needed
npm run seed -- --reset     # admins + demo data (omit --reset to keep existing data)
npm run dev                 # API on :5050, web app on http://localhost:5173
```
Other scripts: `npm test` (billing engine unit tests), `npm run build` (production client build; with `NODE_ENV=production npm start` the server also serves it).

### Environment variables (`.env`)
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 5050 | API port (5050, not 5000, to avoid common clashes) |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/paper_delivery_manager` | database |
| `JWT_SECRET` | dev value | **change in production** |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS origin |
| `ADMIN1_*`, `ADMIN2_*` | see `.env.example` | the two admin accounts (username, display name, password) |

### Admin accounts (created only by the seed script)
| Username | Password |
|---|---|
| `admin1` | `Admin@123` |
| `admin2` | `Admin@456` |

There is no signup route and no other role. Both admins see and edit everything. Change the passwords in `.env` and run `npm run seed -- --reset` (note: reset wipes all data).

## How billing works
Implemented as pure, unit-tested functions in `server/services/billing.js`; the DB layer is `billingService.js`. Money is integer **paise**.

1. For each subscription active in the month, every calendar day inside `[startDate, endDate]` is visited.
2. **Weekdays mode**: a copy (× "copies per delivery") counts when the weekday is selected. *Daily* = all 7 days.
   **Fixed per month mode**: the fixed count is billed once, on the first active day of the month.
3. `skipped` adjustments subtract copies on that day; `extra` adjustments add copies. A skip with *All publications* pauses weekday-mode deliveries; to skip a fixed monthly magazine, name it explicitly.
4. Each day's copies are multiplied by the rate **effective on that date** (so a mid-month rate change is split correctly).
5. Output: per-publication line items (with rate segments) and a day-by-day breakdown with running total.

**Worked example** — January (31 days), Mathrubhumi daily at ₹9, rate becomes ₹10 from 15 Jan; skipped 5–7 Jan; one extra copy on 20 Jan; Vanitha 2 copies/month at ₹60; previous due ₹150.
- Mathrubhumi: 1–14 Jan: 14 − 3 skipped = 11 × ₹9 = ₹99; 15–31 Jan: 17 × ₹10 = ₹170; extra 1 × ₹10 = ₹10 → ₹279
- Vanitha: 2 × ₹60 = ₹120
- Current charges ₹399 + previous due ₹150 = **total payable ₹549**. Customer pays ₹200 → balance ₹349, status *Partial*.

### Due-months ledger (never a single rolled-up number)
Each `Bill` tracks **only its own month**: `balance = currentCharges − amountPaid` for that month alone. "Previous dues" are never stored as one carried-forward figure — they are always *derived* by scanning a customer's earlier bills for a positive balance (`server/services/dues.js`, pure functions, unit-tested). `previousDue`/`totalPayable` on a bill are a generation-time **snapshot** for fast list totals and the printed/Excel invoice; every live view (the bill page, the customer card, the dashboard) recomputes the breakdown fresh.

**Worked 3-month example** — a customer is billed ₹341 in July, ₹355 in August, ₹355 in September and pays nothing:
- Viewing the September bill shows a "Previous dues" table: *July ₹341 · August ₹355*, total previous dues ₹696, so September's total payable = ₹355 + ₹696 = **₹1,051**.
- A payment of ₹400 with no month chosen is allocated **oldest month first**: July's ₹341 is cleared, ₹59 is applied to August, leaving August ₹296 and September ₹355 still pending (2 months, not 3).
- The admin can instead pick "a specific month" — e.g. pay September only, leaving July and August untouched — via `targetBillId` on the payment.
- Every card, table, invoice, Excel sheet and WhatsApp/copy reminder shows the same month-by-month figures, colour-coded amber (1 month) / red (2+ months).

Clearing a bill in full doesn't cascade anything (each bill is independent); regenerating a bill only recomputes *its own* charges, and `refreshSnapshots` quietly updates the stored snapshot numbers on every later bill of that customer so list views stay fast without being wrong.

## Project structure
```
server/  config/ models/ routes/ controllers/ services/ middleware/ utils/ seed/ tests/
client/src/  components/ pages/ hooks/ api/ context/ lib/ styles/
```

## Expense module (fleet & payroll)
A second, independent set of collections sharing the same database and admin login, under the **Expenses** nav section:
- **Employee** (delivery/supervisor staff — no login), **Vehicle** (Kerala `KL-xx-xx-xxxx` registrations), **FuelEntry**, **RepairEntry**, **SalaryPayment**, **SalaryAdvance**, **OtherExpense** (rent, electricity, etc.).
- Every record has a user-editable business date/time *and* immutable `createdAt`/`createdBy`; fuel/repair/salary entries are **soft-deleted** (`deletedAt`), never hard-removed, and every create/edit/delete is written to the same audit log as billing actions.
- **Timestamps are stored in UTC, entered and displayed in IST** (`server/utils/http.js#parseIST`, `client/src/lib/format.js#formatIST`) — the business operates in one timezone, so the server does the UTC⇄IST conversion rather than trusting the browser's own timezone.
- Pure calculations (mileage between full tanks, cost/km, salary on-time/late status, P&L) live in `server/services/expenses.js`, unit-tested the same way as billing.
- **Expense Dashboard**: P&L vs collected income, a 12-month stacked chart, alerts (documents expiring ≤30 days, service due, mileage dropped >20% vs the vehicle's own average, salary pending/overdue, repairs pending), and a recent-activity feed.
- **Salary**: one payment per employee per month (duplicate-guarded), with bonus/deductions/advance-recovery, a paid-on **timestamp**, and a printable slip. Advances are recovered automatically (oldest first) when a salary payment includes `advanceRecovered`.
- **Profit & Loss**: income (payments collected) minus fuel + repairs + salaries + other expenses + an optional **publisher cost** line (copies delivered × the publication's `agencyCostPerCopy`, a new field alongside the customer-facing rate).
- **Delivery Sheet**: for a date + route/employee, lists every customer and what they're due to receive that day (computed from subscriptions + skip/extra adjustments, same engine as billing) — a UI aid only, not billed.
- **Excel exports**: fuel log, repairs log, salary register, the full ledger and the P&L report — same formatting conventions as the billing sheets.
- **Global search** (header) covers customers, vehicles and employees. The **notifications bell** combines expense alerts with customers 2+ months overdue. **Settings** has a one-click full-data JSON backup.

## Assumptions
- Rates come with a seed of realistic placeholders (e.g. ₹9/copy); real rates are entered in **Publications & Rates**. A rate entered with an earlier date than the first entry applies to earlier deliveries too.
- Seed creates **6** months of past bills (not 3) so the dashboard chart has a trend; the current month is left ungenerated for the demo. Seeded login/audit history entries are demo data.
- Deleting a customer removes all their related records (confirmation dialog warns). Mark them inactive to stop billing but keep history.
- Deactivating a publication only blocks new subscriptions. Existing ones keep billing until ended.
- A month is billed on its full schedule, even if generated mid-month.
- Payments cannot be deleted or edited (kept as an immutable ledger); expense entries (fuel/repair/salary/other) can be, via soft delete.
- Excel uses the *Nirmala UI* font for names/addresses so Malayalam renders on Windows; Excel substitutes a font elsewhere.
- Seed: 4 employees, **4 vehicles each** (16 total) — representing each employee's route fleet — with a realistic Kerala-market mix (Hero Splendor, Honda Activa, TVS, an EV scooter, a Tata Ace mini-van, a Piaggio Ape auto). A few documents are deliberately expired or expiring within 30 days, and one vehicle has a seeded mileage drop, so the Expense Dashboard's alerts are populated on first run.
- Three customers are deliberately left with exactly 1, 2 and 3 months of dues in the seed (everyone else varies randomly), so the due-months ledger is visibly exercised immediately.
- The WhatsApp reminder link needs no API/business account — it's a `wa.me` deep link prefilled with a message; the admin still presses send themselves.
- The unified Expense Ledger merges four collections in memory after a capped per-type query (2000 rows each) rather than a database-level UNION; fine at agency scale, not meant for millions of rows.

## 5-minute client demo script
1. **Login** as `admin1`; point out the Activity page logs every sign-in, and the notifications bell in the header.
2. **Dashboard**: stat cards, billed-vs-collected chart, top dues (shows the oldest pending month and how many are due).
3. **Customers**: cards with due-months badges, search Malayalam names (try `അനിൽ`), open a customer with 3 months due — show the dues timeline and the **WhatsApp/Copy reminder** (switch EN/Malayalam).
4. **Publications & Rates**: update the rate of *Mathrubhumi* effective from a date; expand the history timeline. Mention past bills don't change.
5. **Adjust a subscription**: on the customer, edit weekdays or add a magazine; click a day in the calendar to skip it / add an extra copy.
6. **Billing → Customer Bill**: choose that same customer → show the **Previous dues table** broken down by month, then **Generate bill**, daily breakdown, **Print**.
7. **Record a payment**: open the payment modal, show "oldest month first" vs "a specific month", pay the oldest month only — the balance moves, not clears, for the other months.
8. **All Monthly Bills**: the "Due months" column and the "2+ months overdue" filter.
9. **Expense Dashboard**: P&L vs income, the alerts panel (an expired document, a mileage drop, salary pending).
10. **Add a fuel entry and a repair** from a Vehicle Detail page; **pay a salary** from the Salaries grid and open the printable slip.
11. **Profit & Loss** report for the month; **Excel**: download the customer bill, the monthly sheet, the Yearly Report, and one expense export (e.g. the ledger).
12. Open the **Delivery Sheet** for today and the **Settings** page's backup download.
