import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, BadgeIndianRupee, BarChart3, FileSpreadsheet, Fuel, HandCoins, Newspaper, Receipt, Table2, UserPlus } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import { Avatar, Badge, EmptyState, ErrorState, Skeleton } from '../components/ui';
import { CountUp, useStaggerIn } from '../lib/motion';
import { MONTHS_SHORT, money, moneyCompact, monthLabel } from '../lib/format';
import { useAuth } from '../context/AuthContext';

const QUICK_ACTIONS = [
  { label: 'Add customer', to: '/customers?new=1', icon: UserPlus, color: 'bg-blue-100 text-blue-700' },
  { label: 'Generate bills', to: '/billing/monthly', icon: FileSpreadsheet, color: 'bg-indigo-100 text-indigo-700' },
  { label: 'Record payment', to: '/payments?new=1', icon: HandCoins, color: 'bg-emerald-100 text-emerald-700' },
  { label: 'Manage rates', to: '/publications', icon: Newspaper, color: 'bg-amber-100 text-amber-700' },
  { label: 'Add fuel entry', to: '/expenses/fuel?new=1', icon: Fuel, color: 'bg-cyan-100 text-cyan-700' },
  { label: 'Pay salary', to: '/expenses/salaries?new=1', icon: Receipt, color: 'bg-rose-100 text-rose-700' },
];

