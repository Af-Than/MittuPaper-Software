import { useState } from 'react';
import { Download, Plus, Trash2, Wrench } from 'lucide-react';
import { api } from '../api';
import { download, errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { Badge, EmptyState, ErrorState, Field, PageHeader, Pagination, TableSkeleton } from '../components/ui';
import ConfirmDialog from '../components/ConfirmDialog';
import RepairEntryModal from '../components/RepairEntryModal';
import { formatIST, money } from '../lib/format';
import { REPAIR_CATEGORY_LABEL } from '../lib/expenseFormat';

export default function Repairs() {
  const toast = useToast();
  const [filters, setFilters] = useState({ vehicle: '', category: '', status: '' });
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [exporting, setExporting] = useState(false);

  const vehicles = useApi(() => api.vehicles({ limit: 200 }), []);
  const { data, loading, error, reload } = useApi(
    () => api.repairs({ vehicle: filters.vehicle || undefined, category: filters.category || undefined, status: filters.status || undefined, page, limit: 25 }),
    [filters, page]
  );

  const remove = async () => {
    try {
      await api.deleteRepair(toDelete._id);
      toast.success('Repair entry removed');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  const exportXlsx = async () => {
    setExporting(true);
    try {
      await download('/export/repairs', { vehicle: filters.vehicle || undefined, category: filters.category || undefined, status: filters.status || undefined }, 'repairs-log.xlsx');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader title="Repairs" subtitle="Service, tyre, brake and other repair history" actions={<><button className="btn-secondary" onClick={exportXlsx} disabled={exporting}><Download className="h-4 w-4" /> Excel</button><button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add repair entry</button></>} />

      <div className="card mb-5 flex flex-wrap items-end gap-4 p-4">
        <Field label="Vehicle" className="min-w-[180px]"><select className="input" value={filters.vehicle} onChange={(e) => { setFilters({ ...filters, vehicle: e.target.value }); setPage(1); }}><option value="">All vehicles</option>{(vehicles.data?.items || []).map((v) => <option key={v._id} value={v._id}>{v.registrationNumber}</option>)}</select></Field>
        <Field label="Category"><select className="input" value={filters.category} onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setPage(1); }}><option value="">All</option>{Object.entries(REPAIR_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Status"><select className="input" value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}><option value="">All</option><option value="pending">Pending</option><option value="completed">Completed</option></select></Field>
        {data && <span className="ml-auto text-sm text-ink-soft">{data.total} entries · <strong>{money(data.totals.total)}</strong></span>}
      </div>

      <div className="card overflow-hidden">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={8} cols={7} /> : data.items.length === 0 ? (
          <EmptyState icon={Wrench} title="No repair entries" action={<button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add repair entry</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas/60"><tr><th className="th">Date/time (IST)</th><th className="th">Vehicle</th><th className="th">Category</th><th className="th">Description</th><th className="th text-right">Total</th><th className="th">Status</th><th className="th text-right"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r._id} className="border-b border-line/60 hover:bg-canvas/50">
                    <td className="td whitespace-nowrap">{formatIST(r.repairedAt)}</td>
                    <td className="td font-medium">{r.vehicle?.registrationNumber}</td>
                    <td className="td">{REPAIR_CATEGORY_LABEL[r.category]}</td>
                    <td className="td max-w-[220px] truncate">{r.description}</td>
                    <td className="td text-right tabular-nums">{money(r.total)}</td>
                    <td className="td"><Badge tone={r.status === 'pending' ? 'warning' : 'success'}>{r.status}</Badge></td>
                    <td className="td text-right"><button className="rounded p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => setToDelete(r)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}

      <RepairEntryModal open={addOpen} vehicles={vehicles.data?.items || []} onClose={() => setAddOpen(false)} onSaved={reload} />
      <ConfirmDialog open={!!toDelete} title="Delete repair entry?" message="This cannot be undone." onConfirm={remove} onClose={() => setToDelete(null)} />
    </>
  );
}
