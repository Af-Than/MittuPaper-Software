import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, Files, HandCoins, RefreshCw, Search } from 'lucide-react';
import { api } from '../api';
import { download, errorMessage } from '../api/client';
import { useApi, useDebounced } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { Badge, EmptyState, ErrorState, MonthYearPicker, PageHeader, Pagination, StatusBadge, TableSkeleton, shiftMonth } from '../components/ui';
import ConfirmDialog from '../components/ConfirmDialog';
import PaymentModal from '../components/PaymentModal';
import { currentYearMonth, money, monthLabel } from '../lib/format';

const STATUSES = [
  { key: '', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'partial', label: 'Partial' },
  { key: 'paid', label: 'Paid' },
];

export default function MonthlyBills() {
  const toast = useToast();
  const [ym, setYm] = useState(currentYearMonth());
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [confirmGen, setConfirmGen] = useState(false);
  const [pay, setPay] = useState(null);
  const [exporting, setExporting] = useState(false);
  const dq = useDebounced(q, 300);

  useEffect(() => setPage(1), [ym.year, ym.month, status, dq]);
  const { data, loading, error, reload } = useApi(
    () => api.bills({ year: ym.year, month: ym.month, status: status || undefined, q: dq || undefined, page, limit: 100 }),
    [ym.year, ym.month, status, dq, page]
  );

  const generateAll = async () => {
    try {
      const r = await api.generateAll(ym);
      toast.success(`${r.generated} bill${r.generated === 1 ? '' : 's'} generated${r.skippedPaid ? ` · ${r.skippedPaid} already paid (kept)` : ''}${r.skippedEmpty ? ` · ${r.skippedEmpty} had nothing to bill` : ''}`);
      if (r.failed.length) toast.error(`${r.failed.length} failed: ${r.failed[0].customer} — ${r.failed[0].message}`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  const exportXlsx = async () => {
    setExporting(true);
    try {
      await download('/export/monthly', { ...ym, status: status || undefined, q: dq || undefined }, `monthly-bills-${ym.year}-${ym.month}.xlsx`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const t = data?.totals;
  const isFiltered = !!status || !!dq;

  return (
    <>
      <PageHeader
        title="All Monthly Bills"
        subtitle="Every customer's bill for the month, with dues carried forward"
        actions={
          <>
            <button className="btn-secondary" onClick={exportXlsx} disabled={exporting || !data?.total}><Download className="h-4 w-4" /> Excel</button>
            <button className="btn-primary" onClick={() => setConfirmGen(true)}><RefreshCw className="h-4 w-4" /> Generate all bills</button>
          </>
        }
      />

      <div className="card mb-5 flex flex-wrap items-end gap-4 p-4">
        <div>
          <span className="mb-1 block text-sm font-medium text-ink">Month</span>
          <div className="flex items-center gap-2">
            <button className="btn-secondary px-2.5" onClick={() => setYm(shiftMonth(ym, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
            <MonthYearPicker {...ym} onChange={setYm} />
            <button className="btn-secondary px-2.5" onClick={() => setYm(shiftMonth(ym, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-ink">Status</span>
          <div className="inline-flex rounded-xl border border-line p-1" role="group" aria-label="Filter by status">
            {STATUSES.map((s) => (
              <button key={s.key} onClick={() => setStatus(s.key)} aria-pressed={status === s.key} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${status === s.key ? 'bg-primary text-white' : 'text-ink-soft hover:bg-primary-50'}`}>{s.label}</button>
            ))}
          </div>
        </div>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-[calc(50%+10px)] h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <label htmlFor="mb-search" className="mb-1 block text-sm font-medium text-ink">Search</label>
          <input id="mb-search" className="input pl-9" type="search" placeholder="Customer name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={8} cols={7} /> : data.items.length === 0 ? (
          <EmptyState
            icon={Files}
            title={isFiltered ? 'No bills match' : `No bills for ${monthLabel(ym.year, ym.month)}`}
            message={isFiltered ? 'Try clearing the filters.' : 'Generate bills to create an invoice for every customer with active subscriptions.'}
            action={!isFiltered && <button className="btn-primary" onClick={() => setConfirmGen(true)}><RefreshCw className="h-4 w-4" /> Generate all bills</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas/60">
                <tr><th className="th">Customer</th><th className="th text-right">Current charges</th><th className="th text-right">Previous due</th><th className="th text-right">Total payable</th><th className="th text-right">Paid</th><th className="th text-right">Balance</th><th className="th">Status</th><th className="th text-right"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b._id} className="border-b border-line/60 hover:bg-canvas/50">
                    <td className="td">
                      <Link to={`/billing/customer?customer=${b.customer._id}&year=${b.year}&month=${b.month}`} className="font-medium text-ink ml hover:text-primary hover:underline">{b.customer.name}</Link>
                      <div className="text-xs text-ink-muted">{b.customer.phone}</div>
                    </td>
                    <td className="td text-right tabular-nums">{money(b.currentCharges)}</td>
                    <td className="td text-right tabular-nums text-ink-soft">{money(b.previousDue)}</td>
                    <td className="td text-right font-medium tabular-nums">{money(b.totalPayable)}</td>
                    <td className="td text-right tabular-nums text-success">{money(b.amountPaid)}</td>
                    <td className={`td text-right font-semibold tabular-nums ${b.balance > 0 ? 'text-danger' : 'text-ink-muted'}`}>{money(b.balance)}</td>
                    <td className="td"><div className="flex flex-wrap items-center gap-1"><StatusBadge status={b.status} />{b.carriedForward && b.balance > 0 && <Badge>Carried</Badge>}</div></td>
                    <td className="td text-right">
                      {b.balance > 0 && !b.carriedForward && <button className="btn-secondary btn-sm" onClick={() => setPay(b)}><HandCoins className="h-3.5 w-3.5" /> Pay</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary bg-primary-50/60 font-bold">
                  <td className="td">Total{isFiltered ? ' (filtered)' : ''} · {data.total} bills</td>
                  <td className="td text-right tabular-nums">{money(t.currentCharges)}</td>
                  <td className="td text-right tabular-nums">{money(t.previousDue)}</td>
                  <td className="td text-right tabular-nums">{money(t.totalPayable)}</td>
                  <td className="td text-right tabular-nums text-success">{money(t.amountPaid)}</td>
                  <td className="td text-right tabular-nums text-danger">{money(t.balance)}</td>
                  <td className="td" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}

      <ConfirmDialog
        open={confirmGen}
        danger={false}
        title={`Generate ${monthLabel(ym.year, ym.month)} bills?`}
        message={<>Bills are created for every active customer with a subscription in this month. Existing unpaid or partly-paid bills are refreshed with the latest rates and adjustments; fully paid bills are left untouched. Later months' carried-forward dues update automatically.</>}
        confirmLabel="Generate all"
        onConfirm={generateAll}
        onClose={() => setConfirmGen(false)}
      />
      <PaymentModal open={!!pay} bill={pay} customerName={pay?.customer?.name} onClose={() => setPay(null)} onSaved={reload} />
    </>
  );
}
