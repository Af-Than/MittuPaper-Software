import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCheck, HandCoins, Search, Wallet } from 'lucide-react';
import { api } from '../api';
import { useApi, useDebounced } from '../hooks/useApi';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, StatusBadge, Tabs, TableSkeleton } from '../components/ui';
import PaymentModal from '../components/PaymentModal';
import { formatDate, money, monthLabel } from '../lib/format';

const MODE = { cash: 'Cash', upi: 'UPI', other: 'Other' };

function History() {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q, 300);
  useEffect(() => setPage(1), [dq, mode]);
  const { data, loading, error, reload } = useApi(() => api.payments({ q: dq || undefined, mode: mode || undefined, page, limit: 20 }), [dq, mode, page]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input className="input pl-9" type="search" aria-label="Search payments" placeholder="Search by customer, phone or note" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" aria-label="Payment mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">All modes</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="other">Other</option>
        </select>
        {data && <span className="ml-auto text-sm text-ink-soft">{data.total} payments · <strong className="text-success">{money(data.sum)}</strong></span>}
      </div>
      <div className="card overflow-hidden">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={8} cols={6} /> : data.items.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments found" message={q || mode ? 'Try a different search.' : 'Payments you record against bills will appear here.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas/60"><tr><th className="th">Date</th><th className="th">Customer</th><th className="th">Against bill</th><th className="th text-right">Amount</th><th className="th">Mode</th><th className="th">Note</th><th className="th">Recorded by</th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p._id} className="border-b border-line/60 hover:bg-canvas/50">
                    <td className="td whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="td">{p.customer ? <Link className="font-medium ml hover:text-primary hover:underline" to={`/customers/${p.customer._id}`}>{p.customer.name}</Link> : '—'}</td>
                    <td className="td">{p.bill ? monthLabel(p.bill.year, p.bill.month) : '—'}</td>
                    <td className="td text-right font-semibold tabular-nums text-success">{money(p.amount)}</td>
                    <td className="td"><Badge>{MODE[p.mode]}</Badge></td>
                    <td className="td max-w-[200px] truncate text-ink-soft">{p.note || '—'}</td>
                    <td className="td text-ink-soft">{p.recordedByName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
    </>
  );
}

function Outstanding({ onPaid }) {
  const [pay, setPay] = useState({ bill: null, full: false });
  // Only a customer's latest bill takes payments (earlier dues are rolled into it)
  const { data, loading, error, reload } = useApi(async () => {
    const [u, p] = await Promise.all([api.bills({ status: 'unpaid', limit: 500 }), api.bills({ status: 'partial', limit: 500 })]);
    return [...u.items, ...p.items].filter((b) => !b.carriedForward && b.balance > 0).sort((a, b) => b.balance - a.balance);
  });
  return (
    <>
      <p className="mb-3 text-sm text-ink-muted">Each customer's latest bill with a balance. Earlier dues are already included in that bill.</p>
      <div className="card overflow-hidden">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={6} cols={5} /> : data.length === 0 ? (
          <EmptyState icon={CheckCheck} title="Nothing outstanding" message="Every customer is fully paid up." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas/60"><tr><th className="th">Customer</th><th className="th">Bill</th><th className="th text-right">Total payable</th><th className="th text-right">Paid</th><th className="th text-right">Balance</th><th className="th">Status</th><th className="th text-right">Actions</th></tr></thead>
              <tbody>
                {data.map((b) => (
                  <tr key={b._id} className="border-b border-line/60 hover:bg-canvas/50">
                    <td className="td"><Link className="font-medium ml hover:text-primary hover:underline" to={`/billing/customer?customer=${b.customer._id}&year=${b.year}&month=${b.month}`}>{b.customer.name}</Link><div className="text-xs text-ink-muted">{b.customer.phone}</div></td>
                    <td className="td">{monthLabel(b.year, b.month)}</td>
                    <td className="td text-right tabular-nums">{money(b.totalPayable)}</td>
                    <td className="td text-right tabular-nums text-success">{money(b.amountPaid)}</td>
                    <td className="td text-right font-semibold tabular-nums text-danger">{money(b.balance)}</td>
                    <td className="td"><StatusBadge status={b.status} /></td>
                    <td className="td">
                      <div className="flex justify-end gap-2">
                        <button className="btn-secondary btn-sm" onClick={() => setPay({ bill: b, full: false })}><HandCoins className="h-3.5 w-3.5" /> Record</button>
                        <button className="btn-primary btn-sm" onClick={() => setPay({ bill: b, full: true })}><CheckCheck className="h-3.5 w-3.5" /> Mark fully paid</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <PaymentModal open={!!pay.bill} bill={pay.bill} full={pay.full} customerName={pay.bill?.customer?.name} onClose={() => setPay({ bill: null, full: false })} onSaved={() => { reload(); onPaid(); }} />
    </>
  );
}

export default function Payments() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('new') ? 'due' : 'history');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHeader title="Payments" subtitle="Record what customers pay, in full or in part" />
      <div className="mb-4"><Tabs label="Payments" value={tab} onChange={setTab} tabs={[{ key: 'history', label: 'Payment history' }, { key: 'due', label: 'Record a payment' }]} /></div>
      {tab === 'history' ? <History key={version} /> : <Outstanding onPaid={() => setVersion((v) => v + 1)} />}
    </>
  );
}
