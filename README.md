# PaperTrail — Newspaper & Magazine Delivery Management

A MERN-stack system for newspaper delivery agencies: customers, subscriptions, rate history, day-by-day billing with carry-forward dues, payments, Excel statements and an admin activity log.
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

### Carry-forward
- `previousDue` = balance of the customer's most recent earlier bill; `total = current charges + previousDue`.
- Paying in full → status *Paid*, nothing carries. A partial payment carries only the remaining balance.
- Payments are accepted on a customer's **latest** bill (earlier dues are already rolled into it; older bills show a "Carried" tag). This keeps the chain consistent.
- Regenerating an unpaid/partial bill (after rate, subscription or skip changes) re-chains every later bill's previous due automatically. Fully paid bills are locked.

## Project structure
```
server/  config/ models/ routes/ controllers/ services/ middleware/ utils/ seed/ tests/
client/src/  components/ pages/ hooks/ api/ context/ lib/ styles/
```

## Assumptions
- Rates come with a seed of realistic placeholders (e.g. ₹9/copy); real rates are entered in **Publications & Rates**. A rate entered with an earlier date than the first entry applies to earlier deliveries too.
- Seed creates **6** months of past bills (not 3) so the dashboard chart has a trend; the current month is left ungenerated for the demo. Seeded login/audit history entries are demo data.
- Deleting a customer removes all their related records (confirmation dialog warns). Mark them inactive to stop billing but keep history.
- Deactivating a publication only blocks new subscriptions. Existing ones keep billing until ended.
- A month is billed on its full schedule, even if generated mid-month.
- Payments cannot be deleted or edited (kept as an immutable ledger).
- Excel uses the *Nirmala UI* font for names/addresses so Malayalam renders on Windows; Excel substitutes a font elsewhere.

## 5-minute client demo script
1. **Login** as `admin1`; point out the Activity page logs every sign-in.
2. **Dashboard**: stat cards, billed-vs-collected chart, top dues.
3. **Customers**: cards, search Malayalam names (try `അനിൽ`), open a customer.
4. **Publications & Rates**: Update the rate of *Mathrubhumi* effective from a date; expand the history timeline. Mention past bills don't change.
5. **Adjust a subscription**: on the customer, edit weekdays or add a magazine; click a day in the calendar to skip it / add an extra copy.
6. **Billing → Customer Bill**: choose the customer for the current month → *Generate bill*; show invoice, daily breakdown, **Print**.
7. **All Monthly Bills** → *Generate all bills* for the current month; show previous dues carried from last month.
8. **Record a partial payment** on a bill; show status turns *Partial*.
9. Open the **next month**: the remaining balance appears as previous due (carry-forward).
10. **Excel**: download the customer bill, the monthly sheet and the **Yearly Report**.
