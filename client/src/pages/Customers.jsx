import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Pencil, Phone, Plus, Search, Trash2, Users } from 'lucide-react';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useApi, useDebounced } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { Badge, DueBadge, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from '../components/ui';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomerFormModal from '../components/CustomerFormModal';
import { initials } from '../lib/format';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'dues', label: 'With dues' },
  { key: 'overdue', label: '2+ months overdue' },
  { key: 'inactive', label: 'Inactive' },
];

function CustomerCard({ c, onEdit, onDelete }) {
  const shown = c.subscriptions.slice(0, 3);
  const more = c.subscriptions.length - shown.length;
  return (
    <article className="card group relative flex flex-col p-4 transition-colors hover:border-primary-200">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary" aria-hidden>{initials(c.name)}</span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-ink ml">
            {/* stretched link: the whole card opens the detail page */}
            <Link to={`/customers/${c._id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">{c.name}</Link>
          </h3>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted"><Phone className="h-3 w-3" aria-hidden />{c.phone}</p>
        </div>
        <div className="relative z-10 flex gap-0.5 opacity-100 sm:opacity-0 sm:transition sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <button onClick={() => onEdit(c)} className="rounded-lg p-1.5 text-ink-muted hover:bg-primary-50 hover:text-primary" aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></button>
          <button onClick={() => onDelete(c)} className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger" aria-label={`Delete ${c.name}`}><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <p className="mt-3 flex gap-1.5 text-sm text-ink-soft ml"><MapPin className="mt-1 h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden /><span className="line-clamp-2">{c.address}</span></p>

      <div className="mt-3 flex min-h-[26px] flex-wrap gap-1.5">
        {shown.map((s) => <Badge key={s.id} tone={s.type === 'magazine' ? 'warning' : 'primary'} className="ml">{s.name}</Badge>)}
        {more > 0 && <Badge>+{more} more</Badge>}
        {!c.subscriptions.length && <span className="text-xs text-ink-muted">No active subscriptions</span>}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        {!c.active && <Badge>Inactive</Badge>}
        <DueBadge months={c.dueMonths} due={c.due} />
      </div>
    </article>
  );
}

export default function Customers() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(params.get('filter') || 'all');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ open: false, customer: null });
  const [toDelete, setToDelete] = useState(null);
  const dq = useDebounced(q, 300);

  useEffect(() => { setPage(1); }, [dq, filter]);

  // ?new=1 opens the add dialog (used by the dashboard quick action)
  useEffect(() => {
    if (params.get('new')) {
      setForm({ open: true, customer: null });
      params.delete('new');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, loading, error, reload } = useApi(() => api.customers({ q: dq, filter, page, limit: 12 }), [dq, filter, page]);

  const remove = async () => {
    try {
      await api.deleteCustomer(toDelete._id);
      toast.success(`${toDelete.name} deleted`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Everyone you deliver to, at a glance"
        actions={<button className="btn-primary" onClick={() => setForm({ open: true, customer: null })}><Plus className="h-4 w-4" aria-hidden /> Add customer</button>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input className="input pl-9" type="search" placeholder="Search by name, phone or address" aria-label="Search customers" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1" role="group" aria-label="Filter customers">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${filter === f.key ? 'bg-primary-50 text-primary' : 'text-ink-soft hover:bg-canvas'}`}>{f.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="card"><ErrorState message={error} onRetry={reload} /></div>}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="card space-y-3 p-4"><Skeleton className="h-11 w-3/4" /><Skeleton className="h-10" /><Skeleton className="h-6 w-2/3" /></div>)}
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={q || filter !== 'all' ? 'No customers match' : 'No customers yet'}
            message={q || filter !== 'all' ? 'Try a different search or filter.' : 'Add your first customer to start tracking deliveries and billing.'}
            action={!q && filter === 'all' && <button className="btn-primary" onClick={() => setForm({ open: true, customer: null })}><Plus className="h-4 w-4" /> Add customer</button>}
          />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {data.items.map((c) => <CustomerCard key={c._id} c={c} onEdit={(cust) => setForm({ open: true, customer: cust })} onDelete={setToDelete} />)}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </>
      ) : null}

      <CustomerFormModal open={form.open} customer={form.customer} onClose={() => setForm({ open: false, customer: null })} onSaved={reload} />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete customer?"
        message={<><p><strong className="text-ink ml">{toDelete?.name}</strong> and all of their subscriptions, delivery history, bills and payments will be permanently removed.</p><p className="mt-2">If you only want to stop billing them, mark the customer as inactive instead.</p></>}
        confirmLabel="Delete customer"
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
