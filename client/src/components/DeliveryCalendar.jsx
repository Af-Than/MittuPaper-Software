import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Minus, Plus, Trash2 } from 'lucide-react';
import Modal from './Modal';
import { Badge, Field, shiftMonth, Skeleton } from './ui';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { WEEKDAYS, WEEKDAYS_LONG, currentYearMonth, dateKey, formatDate, money, monthLabel } from '../lib/format';

/**
 * Month calendar for one customer. Shows delivered copies per day and lets the admin click a
 * day to mark skipped / extra deliveries (the customer's purchasing history).
 */
export default function DeliveryCalendar({ customerId, onChanged }) {
  const toast = useToast();
  const [ym, setYm] = useState(currentYearMonth());
  const [selected, setSelected] = useState(null); // date key
  const [form, setForm] = useState({ type: 'skipped', publication: '', quantity: 1, note: '' });
  const [busy, setBusy] = useState(false);

  const { data, loading, reload } = useApi(
    async () => {
      const [view, adjustments] = await Promise.all([
        api.billView({ customer: customerId, ...ym }),
        api.adjustments({ customer: customerId, ...ym }),
      ]);
      return { view, adjustments };
    },
    [customerId, ym.year, ym.month]
  );

  const days = data?.view.computed.days || [];
  const adjByDate = {};
  (data?.adjustments || []).forEach((a) => {
    const k = a.date.slice(0, 10);
    (adjByDate[k] = adjByDate[k] || []).push(a);
  });
  const firstWeekday = new Date(Date.UTC(ym.year, ym.month - 1, 1)).getUTCDay();
  const today = dateKey(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());

  // publications the customer is billed for this month (for the adjustment picker)
  const pubOptions = (data?.view.computed.lineItems || []).map((l) => ({ id: l.publicationId, name: l.publicationName }));

  const selDay = selected ? days.find((d) => d.date === selected) : null;
  const selAdjs = selected ? adjByDate[selected] || [] : [];

  const openDay = (key) => {
    setSelected(key);
    setForm({ type: 'skipped', publication: '', quantity: 1, note: '' });
  };

  const save = async (e) => {
    e.preventDefault();
    if (form.type === 'extra' && !form.publication) return toast.error('Choose which publication gets the extra copy');
    setBusy(true);
    try {
      await api.createAdjustment({
        customer: customerId,
        date: selected,
        type: form.type,
        publication: form.publication || null,
        quantity: Number(form.quantity) || 1,
        note: form.note,
      });
      toast.success(form.type === 'skipped' ? 'Delivery marked as skipped' : 'Extra copy added');
      await reload();
      onChanged?.();
      setForm((f) => ({ ...f, note: '' }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeAdj = async (id) => {
    try {
      await api.deleteAdjustment(id);
      toast.success('Adjustment removed');
      await reload();
      onChanged?.();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <section className="card p-5" aria-label="Delivery calendar">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Delivery calendar &amp; purchasing history</h2>
          <p className="text-xs text-ink-muted">Click a day to mark a skipped delivery (holiday) or an extra copy.</p>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-secondary btn-sm" onClick={() => setYm(shiftMonth(ym, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-ink" aria-live="polite">{monthLabel(ym.year, ym.month)}</span>
          <button className="btn-secondary btn-sm" onClick={() => setYm(shiftMonth(ym, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {data?.view.stale && (
        <div className="mb-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning" role="status">
          The saved bill for this month is out of date. <Link className="font-semibold underline" to={`/billing/customer?customer=${customerId}&year=${ym.year}&month=${ym.month}`}>Open the bill to refresh it</Link>.
        </div>
      )}

      {loading && !data ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted" aria-hidden>
            {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`b${i}`} />)}
            {days.map((d) => {
              const adjs = adjByDate[d.date] || [];
              const skipped = adjs.filter((a) => a.type === 'skipped').length;
              const extra = adjs.filter((a) => a.type === 'extra').reduce((n, a) => n + a.quantity, 0);
              const dayNum = Number(d.date.slice(8));
              return (
                <button
                  key={d.date}
                  onClick={() => openDay(d.date)}
                  className={`flex min-h-[64px] flex-col items-start rounded-lg border p-1.5 text-left transition hover:border-primary hover:bg-primary-50 sm:min-h-[74px] sm:p-2 ${
                    skipped ? 'border-danger/30 bg-danger-soft/50' : extra ? 'border-success/30 bg-success-soft/50' : 'border-line bg-surface'
                  } ${d.date === today ? 'ring-2 ring-primary-500' : ''}`}
                  aria-label={`${WEEKDAYS_LONG[d.weekday]} ${formatDate(d.date)}: ${d.copies} ${d.copies === 1 ? 'copy' : 'copies'}${skipped ? ', skipped' : ''}${extra ? `, ${extra} extra` : ''}`}
                >
                  <span className={`text-xs font-semibold ${d.weekday === 0 ? 'text-danger' : 'text-ink'}`}>{dayNum}</span>
                  <span className="mt-auto flex flex-wrap gap-0.5 text-[10px] leading-tight">
                    {d.copies > 0 && <span className="rounded bg-primary-50 px-1 font-medium text-primary">{d.copies}</span>}
                    {skipped > 0 && <span className="flex items-center rounded bg-danger-soft px-1 font-medium text-danger"><Minus className="h-2.5 w-2.5" aria-hidden />skip</span>}
                    {extra > 0 && <span className="flex items-center rounded bg-success-soft px-1 font-medium text-success"><Plus className="h-2.5 w-2.5" aria-hidden />{extra}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm">
            <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
              <span className="flex items-center gap-1"><span className="rounded bg-primary-50 px-1 font-medium text-primary">2</span> copies delivered</span>
              <span className="flex items-center gap-1"><span className="rounded bg-danger-soft px-1 font-medium text-danger">skip</span> held</span>
              <span className="flex items-center gap-1"><span className="rounded bg-success-soft px-1 font-medium text-success">+1</span> extra</span>
            </div>
            <div className="text-ink-soft">
              {data?.view.computed.days.reduce((n, d) => n + d.copies, 0)} copies · <strong className="text-ink">{money(data?.view.computed.currentCharges)}</strong> this month
            </div>
          </div>
        </>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${WEEKDAYS_LONG[selDay?.weekday ?? 0]}, ${formatDate(selected)}` : ''}
        description={selDay ? (selDay.items.length ? `Scheduled: ${selDay.items.map((i) => `${i.publicationName} ×${i.copies}`).join(', ')}` : 'No delivery scheduled on this day.') : ''}
        footer={<button className="btn-secondary" onClick={() => setSelected(null)}>Done</button>}
      >
        {selAdjs.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Recorded for this day</h3>
            <ul className="space-y-2">
              {selAdjs.map((a) => (
                <li key={a._id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                  <Badge tone={a.type === 'skipped' ? 'danger' : 'success'}>{a.type === 'skipped' ? 'Skipped' : `Extra ×${a.quantity}`}</Badge>
                  <span className="min-w-0 flex-1 truncate text-sm ml">{a.publication?.name || 'All publications'}{a.note ? ` · ${a.note}` : ''}</span>
                  <button onClick={() => removeAdj(a._id)} className="rounded p-1 text-ink-muted hover:bg-danger-soft hover:text-danger" aria-label="Remove this adjustment"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={save} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Add an adjustment</h3>
          <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Adjustment type">
            {[['skipped', 'Skip delivery'], ['extra', 'Extra copy']].map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={form.type === k} onClick={() => setForm({ ...form, type: k, publication: k === 'extra' && !form.publication ? pubOptions[0]?.id || '' : form.publication })} className={`rounded-md px-3 py-1.5 text-sm font-medium ${form.type === k ? 'bg-primary text-white' : 'text-ink-soft'}`}>{label}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
            <Field label="Publication">
              <select className="input ml" value={form.publication} onChange={(e) => setForm({ ...form, publication: e.target.value })}>
                {form.type === 'skipped' && <option value="">All publications (holiday hold)</option>}
                {form.type === 'extra' && !form.publication && <option value="">Choose…</option>}
                {pubOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Copies">
              <input className="input" type="number" min={1} max={20} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
          </div>
          <Field label="Note" hint={form.type === 'skipped' ? '"All publications" pauses newspapers and weekly deliveries; name a magazine to skip it.' : undefined}>
            <input className="input ml" value={form.note} maxLength={200} placeholder="e.g. Family trip, guests staying" onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <button type="submit" className="btn-primary" disabled={busy || pubOptions.length === 0}>{busy ? 'Saving…' : form.type === 'skipped' ? 'Mark as skipped' : 'Add extra copy'}</button>
          {pubOptions.length === 0 && <p className="text-xs text-ink-muted">This customer has no subscription running this month.</p>}
        </form>
      </Modal>
    </section>
  );
}
