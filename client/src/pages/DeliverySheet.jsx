import { useState } from 'react';
import { Printer, Truck } from 'lucide-react';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, Field, PageHeader, Skeleton } from '../components/ui';
import { formatDate, todayKey } from '../lib/format';
import { BRAND } from '../lib/brand';

export default function DeliverySheet() {
  const [date, setDate] = useState(todayKey());
  const [employee, setEmployee] = useState('');
  const employees = useApi(() => api.employees({ active: 'true', limit: 100 }), []);
  const { data, loading, error, reload } = useApi(() => api.deliverySheet({ date, employee: employee || undefined }), [date, employee]);
  const [checked, setChecked] = useState({});

  const toggle = (id) => setChecked((c) => ({ ...c, [id]: !c[id] }));
  const doneCount = Object.values(checked).filter(Boolean).length;

  return (
    <>
      <PageHeader title="Daily Delivery Sheet" subtitle="Who gets what, for a route, on a given day" actions={<button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>} />

      <div className="card no-print mb-5 flex flex-wrap items-end gap-4 p-4">
        <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Employee / route"><select className="input" value={employee} onChange={(e) => setEmployee(e.target.value)}><option value="">All routes</option>{(employees.data?.items || []).map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</select></Field>
      </div>

      <section className="card print-area p-5" aria-label="Delivery sheet">
        <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="text-lg font-bold text-ink">{BRAND.name} — Delivery Sheet</h2>
            <p className="text-sm text-ink-muted">{formatDate(date)}{employee ? ` · ${employees.data?.items.find((e) => e._id === employee)?.name}` : ' · All routes'}</p>
          </div>
          {data && <span className="no-print text-sm text-ink-soft">{doneCount}/{data.totalCustomers} delivered</span>}
        </div>

        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-64" /> : !data.rows.length ? (
          <EmptyState icon={Truck} title="Nothing to deliver" message="No customer has a subscription delivering on this date." />
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left"><th className="th no-print w-10"></th><th className="th">Customer</th><th className="th">Address</th><th className="th">Publications</th><th className="th text-right">Copies</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.customer.id} className={`border-b border-line/60 ${checked[r.customer.id] ? 'opacity-50' : ''}`}>
                  <td className="td no-print"><input type="checkbox" className="h-4 w-4 rounded border-line accent-[rgb(44_83_146)]" checked={!!checked[r.customer.id]} onChange={() => toggle(r.customer.id)} aria-label={`Mark ${r.customer.name} delivered`} /></td>
                  <td className="td font-medium ml">{r.customer.name}{r.customer.routeName && <span className="ml-2 text-xs text-ink-muted">({r.customer.routeName})</span>}</td>
                  <td className="td ml max-w-[260px] truncate">{r.customer.address}</td>
                  <td className="td ml">{r.items.map((i) => `${i.publicationName}${i.copies > 1 ? ` ×${i.copies}` : ''}`).join(', ')}</td>
                  <td className="td text-right tabular-nums">{r.copies}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t-2 border-primary font-bold"><td className="no-print" /><td className="td" colSpan={3}>Total · {data.totalCustomers} customers</td><td className="td text-right tabular-nums">{data.totalCopies}</td></tr></tfoot>
          </table>
        )}
      </section>
    </>
  );
}
