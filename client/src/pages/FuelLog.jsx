import { useState } from 'react';
import { Download, Fuel, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { download, errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { EmptyState, ErrorState, Field, PageHeader, Pagination, TableSkeleton } from '../components/ui';
import ConfirmDialog from '../components/ConfirmDialog';
import FuelEntryModal from '../components/FuelEntryModal';
import { formatIST, money } from '../lib/format';

export default function FuelLog() {
  const toast = useToast();
  const [filters, setFilters] = useState({ vehicle: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [exporting, setExporting] = useState(false);

  const vehicles = useApi(() => api.vehicles({ limit: 200 }), []);
  const { data, loading, error, reload } = useApi(() => api.fuelEntries({ ...filters, vehicle: filters.vehicle || undefined, from: filters.from || undefined, to: filters.to || undefined, page, limit: 25 }), [filters, page]);

  const remove = async () => {
    try {
      await api.deleteFuelEntry(toDelete._id);
      toast.success('Fuel entry removed');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  const exportXlsx = async () => {
    setExporting(true);
    try {
      await download('/export/fuel', { vehicle: filters.vehicle || undefined, from: filters.from || undefined, to: filters.to || undefined }, 'fuel-log.xlsx');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader title="Fuel Log" subtitle="Every fuel fill-up, by vehicle" actions={<><button className="btn-secondary" onClick={exportXlsx} disabled={exporting}><Download className="h-4 w-4" /> Excel</button><button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add fuel entry</button></>} />

      <div className="card mb-5 flex flex-wrap items-end gap-4 p-4">
        <Field label="Vehicle" className="min-w-[180px]"><select className="input" value={filters.vehicle} onChange={(e) => { setFilters({ ...filters, vehicle: e.target.value }); setPage(1); }}><option value="">All vehicles</option>{(vehicles.data?.items || []).map((v) => <option key={v._id} value={v._id}>{v.registrationNumber}</option>)}</select></Field>
        <Field label="From"><input className="input" type="date" value={filters.from} onChange={(e) => { setFilters({ ...filters, from: e.target.value }); setPage(1); }} /></Field>
        <Field label="To"><input className="input" type="date" value={filters.to} onChange={(e) => { setFilters({ ...filters, to: e.target.value }); setPage(1); }} /></Field>
        {data && <span className="ml-auto text-sm text-ink-soft">{data.total} entries · {data.totals.litres.toFixed(1)}L · <strong>{money(data.totals.amount)}</strong></span>}
      </div>

      <div className="card overflow-hidden">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={8} cols={7} /> : data.items.length === 0 ? (
          <EmptyState icon={Fuel} title="No fuel entries" action={<button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add fuel entry</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas/60"><tr><th className="th">Date/time (IST)</th><th className="th">Vehicle</th><th className="th">Employee</th><th className="th text-right">Litres</th><th className="th text-right">Amount</th><th className="th text-right">Odometer</th><th className="th text-right"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.items.map((f) => (
                  <tr key={f._id} className="border-b border-line/60 hover:bg-canvas/50">
                    <td className="td whitespace-nowrap">{formatIST(f.fuelledAt)}</td>
                    <td className="td font-medium">{f.vehicle?.registrationNumber}</td>
                    <td className="td ml">{f.employee?.name || '—'}</td>
                    <td className="td text-right tabular-nums">{f.litres}{f.fullTank ? '' : ' (partial)'}</td>
                    <td className="td text-right tabular-nums">{money(f.amount)}</td>
                    <td className="td text-right tabular-nums">{f.odometer}</td>
                    <td className="td text-right"><button className="rounded p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => setToDelete(f)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}

      <FuelEntryModal open={addOpen} vehicles={vehicles.data?.items || []} onClose={() => setAddOpen(false)} onSaved={reload} />
      <ConfirmDialog open={!!toDelete} title="Delete fuel entry?" message="This cannot be undone." onConfirm={remove} onClose={() => setToDelete(null)} />
    </>
  );
}
