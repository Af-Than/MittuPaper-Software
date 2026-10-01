import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, HandCoins, MapPin, Pencil, Phone, Plus, StickyNote, Trash2, FileText, Repeat } from 'lucide-react';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { useCrumb } from '../components/AppLayout';
import { Badge, DueBadge, EmptyState, ErrorState, Skeleton, StatusBadge, TableSkeleton } from '../components/ui';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomerFormModal from '../components/CustomerFormModal';
import SubscriptionModal from '../components/SubscriptionModal';
import DeliveryCalendar from '../components/DeliveryCalendar';
import PaymentModal from '../components/PaymentModal';
import ReminderButton from '../components/ReminderButton';
import { describeWeekdays, formatDate, initials, money, monthLabel } from '../lib/format';

const MODE_LABEL = { cash: 'Cash', upi: 'UPI', other: 'Other' };

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: customer, loading, error, reload } = useApi(() => api.customer(id), [id]);
  const { data: pubs } = useApi(() => api.publications(), []);
  const bills = useApi(() => api.bills({ customer: id, limit: 36 }), [id]);
  const payments = useApi(() => api.payments({ customer: id, limit: 50 }), [id]);

  const [editing, setEditing] = useState(false);
  const [subModal, setSubModal] = useState({ open: false, sub: null });
  const [subToDelete, setSubToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  useCrumb(customer?.name);

  const refreshAll = () => { reload(); bills.reload(); payments.reload(); };

  const deleteSub = async () => {
    try {
      await api.deleteSubscription(subToDelete._id);
      toast.success('Subscription removed');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  const deleteCustomer = async () => {
    try {
      await api.deleteCustomer(id);
      toast.success('Customer deleted');
      navigate('/customers', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  if (loading && !customer) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /><Skeleton className="h-72 w-full" /></div>;
  }
  if (!customer) return null;

  const activeSubs = customer.subscriptions;
  const availablePubs = (pubs || []).filter((p) => p.active);

  return (
    <div className="space-y-6">
      {/* Profile */}
      <section className="card p-5" aria-label="Customer profile">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-700 to-primary-500 text-xl font-semibold text-white" aria-hidden>{initials(customer.name)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-ink ml">{customer.name}</h1>
              {!customer.active && <Badge>Inactive</Badge>}
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft"><Phone className="h-4 w-4 text-ink-muted" aria-hidden />{customer.phone}</p>
            <p className="mt-1 flex items-start gap-2 text-sm text-ink-soft ml"><MapPin className="mt-1 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />{customer.address}</p>
            {customer.notes && <p className="mt-1 flex items-start gap-2 text-sm text-ink-muted ml"><StickyNote className="mt-1 h-4 w-4 shrink-0" aria-hidden />{customer.notes}</p>}
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <div className="mb-1 text-xs uppercase tracking-wide text-ink-muted">Current due</div>
              <DueBadge months={customer.dueMonths} due={customer.due} size="lg" />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {customer.due > 0 && <button className="btn-primary btn-sm" onClick={() => setPayOpen(true)}><HandCoins className="h-3.5 w-3.5" /> Record payment</button>}
              <Link className="btn-secondary btn-sm" to={`/billing/customer?customer=${id}`}><FileText className="h-3.5 w-3.5" /> View bill</Link>
              <button className="btn-secondary btn-sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
              <button className="btn-secondary btn-sm text-danger hover:bg-danger-soft" onClick={() => setDeleting(true)}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            </div>
          </div>
        </div>
        {customer.dueMonths?.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-muted">Dues timeline:</span>
              {customer.dueMonths.map((m) => (
                <Badge key={m.billId} tone={m.ageInMonths >= 2 ? 'danger' : 'warning'}>{monthLabel(m.year, m.month)} · {money(m.pending)}</Badge>
              ))}
            </div>
            <ReminderButton customerName={customer.name} phone={customer.phone} months={customer.dueMonths} totalDue={customer.due} />
          </div>
        )}
      </section>

      {/* Subscriptions */}
      <section className="card" aria-label="Subscriptions">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Subscriptions</h2>
            <p className="text-xs text-ink-muted">Which publications are delivered, and on which days</p>
          </div>
          <button className="btn-primary btn-sm" onClick={() => setSubModal({ open: true, sub: null })}><Plus className="h-4 w-4" /> Add publication</button>
        </div>
        {activeSubs.length === 0 ? (
          <EmptyState icon={Repeat} title="No subscriptions yet" message="Add a newspaper or magazine to start billing this customer." action={<button className="btn-primary btn-sm" onClick={() => setSubModal({ open: true, sub: null })}><Plus className="h-4 w-4" /> Add publication</button>} />
        ) : (
          <ul className="divide-y divide-line">
            {activeSubs.map((s) => {
              const ended = s.endDate && s.endDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
              return (
                <li key={s._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-[200px] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink ml">{s.publication.name}</span>
                      <Badge tone={s.publication.type === 'magazine' ? 'warning' : 'primary'}>{s.publication.type}</Badge>
                      {ended && <Badge>Ended</Badge>}
                    </div>
                    <p className="text-xs text-ink-muted">
                      From {formatDate(s.startDate)}{s.endDate ? ` to ${formatDate(s.endDate)}` : ' · ongoing'}
                    </p>
                  </div>
                  <div className="text-sm text-ink-soft">
                    {s.mode === 'weekdays' ? (
                      <span className="flex items-center gap-2">
                        <Badge tone="primary">{describeWeekdays(s.weekdays)}</Badge>
                        <span className="text-xs text-ink-muted">{s.weekdays.length}×/week{s.quantity > 1 ? ` · ${s.quantity} copies each` : ''}</span>
                      </span>
                    ) : (
                      <Badge tone="warning">{s.copiesPerMonth} {s.copiesPerMonth === 1 ? 'copy' : 'copies'} / month</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button className="rounded-lg p-2 text-ink-muted hover:bg-primary-50 hover:text-primary" onClick={() => setSubModal({ open: true, sub: s })} aria-label={`Edit ${s.publication.name} subscription`}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-2 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => setSubToDelete(s)} aria-label={`Remove ${s.publication.name} subscription`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <DeliveryCalendar customerId={id} onChanged={bills.reload} />

      {/* Bills + payments */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card" aria-label="Bill history">
          <div className="border-b border-line px-5 py-4"><h2 className="text-base font-semibold text-ink">Bills</h2></div>
          {bills.loading && !bills.data ? <TableSkeleton rows={4} cols={4} /> : !bills.data?.items.length ? (
            <EmptyState icon={FileText} title="No bills yet" message="Bills appear here once they are generated." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line"><th className="th">Month</th><th className="th text-right">Total</th><th className="th text-right">Balance</th><th className="th">Status</th><th className="th"><span className="sr-only">Open</span></th></tr></thead>
                <tbody>
                  {bills.data.items.map((b) => (
                    <tr key={b._id} className="border-b border-line/60 last:border-0 hover:bg-canvas/60">
                      <td className="td font-medium">{monthLabel(b.year, b.month)}</td>
                      <td className="td text-right tabular-nums">{money(b.totalPayable)}</td>
                      <td className="td text-right tabular-nums">{money(b.balance)}</td>
                      <td className="td"><StatusBadge status={b.status} /></td>
                      <td className="td"><Link className="text-primary hover:text-primary-800" to={`/billing/customer?customer=${id}&year=${b.year}&month=${b.month}`} aria-label={`Open ${monthLabel(b.year, b.month)} bill`}><ExternalLink className="h-4 w-4" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card" aria-label="Payment history">
          <div className="border-b border-line px-5 py-4"><h2 className="text-base font-semibold text-ink">Payments</h2></div>
          {payments.loading && !payments.data ? <TableSkeleton rows={4} cols={4} /> : !payments.data?.items.length ? (
            <EmptyState title="No payments yet" message="Recorded payments will be listed here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line"><th className="th">Date</th><th className="th">Against</th><th className="th text-right">Amount</th><th className="th">Mode</th></tr></thead>
                <tbody>
                  {payments.data.items.map((p) => (
                    <tr key={p._id} className="border-b border-line/60 last:border-0">
                      <td className="td whitespace-nowrap">{formatDate(p.date)}</td>
                      <td className="td">
                        {p.bill ? monthLabel(p.bill.year, p.bill.month) : '—'}
                        {p.allocations?.length > 1 && <span className="text-xs text-ink-muted"> +{p.allocations.length - 1} more</span>}
                      </td>
                      <td className="td text-right font-medium tabular-nums text-success">{money(p.amount)}</td>
                      <td className="td"><Badge>{MODE_LABEL[p.mode]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <CustomerFormModal open={editing} customer={customer} onClose={() => setEditing(false)} onSaved={reload} />
      <SubscriptionModal open={subModal.open} customerId={id} subscription={subModal.sub} publications={availablePubs} onClose={() => setSubModal({ open: false, sub: null })} onSaved={refreshAll} />
      <ConfirmDialog open={!!subToDelete} title="Remove subscription?" message={<>Stop delivering <strong className="text-ink ml">{subToDelete?.publication.name}</strong> to this customer? Bills already generated are not changed, but refreshing them will exclude this subscription. To keep past billing intact, edit the subscription and set an end date instead.</>} confirmLabel="Remove" onConfirm={deleteSub} onClose={() => setSubToDelete(null)} />
      <ConfirmDialog open={deleting} title="Delete customer?" message={<>This permanently deletes <strong className="text-ink ml">{customer.name}</strong> with all subscriptions, delivery history, bills and payments.</>} confirmLabel="Delete customer" onConfirm={deleteCustomer} onClose={() => setDeleting(false)} />
      <PaymentModal open={payOpen} customerId={id} customerName={customer.name} onClose={() => setPayOpen(false)} onSaved={refreshAll} />
    </div>
  );
}
