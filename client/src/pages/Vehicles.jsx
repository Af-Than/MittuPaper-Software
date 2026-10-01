import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useApi, useDebounced } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from '../components/ui';
import ConfirmDialog from '../components/ConfirmDialog';
import VehicleFormModal from '../components/VehicleFormModal';
import { daysUntilClient, money } from '../lib/format';
import { FUEL_TYPE_LABEL, VEHICLE_STATUS_LABEL, VEHICLE_TYPE_LABEL } from '../lib/expenseFormat';

const STATUS_TONE = { active: 'success', 'in-repair': 'warning', retired: 'neutral' };

function DocChip({ label, date }) {
  if (!date) return null;
  const days = daysUntilClient(date);
  const tone = days < 0 ? 'danger' : days <= 30 ? 'warning' : 'success';
  return <Badge tone={tone}>{label}: {days < 0 ? 'expired' : `${days}d`}</Badge>;
}

export default function Vehicles() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ open: false, vehicle: null });
  const [toDelete, setToDelete] = useState(null);
  const dq = useDebounced(q, 300);

  const { data, loading, error, reload } = useApi(() => api.vehicles({ q: dq, status: status || undefined, page, limit: 16 }), [dq, status, page]);

  const remove = async () => {
    try {
      await api.deleteVehicle(toDelete._id);
      toast.success(`${toDelete.registrationNumber} removed`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  return (
    <>
      <PageHeader title="Vehicles" subtitle="Fleet status, documents and running costs" actions={<button className="btn-primary" onClick={() => setForm({ open: true, vehicle: null })}><Plus className="h-4 w-4" /> Add vehicle</button>} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input className="input pl-9" type="search" placeholder="Search by registration" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
          {['', 'active', 'in-repair', 'retired'].map((s) => (
            <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${status === s ? 'bg-primary text-white' : 'text-ink-soft hover:bg-primary-50'}`}>{s ? VEHICLE_STATUS_LABEL[s] : 'All'}</button>
          ))}
        </div>
      </div>

      {error && <div className="card"><ErrorState message={error} onRetry={reload} /></div>}
      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card space-y-3 p-4"><Skeleton className="h-10" /><Skeleton className="h-8" /></div>)}</div>
      ) : data?.items.length === 0 ? (
        <div className="card"><EmptyState icon={Bike} title="No vehicles yet" message="Add a vehicle to track fuel, repairs and documents." action={<button className="btn-primary" onClick={() => setForm({ open: true, vehicle: null })}><Plus className="h-4 w-4" /> Add vehicle</button>} /></div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {data.items.map((v) => (
              <article key={v._id} className="card group relative flex flex-col p-4 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary" aria-hidden><Bike className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-ink"><Link to={`/expenses/vehicles/${v._id}`} className="after:absolute after:inset-0 after:content-['']">{v.registrationNumber}</Link></h3>
                    <p className="text-xs text-ink-muted">{v.makeModel || VEHICLE_TYPE_LABEL[v.type]} · {FUEL_TYPE_LABEL[v.fuelType]}</p>
                  </div>
                  <div className="relative z-10 flex gap-0.5">
                    <button onClick={() => setForm({ open: true, vehicle: v })} className="rounded-lg p-1.5 text-ink-muted hover:bg-primary-50 hover:text-primary" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setToDelete(v)} className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink-muted ml">{v.assignedEmployee?.name || 'Unassigned'} · {v.odometer} km</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={STATUS_TONE[v.status]}>{VEHICLE_STATUS_LABEL[v.status]}</Badge>
                  <DocChip label="Insurance" date={v.insuranceExpiry} />
                  <DocChip label="PUC" date={v.pollutionExpiry} />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                  <span className="text-ink-muted">This month</span>
                  <span className="font-semibold tabular-nums">{money(v.monthCost)}</span>
                </div>
              </article>
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </>
      ) : null}

      <VehicleFormModal open={form.open} vehicle={form.vehicle} onClose={() => setForm({ open: false, vehicle: null })} onSaved={reload} />
      <ConfirmDialog open={!!toDelete} title="Remove vehicle?" message={<>Remove <strong>{toDelete?.registrationNumber}</strong>? Its fuel and repair history is kept.</>} confirmLabel="Remove" onConfirm={remove} onClose={() => setToDelete(null)} />
    </>
  );
}
