import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertCircle, ArrowRight, BadgeIndianRupee, Banknote, FileSpreadsheet, HandCoins, Newspaper, Table2, BarChart3, UserPlus, Users, Repeat, Wallet,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui';
import { MONTHS_SHORT, money, moneyCompact, monthLabel, initials } from '../lib/format';

function StatCard({ icon: Icon, label, value, hint, tone = 'primary', loading }) {
  const tones = {
    primary: 'bg-primary-50 text-primary',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</div>
          {loading ? <Skeleton className="mt-1 h-6 w-24" /> : <div className="truncate text-xl font-bold text-ink">{value}</div>}
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

const TILES = [
  { to: '/customers?new=1', label: 'Add Customer', desc: 'Register a new subscriber', icon: UserPlus },
  { to: '/billing/monthly', label: 'Generate Bills', desc: 'Bill every customer for a month', icon: FileSpreadsheet },
  { to: '/payments?new=1', label: 'Record Payment', desc: 'Cash, UPI or other', icon: HandCoins },
  { to: '/publications', label: 'Manage Rates', desc: 'Update copy prices', icon: Newspaper },
];

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lift">
      <div className="mb-1 font-semibold text-ink">{monthLabel(row.year, row.month)}</div>
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
  const { data, loading, error, reload } = useApi(() => api.dashboard());
  const [view, setView] = useState('chart');
  const s = data?.stats;
  const ref = data?.reference;
  const refLabel = ref ? monthLabel(ref.year, ref.month) : '';
  const chart = (data?.chart || []).map((c) => ({ ...c, label: MONTHS_SHORT[c.month - 1] }));
  const hasChartData = chart.some((c) => c.billed || c.collected);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={refLabel ? `Figures for ${refLabel} — the latest billed month` : 'Overview of your delivery business'} />
      {error && <div className="card mb-5"><ErrorState message={error} onRetry={reload} /></div>}

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard loading={loading && !data} icon={Users} label="Customers" value={s?.totalCustomers} hint="Active customers" />
        <StatCard loading={loading && !data} icon={Repeat} label="Subscriptions" value={s?.activeSubscriptions} hint="Currently running" />
        <StatCard loading={loading && !data} icon={Banknote} label="Billed" value={s && money(s.billed)} hint={refLabel} />
        <StatCard loading={loading && !data} icon={Wallet} tone="success" label="Collected" value={s && money(s.collected)} hint={`Payments received in ${refLabel || 'the month'}`} />
        <StatCard loading={loading && !data} icon={AlertCircle} tone="danger" label="Outstanding" value={s && money(s.outstanding)} hint={s ? `${s.customersWithDues} customers with dues` : ''} />
      </section>

      <section aria-label="Quick actions" className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TILES.map((t) => (
            <Link key={t.label} to={t.to} className="card group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-700 to-primary-500 text-white"><t.icon className="h-6 w-6" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{t.label}</span>
                <span className="block truncate text-xs text-ink-muted">{t.desc}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1 group-hover:text-primary" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2" aria-label="Billed versus collected">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-ink">Billed vs collected</h2>
              <p className="text-xs text-ink-muted">Last 6 months. Collected = payments received that month.</p>
            </div>
            <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Chart view">
              <button onClick={() => setView('chart')} aria-pressed={view === 'chart'} className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === 'chart' ? 'bg-primary text-white' : 'text-ink-soft'}`}><BarChart3 className="mr-1 inline h-3.5 w-3.5" />Chart</button>
              <button onClick={() => setView('table')} aria-pressed={view === 'table'} className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === 'table' ? 'bg-primary text-white' : 'text-ink-soft'}`}><Table2 className="mr-1 inline h-3.5 w-3.5" />Table</button>
            </div>
          </div>

          {loading && !data ? (
            <Skeleton className="h-64 w-full" />
          ) : !hasChartData ? (
            <EmptyState icon={BadgeIndianRupee} title="No billing yet" message="Generate your first monthly bills to see the trend here." action={<Link to="/billing/monthly" className="btn-primary btn-sm">Generate bills</Link>} />
          ) : view === 'chart' ? (
            <>
              <div className="mb-2 flex gap-4 text-xs text-ink-soft" aria-hidden>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-chart-billed" />Billed</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-chart-collected" />Collected</span>
              </div>
              <div className="h-64" role="img" aria-label={`Bar chart of billed versus collected amounts for the last six months, ending ${refLabel}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
                    <CartesianGrid stroke="rgb(219 227 239)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'rgb(219 227 239)' }} tick={{ fill: 'rgb(107 122 148)', fontSize: 12 }} />
                    <YAxis tickFormatter={moneyCompact} tickLine={false} axisLine={false} width={56} tick={{ fill: 'rgb(107 122 148)', fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(238 244 253)' }} />
                    <Bar dataKey="billed" name="Billed" fill="rgb(47 111 208)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="collected" name="Collected" fill="rgb(201 106 10)" radius={[4, 4, 0, 0]} maxBarSize={28} />
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

        <section className="card p-5" aria-label="Top outstanding dues">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Top outstanding dues</h2>
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
                  <Link to={`/customers/${d.customerId}`} className="flex items-center gap-3 py-2.5 hover:bg-canvas/70">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary" aria-hidden>{initials(d.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{d.name}</span>
                      <span className="block text-xs text-ink-muted">as of {monthLabel(d.year, d.month)} bill</span>
                    </span>
                    <span className="font-semibold tabular-nums text-danger">{money(d.balance)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
