import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bike, HandCoins, Phone, Receipt } from 'lucide-react';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import { useCrumb } from '../components/AppLayout';
import { Badge, EmptyState, ErrorState, Skeleton, TableSkeleton } from '../components/ui';
import SalarySlipModal from '../components/SalarySlipModal';
import { formatDateIST, formatIST, initials, money, monthLabel } from '../lib/format';
import { PAY_MODE_LABEL, VEHICLE_STATUS_LABEL } from '../lib/expenseFormat';

export default function EmployeeDetail() {
  const { id } = useParams();
  const { data: employee, loading, error, reload } = useApi(() => api.employee(id), [id]);
  const salaries = useApi(() => api.salaryHistory({ employee: id, limit: 24 }), [id]);
  const advances = useApi(() => api.advances({ employee: id }), [id]);
  const [slip, setSlip] = useState(null);

  useCrumb(employee?.name);

  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  if (loading && !employee) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-48" /></div>;
  if (!employee) return null;

  return (
    <div className="space-y-6">
      <section className="card p-5" aria-label="Employee profile">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xl font-semibold text-primary" aria-hidden>{initials(employee.name)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-ink ml">{employee.name}</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft"><Phone className="h-4 w-4 text-ink-muted" />{employee.phone}</p>
            <p className="mt-1 text-sm text-ink-soft">Joined {formatDateIST(employee.joinDate)} · Monthly salary {money(employee.monthlySalary)}</p>
          </div>
          {!employee.active && <Badge>Inactive</Badge>}
        </div>
      </section>

      <section className="card" aria-label="Vehicles">
        <div className="border-b border-line px-5 py-4"><h2 className="text-base font-semibold text-ink">Vehicles</h2></div>
        {!employee.vehicles.length ? <EmptyState icon={Bike} title="No vehicles assigned" /> : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {employee.vehicles.map((v) => (
              <Link key={v._id} to={`/expenses/vehicles/${v._id}`} className="card p-3 transition-colors hover:border-primary-200">
                <div className="flex items-center justify-between"><span className="font-semibold">{v.registrationNumber}</span><Badge tone={v.status === 'active' ? 'success' : v.status === 'in-repair' ? 'warning' : 'neutral'}>{VEHICLE_STATUS_LABEL[v.status]}</Badge></div>
                <p className="mt-1 text-xs text-ink-muted">{v.makeModel} · {v.odometer} km</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card" aria-label="Salary history">
        <div className="border-b border-line px-5 py-4"><h2 className="text-base font-semibold text-ink">Salary history</h2></div>
        {salaries.loading && !salaries.data ? <TableSkeleton rows={4} cols={5} /> : !salaries.data?.items.length ? (
          <EmptyState icon={HandCoins} title="No salary payments yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line"><th className="th">Month</th><th className="th text-right">Net paid</th><th className="th">Paid on (IST)</th><th className="th">Mode</th><th className="th"><span className="sr-only">Slip</span></th></tr></thead>
              <tbody>
                {salaries.data.items.map((p) => (
                  <tr key={p._id} className="border-b border-line/60 last:border-0">
                    <td className="td font-medium">{monthLabel(p.forYear, p.forMonth)}</td>
                    <td className="td text-right tabular-nums text-success">{money(p.netPaid)}</td>
                    <td className="td whitespace-nowrap">{formatIST(p.paidOn)}</td>
                    <td className="td"><Badge>{PAY_MODE_LABEL[p.mode]}</Badge></td>
                    <td className="td"><button className="text-primary hover:text-primary-800" onClick={() => setSlip(p._id)} aria-label="View salary slip"><Receipt className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!!advances.data?.length && (
        <section className="card" aria-label="Salary advances">
          <div className="border-b border-line px-5 py-4"><h2 className="text-base font-semibold text-ink">Salary advances</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line"><th className="th">Given on</th><th className="th">Reason</th><th className="th text-right">Amount</th><th className="th text-right">Recovered</th><th className="th text-right">Outstanding</th></tr></thead>
              <tbody>
                {advances.data.map((a) => (
                  <tr key={a._id} className="border-b border-line/60 last:border-0">
                    <td className="td">{formatDateIST(a.givenOn)}</td>
                    <td className="td text-ink-soft">{a.reason || '—'}</td>
                    <td className="td text-right tabular-nums">{money(a.amount)}</td>
                    <td className="td text-right tabular-nums text-success">{money(a.recoveredAmount)}</td>
                    <td className="td text-right font-medium tabular-nums text-warning">{money(a.amount - a.recoveredAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <SalarySlipModal open={!!slip} paymentId={slip} onClose={() => setSlip(null)} />
    </div>
  );
}