function StatCard({ label, icon: Icon, count, format, hint, chip, trend, loading }) {
  return (
    <div className="card dashboard-card p-5 shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${chip}`}><Icon className="h-5 w-5" aria-hidden /></span>
        {trend && <Badge tone={trend.tone || 'primary'}>{trend.label}</Badge>}
      </div>
      <div className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</div>
      {loading ? <Skeleton className="mt-2 h-7 w-24" /> : (
        <div className="mt-1 truncate text-[30px] font-bold leading-tight tracking-tight text-ink tabular-nums">
          <CountUp value={count} format={format} />
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/80 bg-surface/95 px-4 py-3 text-sm shadow-lift backdrop-blur">
      <div className="mb-2 font-semibold text-ink">{monthLabel(row.year, row.month)}{row.isCurrent ? ' · so far' : ''}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-ink-soft"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />{p.name}</span>
          <span className="font-medium text-ink">{money(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { admin } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.dashboard());
  const [view, setView] = useState('chart');
  const stats = useRef(null);
  useStaggerIn(stats, ':scope > .card', !!data);
  const s = data?.stats;
  const ref = data?.reference;
  const refLabel = ref ? monthLabel(ref.year, ref.month) : '';
  const chart = (data?.chart || []).map((c) => ({ ...c, label: MONTHS_SHORT[c.month - 1], isCurrent: c.year === ref?.year && c.month === ref?.month }));
  const hasChartData = chart.some((c) => c.billed || c.collected);
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const trend = (key) => {
    if (chart.length < 2) return null;
    const current = chart[chart.length - 1]?.[key] || 0;
    const previous = chart[chart.length - 2]?.[key] || 0;
    if (!previous) return null;
    const change = Math.round(((current - previous) / previous) * 100);
    return { label: `${change >= 0 ? '+' : ''}${change}% vs last month`, tone: change >= 0 ? 'success' : 'warning' };
  };

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl bg-hero px-6 py-7 text-white shadow-lift sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[28px] border-white/10" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-100">{greeting}, {admin?.name || 'there'}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-sm text-blue-100">{refLabel ? `${refLabel} · latest billing cycle` : 'Your delivery business at a glance'}</p>
          </div>
          <Link to="/billing/monthly" className="btn min-h-10 w-fit bg-white text-primary-700 shadow-lg hover:bg-blue-50 active:bg-blue-100"><FileSpreadsheet className="h-4 w-4" aria-hidden /> Generate bills</Link>
        </div>
      </section>
      {error && <div className="card mb-5"><ErrorState message={error} onRetry={reload} /></div>}

      <section ref={stats} aria-label="Key figures" className="relative z-10 -mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={loading && !data} icon={UserPlus} chip="bg-blue-100 text-blue-700" label="Customers" count={s?.totalCustomers} hint={s && `${s.activeSubscriptions} active subscriptions`} trend={{ label: 'Active base', tone: 'primary' }} />
        <StatCard loading={loading && !data} icon={FileSpreadsheet} chip="bg-indigo-100 text-indigo-700" label="Billed" count={s?.billed} format={money} hint={refLabel} trend={trend('billed')} />
        <StatCard loading={loading && !data} icon={HandCoins} chip="bg-emerald-100 text-emerald-700" label="Collected" count={s?.collected} format={money} hint={`Received in ${refLabel || 'the month'}`} trend={trend('collected')} />
        <StatCard loading={loading && !data} icon={ArrowUpRight} chip="bg-rose-100 text-rose-700" label="Outstanding" count={s?.outstanding} format={money} hint={s ? `${s.customersWithDues} customers with dues` : ''} trend={{ label: 'Needs follow-up', tone: 'danger' }} />
      </section>

      <section aria-label="Quick actions" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {QUICK_ACTIONS.map(({ label, to, icon: Icon, color }) => <Link key={label} to={to} className="quick-action flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card transition-all hover:border-primary-200 hover:shadow-lift"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color}`}><Icon className="h-4 w-4" aria-hidden /></span><span className="text-xs font-semibold leading-tight text-ink">{label}</span></Link>)}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card dashboard-card min-w-0 p-5 xl:col-span-2" aria-label="Billed versus collected">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="t-section">Billed vs collected</h2>
              <p className="text-xs text-ink-muted">Last 6 months. Collected = payments received that month.</p>
            </div>
            <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Chart view">
              <button onClick={() => setView('chart')} aria-pressed={view === 'chart'} className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === 'chart' ? 'bg-primary-50 text-primary' : 'text-ink-soft'}`}><BarChart3 className="mr-1 inline h-3.5 w-3.5" />Chart</button>
              <button onClick={() => setView('table')} aria-pressed={view === 'table'} className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === 'table' ? 'bg-primary-50 text-primary' : 'text-ink-soft'}`}><Table2 className="mr-1 inline h-3.5 w-3.5" />Table</button>
            </div>
          </div>

          {loading && !data ? (
            <Skeleton className="h-64 w-full" />
          ) : !hasChartData ? (
            <EmptyState icon={BadgeIndianRupee} title="No billing yet" message="Generate your first monthly bills to see the trend here." action={<Link to="/billing/monthly" className="btn-primary btn-sm">Generate bills</Link>} />
          ) : view === 'chart' ? (
            <>
              <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-soft" aria-hidden>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-chart-billed" />Billed</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-chart-collected" />Collected</span>
                <span className="text-ink-muted">Latest month is shown so far</span>
              </div>
              <div className="h-64" role="img" aria-label={`Bar chart of billed versus collected amounts for the last six months, ending ${refLabel}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
                    <CartesianGrid stroke="rgb(237 240 245)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'rgb(229 233 240)' }} tick={{ fill: 'rgb(98 110 130)', fontSize: 12 }} />
                    <YAxis tickFormatter={moneyCompact} tickLine={false} axisLine={false} width={56} tick={{ fill: 'rgb(98 110 130)', fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(244 247 252)' }} />
                    <defs>
                      <linearGradient id="billedGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" /><stop offset="100%" stopColor="#60a5fa" /></linearGradient>
                      <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d9488" /><stop offset="100%" stopColor="#5eead4" /></linearGradient>
                    </defs>
                    <Bar dataKey="billed" name="Billed" fill="url(#billedGradient)" radius={[7, 7, 0, 0]} maxBarSize={32}>{chart.map((c) => <Cell key={`billed-${c.year}-${c.month}`} fill={c.isCurrent ? 'url(#billedGradient)' : 'url(#billedGradient)'} />)}</Bar>
                    <Bar dataKey="collected" name="Collected" fill="url(#collectedGradient)" radius={[7, 7, 0, 0]} maxBarSize={32}>{chart.map((c) => <Cell key={`collected-${c.year}-${c.month}`} fill="url(#collectedGradient)" />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line"><th className="th">Month</th><th className="th text-right">Billed</th><th className="th text-right">Collected</th></tr></thead>
                <tbody>
                  {chart.map((c) => (
                    <tr key={`${c.year}-${c.month}`} className="border-b border-line/60 last:border-0">
                      <td className="td">{monthLabel(c.year, c.month)}</td>
                      <td className="td text-right tabular-nums">{money(c.billed)}</td>
                      <td className="td text-right tabular-nums">{money(c.collected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card dashboard-card min-w-0 p-5" aria-label="Top outstanding dues">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="t-section">Top outstanding dues</h2>
            <Link to="/customers?filter=dues" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          {loading && !data ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : !data?.topDues.length ? (
            <EmptyState icon={HandCoins} title="All clear" message="No customer has an outstanding balance." />
          ) : (
            <ul className="divide-y divide-line">
              {data.topDues.map((d) => (
                <li key={d.customerId}>
                  <Link to={`/customers/${d.customerId}`} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-danger-soft/60">
                    <Avatar name={d.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{d.name}</span>
                      <span className="block text-xs text-ink-muted">
                        Pending since {monthLabel(d.year, d.month)} ({d.monthsDue} month{d.monthsDue > 1 ? 's' : ''})
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-bold tabular-nums text-danger">{money(d.balance)}</span>
                    <Badge tone={d.monthsDue >= 2 ? 'danger' : 'warning'}>{d.monthsDue} mo</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card dashboard-card mt-6 overflow-hidden p-5" aria-label="Today's focus">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="t-section">Today&apos;s focus</h2><p className="text-xs text-ink-muted">A short queue to keep the next actions visible.</p></div>
          <Link to="/activity" className="text-xs font-semibold text-primary hover:underline">View activity <ArrowUpRight className="inline h-3.5 w-3.5" aria-hidden /></Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link to="/customers?filter=dues" className="rounded-xl border border-danger/15 bg-danger-soft/45 p-3 transition-colors hover:bg-danger-soft"><p className="text-xs font-semibold uppercase tracking-wide text-danger">Follow up</p><p className="mt-1 text-sm font-medium text-ink">{s?.customersWithDues || 0} customers have dues</p></Link>
          <Link to="/billing/monthly" className="rounded-xl border border-primary/15 bg-primary-50 p-3 transition-colors hover:bg-primary-100"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Billing cycle</p><p className="mt-1 text-sm font-medium text-ink">Review {refLabel || 'the latest'} bills</p></Link>
          <Link to="/publications" className="rounded-xl border border-accent/20 bg-amber-50 p-3 transition-colors hover:bg-amber-100"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Rates</p><p className="mt-1 text-sm font-medium text-ink">Keep publication pricing current</p></Link>
        </div>
      </section>
    </>
  );
}
