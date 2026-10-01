import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, Phone, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useApi, useDebounced } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from '../components/ui';
import ConfirmDialog from '../components/ConfirmDialog';
import EmployeeFormModal from '../components/EmployeeFormModal';
import { initials, money } from '../lib/format';
import { ROLE_LABEL, salaryStatusMeta } from '../lib/expenseFormat';

export default function Employees() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ open: false, employee: null });
  const [toDelete, setToDelete] = useState(null);
  const dq = useDebounced(q, 300);

  const { data, loading, error, reload } = useApi(() => api.employees({ q: dq, page, limit: 12 }), [dq, page]);

  const remove = async () => {
    try {
      await api.deleteEmployee(toDelete._id);
      toast.success(`${toDelete.name} removed`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  return (
    <>
      <PageHeader title="Employees" subtitle="Delivery staff and their assigned vehicles" actions={<button className="btn-primary" onClick={() => setForm({ open: true, employee: null })}><Plus className="h-4 w-4" /> Add employee</button>} />

      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input className="input pl-9" type="search" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <div className="card"><ErrorState message={error} onRetry={reload} /></div>}
      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card space-y-3 p-4"><Skeleton className="h-11 w-3/4" /><Skeleton className="h-10" /></div>)}</div>
      ) : data?.items.length === 0 ? (
        <div className="card"><EmptyState icon={Users} title="No employees yet" message="Add delivery staff to assign vehicles and track salaries." action={<button className="btn-primary" onClick={() => setForm({ open: true, employee: null })}><Plus className="h-4 w-4" /> Add employee</button>} /></div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((e) => {
              const st = salaryStatusMeta(e.salaryStatus.status);
              return (
                <article key={e._id} className="card group relative flex flex-col p-4 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-700 to-primary-500 text-sm font-semibold text-white" aria-hidden>{initials(e.name)}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-ink ml"><Link to={`/expenses/employees/${e._id}`} className="after:absolute after:inset-0 after:content-['']">{e.name}</Link></h3>
                      <p className="flex items-center gap-1.5 text-xs text-ink-muted"><Phone className="h-3 w-3" />{e.phone}</p>
                    </div>
                    <div className="relative z-10 flex gap-0.5">
                      <button onClick={() => setForm({ open: true, employee: e })} className="rounded-lg p-1.5 text-ink-muted hover:bg-primary-50 hover:text-primary" aria-label={`Edit ${e.name}`}><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setToDelete(e)} className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger" aria-label={`Remove ${e.name}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="primary">{ROLE_LABEL[e.role]}</Badge>
                    <Badge><Bike className="h-3 w-3" /> {e.vehicleCount} vehicle{e.vehicleCount === 1 ? '' : 's'}</Badge>
                    {!e.active && <Badge>Inactive</Badge>}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="text-ink-muted">Salary ({ROLE_LABEL[e.role]})</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                    <span>This month — fuel {money(e.monthCost.fuel)}, repairs {money(e.monthCost.repairs)}</span>
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </>
      ) : null}

      <EmployeeFormModal open={form.open} employee={form.employee} onClose={() => setForm({ open: false, employee: null })} onSaved={reload} />
      <ConfirmDialog open={!!toDelete} title="Remove employee?" message={<>Remove <strong className="ml">{toDelete?.name}</strong>? Their fuel, repair and salary history is kept, but vehicles will show as unassigned.</>} confirmLabel="Remove" onConfirm={remove} onClose={() => setToDelete(null)} />
    </>
  );
}
