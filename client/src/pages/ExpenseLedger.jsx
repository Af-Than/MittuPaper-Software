import { useState } from 'react';
import { Download, Plus, Receipt } from 'lucide-react';
import { api } from '../api';
import { download, errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { Badge, EmptyState, ErrorState, Field, PageHeader, Pagination, TableSkeleton } from '../components/ui';
import OtherExpenseModal from '../components/OtherExpenseModal';
import { formatIST, money } from '../lib/format';
import { LEDGER_TYPE_LABEL } from '../lib/expenseFormat';

export default function ExpenseLedger() {
  const toast = useToast();
  const [filters, setFilters] = useState({ type: '', from: '', to: '', minAmount: '', maxAmount: '' });
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const query = { ...filters, type: filters.type || undefined, from: filters.from || undefined, to: filters.to || undefined, minAmount: filters.minAmount || undefined, maxAmount: filters.maxAmount || undefined, page, limit: 30 };
  const { data, loading, error, reload } = useApi(() => api.expenseLedger(query), [JSON.stringify(query)]);

  const exportXlsx = async () => {
    setExporting(true);
    try {
      await download('/export/ledger', query, 'expense-ledger.xlsx');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader title="Expense Ledger" subtitle="Every fuel, repair, salary and other expense in one place" actions={<><button className="btn-secondary" onClick={exportXlsx} disabled={exporting}><Download className="h-4 w-4" /> Excel</button><button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add other expense</button></>} />

      <div className="card mb-5 flex flex-wrap items-end gap-4 p-4">
        <Field label="Type"><select className="input" value={filters.type} onChange={(e) => { setFilters({ ...filters, type: e.target.value }); setPage(1); }}><option value="">All</option>{Object.entries(LEDGER_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="From"><input className="input" type="date" value={filters.from} onChange={(e) => { setFilters({ ...filters, from: e.target.value }); setPage(1); }} /></Field>
        <Field label="To"><input className="input" type="date" value={filters.to} onChange={(e) => { setFilters({ ...filters, to: e.target.value }); setPage(1); }} /></Field>
        <Field label="Min ₹"><input className="input w-28" inputMode="decimal" value={filters.minAmount} onChange={(e) => { setFilters({ ...filters, minAmount: e.target.value }); setPage(1); }} /></Field>
        <Field label="Max ₹"><input className="input w-28" inputMode="decimal" value={filters.maxAmount} onChange={(e) => { setFilters({ ...filters, maxAmount: e.target.value }); setPage(1); }} /></Field>
        {data && <span className="ml-auto text-sm text-ink-soft">{data.total} entries · <strong>{money(data.totalAmount)}</strong></span>}
      </div>

      <div className="card overflow-hidden">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={10} cols={6} /> : data.items.length === 0 ? (
          <EmptyState icon={Receipt} title="No expenses match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas/60"><tr><th className="th">Date</th><th className="th">Type</th><th className="th">Description</th><th className="th">Vehicle/Employee</th><th className="th text-right">Amount</th><th className="th">Created (IST)</th></tr></thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 hover:bg-canvas/50">
                    <td className="td whitespace-nowrap">{formatIST(r.date).split(',')[0]}</td>
                    <td className="td"><Badge>{LEDGER_TYPE_LABEL[r.type]}</Badge></td>
                    <td className="td max-w-[260px] truncate">{r.description}</td>
                    <td className="td ml">{r.vehicle || r.employee || '—'}</td>
                    <td className="td text-right font-medium tabular-nums">{money(r.amount)}</td>
                    <td className="td whitespace-nowrap text-xs text-ink-muted">{formatIST(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}

      <OtherExpenseModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={reload} />
    </>
  );
}
