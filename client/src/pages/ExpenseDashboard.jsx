import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle, Banknote, Bike, Calendar, IndianRupee, ShieldAlert, TrendingDown, TrendingUp, Users, Wrench,
} from 'lucide-react';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import { Badge, EmptyState, ErrorState, MonthYearPicker, PageHeader, Skeleton } from '../components/ui';
import { formatDateIST, formatIST, money, moneyCompact, monthLabel, currentYearMonth } from '../lib/format';
import { CATEGORY_COLOR, INCOME_LINE_COLOR, LEDGER_TYPE_LABEL } from '../lib/expenseFormat';

function StatCard({ icon: Icon, label, value, tone = 'primary', loading }) {
  const tones = { primary: 'bg-primary-50 text-primary', success: 'bg-success-soft text-success', danger: 'bg-danger-soft text-danger', warning: 'bg-warning-soft text-warning' };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</div>
          {loading ? <Skeleton className="mt-1 h-6 w-24" /> : <div className="truncate text-xl font-bold text-ink">{value}</div>}
        </div>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lift">
      <div className="mb-1 font-semibold text-ink">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-ink-soft"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />{p.name}</span>
          <span className="font-medium text-ink">{money(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const ALERT_TABS = [
  { key: 'documents', label: 'Documents', icon: ShieldAlert },
  { key: 'serviceDue', label: 'Service due', icon: Wrench },
  { key: 'mileageDrops', label: 'Mileage drop', icon: TrendingDown },
  { key: 'salaryPending', label: 'Salary pending', icon: Users },
  { key: 'repairsPending', label: 'Repairs pending', icon: AlertTriangle },
];

export default function ExpenseDashboard() {
  const [ym, setYm] = useState(currentYearMonth());
  const { data, loading, error, reload } = useApi(() => api.expenseDashboard(ym), [ym.year, ym.month]);
  const [alertTab, setAlertTab] = useState('documents');

  const pnl = data?.pnl;
  const chart = (data?.trend || []).map((t) => ({ ...t, label: monthLabel(t.year, t.month).replace(' ' + t.year, ''), fuel: t.fuel, repair: t.repairs, salary: t.salaries, other: t.other, income: t.income }));
  const alerts = data?.alerts;
  const totalAlerts = alerts ? Object.values(alerts).reduce((n, a) => n + a.length, 0) : 0;

  return (
    <>
      <PageHeader
        title="Expense Dashboard"
        subtitle="Fuel, repairs, salaries and other costs against collected income"
        actions={<MonthYearPicker year={ym.year} month={ym.month} onChange={setYm} />}
      />
      {error && <div className="card mb-5"><ErrorState message={error} onRetry={reload} /></div>}

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard loading={loading && !data} icon={Banknote} label="Income collected" value={pnl && money(pnl.income)} />
        <StatCard loading={loading && !data} icon={IndianRupee} tone="danger" label="Total expenses" value={pnl && money(pnl.totalExpenses)} />
        <StatCard loading={loading && !data} icon={pnl?.netProfit >= 0 ? TrendingUp : TrendingDown} tone={pnl?.netProfit >= 0 ? 'success' : 'danger'} label="Net profit" value={pnl && money(pnl.netProfit)} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2" aria-label="Expense trend">
          <h2 className="mb-1 text-base font-semibold text-ink">Expenses vs collected income</h2>
          <p className="mb-4 text-xs text-ink-muted">Last 12 months. Bars stack fuel, repairs, salaries and other costs; the line is income collected.</p>
          {loading && !data ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-soft" aria-hidden>
                {Object.entries(CATEGORY_COLOR).map(([k, c]) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{LEDGER_TYPE_LABEL[k]}</span>)}
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-3" style={{ background: INCOME_LINE_COLOR }} />Income</span>
              </div>
              <div className="h-72" role="img" aria-label="Stacked bar chart of monthly expenses by category with a line for income collected, over the last 12 months">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgb(237 240 245)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'rgb(229 233 240)' }} tick={{ fill: 'rgb(98 110 130)', fontSize: 11 }} />
                    <YAxis tickFormatter={moneyCompact} tickLine={false} axisLine={false} width={56} tick={{ fill: 'rgb(98 110 130)', fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(244 247 252)' }} />
                    <Bar dataKey="fuel" name="Fuel" stackId="e" fill={CATEGORY_COLOR.fuel} />
                    <Bar dataKey="repair" name="Repairs" stackId="e" fill={CATEGORY_COLOR.repair} />
                    <Bar dataKey="salary" name="Salaries" stackId="e" fill={CATEGORY_COLOR.salary} />
                    <Bar dataKey="other" name="Other" stackId="e" fill={CATEGORY_COLOR.other} radius={[3, 3, 0, 0]} />
                    <Line dataKey="income" name="Income" stroke={INCOME_LINE_COLOR} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </section>

        <section className="card p-5" aria-label="Alerts">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Alerts</h2>
            {totalAlerts > 0 && <Badge tone="danger">{totalAlerts}</Badge>}
          </div>
          {loading && !data ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-1">
                {ALERT_TABS.map((t) => (
                  <button key={t.key} onClick={() => setAlertTab(t.key)} aria-pressed={alertTab === t.key} className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${alertTab === t.key ? 'bg-primary text-white' : 'bg-canvas text-ink-soft hover:bg-primary-50'}`}>
                    <t.icon className="h-3 w-3" /> {t.label} {alerts[t.key].length > 0 && <span className="rounded-full bg-white/25 px-1">{alerts[t.key].length}</span>}
                  </button>
                ))}
              </div>
              {alerts[alertTab].length === 0 ? (
                <EmptyState icon={ShieldAlert} title="Nothing here" message="All clear for this category." />
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {alertTab === 'documents' && alerts.documents.map((a, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                      <span><Link to={`/expenses/vehicles/${a.vehicleId}`} className="font-medium hover:text-primary hover:underline">{a.registrationNumber}</Link> — {a.doc}</span>
                      <Badge tone={a.expired ? 'danger' : 'warning'}>{a.expired ? `Expired ${-a.days}d ago` : `${a.days}d left`}</Badge>
                    </li>
                  ))}
                  {alertTab === 'serviceDue' && alerts.serviceDue.map((a, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                      <Link to={`/expenses/vehicles/${a.vehicleId}`} className="font-medium hover:text-primary hover:underline">{a.registrationNumber}</Link>
                      <Badge tone="warning">{a.odometer} / {a.dueKm} km</Badge>
                    </li>
                  ))}
                  {alertTab === 'mileageDrops' && alerts.mileageDrops.map((a, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                      <Link to={`/expenses/vehicles/${a.vehicleId}`} className="font-medium hover:text-primary hover:underline">{a.registrationNumber}</Link>
                      <Badge tone="danger">avg {a.average?.toFixed(1)} km/unit</Badge>
                    </li>
                  ))}
                  {alertTab === 'salaryPending' && alerts.salaryPending.map((a, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                      <Link to={`/expenses/employees/${a.employeeId}`} className="font-medium hover:text-primary hover:underline ml">{a.name}</Link>
                      <Badge tone={a.overdue ? 'danger' : 'warning'}>{a.overdue ? 'Overdue' : 'Due soon'}</Badge>
                    </li>
                  ))}
                  {alertTab === 'repairsPending' && alerts.repairsPending.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                      <span>{a.registrationNumber} — {a.description}</span>
                      <span className="text-xs text-ink-muted">{formatDateIST(a.repairedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card p-5" aria-label="Costliest vehicles">
          <h2 className="mb-3 text-base font-semibold text-ink">Top 5 costliest vehicles this month</h2>
          {loading && !data ? <Skeleton className="h-40" /> : !data.vehicleCosts.length ? <EmptyState icon={Bike} title="No costs yet" message="Fuel and repair entries will appear here." /> : (
            <ul className="space-y-2">
              {data.vehicleCosts.map((v) => (
                <li key={v.vehicleId} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                  <Link to={`/expenses/vehicles/${v.vehicleId}`} className="font-medium hover:text-primary hover:underline">{v.registrationNumber}</Link>
                  <span className="font-semibold tabular-nums">{money(v.cost)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5" aria-label="Cost per employee">
          <h2 className="mb-3 text-base font-semibold text-ink">Cost per employee this month</h2>
          {loading && !data ? <Skeleton className="h-40" /> : !data.employeeCosts.length ? <EmptyState icon={Users} title="No costs yet" /> : (
            <ul className="space-y-2">
              {data.employeeCosts.map((e) => (
                <li key={e.employeeId} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                  <Link to={`/expenses/employees/${e.employeeId}`} className="font-medium hover:text-primary hover:underline ml">{e.name}</Link>
                  <span className="font-semibold tabular-nums">{money(e.cost)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-6 p-5" aria-label="Recent activity">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink"><Calendar className="h-4 w-4" /> Recent activity</h2>
        {loading && !data ? <Skeleton className="h-40" /> : !data.activity.length ? <EmptyState title="No activity yet" /> : (
          <ul className="divide-y divide-line">
            {data.activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex items-center gap-2"><Badge>{LEDGER_TYPE_LABEL[a.type]}</Badge><span className="ml">{a.description}</span></span>
                <span className="flex items-center gap-3 text-xs text-ink-muted"><span className="font-semibold text-ink">{money(a.amount)}</span>{formatIST(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
