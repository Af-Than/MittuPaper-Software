import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HandCoins, Search, Wallet } from 'lucide-react';
import { api } from '../api';
import { useApi, useDebounced } from '../hooks/useApi';
import { Badge, DueBadge, EmptyState, ErrorState, PageHeader, Pagination, Tabs, TableSkeleton } from '../components/ui';
import PaymentModal from '../components/PaymentModal';
import { formatDate, money, monthLabel } from '../lib/format';

const MODE = { cash: 'Cash', upi: 'UPI', other: 'Other' };

/** A payment's allocations summarised as "Aug 2026" or "Jul 2026 +2 more". */
function AllocationCell({ payment }) {
  const allocs = payment.allocations?.length ? payment.allocations : payment.bill ? [{ bill: payment.bill }] : [];
  if (!allocs.length) return '—';
  const first = allocs[0].bill;
  if (!first) return '—';
  return (
    <>
      {monthLabel(first.year, first.month)}
      {allocs.length > 1 && <span className="text-xs text-ink-muted"> +{allocs.length - 1} more</span>}
    </>
  );
}

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
              <thead className="border-b border-line bg-canvas/60"><tr><th className="th">Date</th><th className="th">Customer</th><th className="th">Applied to</th><th className="th text-right">Amount</th><th className="th">Mode</th><th className="th">Note</th><th className="th">Recorded by</th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p._id} className="border-b border-line/60 hover:bg-canvas/50">
                    <td className="td whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="td">{p.customer ? <Link className="font-medium ml hover:text-primary hover:underline" to={`/customers/${p.customer._id}`}>{p.customer.name}</Link> : '—'}</td>
                    <td className="td"><AllocationCell payment={p} /></td>
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
  const [pay, setPay] = useState(null);
  const { data, loading, error, reload } = useApi(async () => {
    const r = await api.customers({ filter: 'dues', limit: 200 });
    return r.items.sort((a, b) => b.due - a.due);
  });
  return (
    <>
      <p className="mb-3 text-sm text-ink-muted">Every customer with a pending balance, oldest due month shown first.</p>
      <div className="card overflow-hidden">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={6} cols={4} /> : data.length === 0 ? (
          <EmptyState icon={HandCoins} title="Nothing outstanding" message="Every customer is fully paid up." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas/60"><tr><th className="th">Customer</th><th className="th">Due</th><th className="th text-right">Actions</th></tr></thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c._id} className="border-b border-line/60 hover:bg-canvas/50">
                    <td className="td"><Link className="font-medium ml hover:text-primary hover:underline" to={`/customers/${c._id}`}>{c.name}</Link><div className="text-xs text-ink-muted">{c.phone}</div></td>
                    <td className="td"><DueBadge months={c.dueMonths} due={c.due} /></td>
                    <td className="td text-right">
                      <button className="btn-primary btn-sm" onClick={() => setPay(c)}><HandCoins className="h-3.5 w-3.5" /> Record payment</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <PaymentModal open={!!pay} customerId={pay?._id} customerName={pay?.name} onClose={() => setPay(null)} onSaved={() => { reload(); onPaid(); }} />
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
