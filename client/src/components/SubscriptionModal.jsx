import { useEffect, useState } from 'react';
import Modal from './Modal';
import { Field } from './ui';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { WEEKDAYS, dateInput, todayKey } from '../lib/format';

const ALL = [0, 1, 2, 3, 4, 5, 6];
const MON_FRI = [1, 2, 3, 4, 5];
const sameSet = (a, b) => a.length === b.length && b.every((d) => a.includes(d));

/** Add / edit a customer's subscription to a publication. */
export default function SubscriptionModal({ open, customerId, subscription, publications = [], onClose, onSaved }) {
  const toast = useToast();
  const editing = !!subscription;
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (subscription) {
      setForm({
        publication: subscription.publication._id,
        mode: subscription.mode,
        weekdays: subscription.weekdays,
        copiesPerMonth: subscription.copiesPerMonth || 1,
        quantity: subscription.quantity || 1,
        startDate: dateInput(subscription.startDate),
        endDate: dateInput(subscription.endDate),
      });
    } else {
      setForm({ publication: '', mode: 'weekdays', weekdays: ALL, copiesPerMonth: 1, quantity: 1, startDate: todayKey(), endDate: '' });
    }
  }, [open, subscription]);

  if (!form) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const pub = publications.find((p) => p._id === form.publication) || (editing ? subscription.publication : null);

  // Sensible defaults when a publication is picked
  const choosePublication = (id) => {
    const p = publications.find((x) => x._id === id);
    if (!p) return set({ publication: id });
    if (p.frequency === 'daily') set({ publication: id, mode: 'weekdays', weekdays: ALL });
    else if (p.frequency === 'weekly') set({ publication: id, mode: 'weekdays', weekdays: [4] });
    else set({ publication: id, mode: 'fixedPerMonth', copiesPerMonth: p.frequency === 'fortnightly' ? 2 : 1 });
  };

  const toggleDay = (d) =>
    set({ weekdays: form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d].sort() });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.publication) errs.publication = 'Choose a publication';
    if (!form.startDate) errs.startDate = 'Start date is required';
    if (form.endDate && form.endDate < form.startDate) errs.endDate = 'End date cannot be before the start date';
    if (form.mode === 'weekdays' && form.weekdays.length === 0) errs.weekdays = 'Choose at least one delivery day';
    if (form.mode === 'fixedPerMonth' && !(Number(form.copiesPerMonth) >= 1)) errs.copiesPerMonth = 'Enter at least 1 copy';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const body = {
        customer: customerId,
        publication: form.publication,
        mode: form.mode,
        weekdays: form.mode === 'weekdays' ? form.weekdays : [],
        copiesPerMonth: form.mode === 'fixedPerMonth' ? Number(form.copiesPerMonth) : 0,
        quantity: Number(form.quantity) || 1,
        startDate: form.startDate,
        endDate: form.endDate || null,
      };
      if (editing) await api.updateSubscription(subscription._id, body);
      else await api.createSubscription(body);
      toast.success(editing ? 'Subscription updated' : 'Subscription added');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const chip = (active) =>
    `rounded-lg border px-3 py-1.5 text-sm font-medium transition ${active ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-soft hover:border-primary-200 hover:bg-primary-50'}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit subscription' : 'Add subscription'}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="sub-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add subscription'}</button>
        </>
      }
    >
      <form id="sub-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Publication" required error={errors.publication}>
          {editing ? (
            <input className="input ml" value={subscription.publication.name} disabled readOnly />
          ) : (
            <select className="input ml" value={form.publication} onChange={(e) => choosePublication(e.target.value)}>
              <option value="">Select a newspaper or magazine…</option>
              <optgroup label="Newspapers">{publications.filter((p) => p.type === 'newspaper').map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</optgroup>
              <optgroup label="Magazines">{publications.filter((p) => p.type === 'magazine').map((p) => <option key={p._id} value={p._id}>{p.name} ({p.frequency})</option>)}</optgroup>
            </select>
          )}
        </Field>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink">Delivery pattern</legend>
          <div className="mb-3 inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Delivery pattern">
            {[['weekdays', 'On selected weekdays'], ['fixedPerMonth', 'Fixed copies per month']].map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={form.mode === k} onClick={() => set({ mode: k })} className={`rounded-md px-3 py-1.5 text-sm font-medium ${form.mode === k ? 'bg-primary text-white' : 'text-ink-soft'}`}>{label}</button>
            ))}
          </div>

          {form.mode === 'weekdays' ? (
            <div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => set({ weekdays: ALL })} className={chip(sameSet(form.weekdays, ALL))} aria-pressed={sameSet(form.weekdays, ALL)}>Daily</button>
                <button type="button" onClick={() => set({ weekdays: MON_FRI })} className={chip(sameSet(form.weekdays, MON_FRI))} aria-pressed={sameSet(form.weekdays, MON_FRI)}>Mon–Fri</button>
                <span className="mx-1 hidden w-px self-stretch bg-line sm:block" aria-hidden />
                {/* Monday-first display */}
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <button key={d} type="button" onClick={() => toggleDay(d)} aria-pressed={form.weekdays.includes(d)} className={chip(form.weekdays.includes(d))}>{WEEKDAYS[d]}</button>
                ))}
              </div>
              {errors.weekdays && <p className="mt-1 text-xs text-danger" role="alert">{errors.weekdays}</p>}
              <p className="mt-2 text-xs text-ink-muted">{form.weekdays.length} delivery day{form.weekdays.length === 1 ? '' : 's'} per week{sameSet(form.weekdays, ALL) ? ' (daily)' : ''}.</p>
              <Field label="Copies per delivery" className="mt-3 max-w-[160px]">
                <input className="input" type="number" min={1} max={20} value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} />
              </Field>
            </div>
          ) : (
            <Field label="Copies per month" error={errors.copiesPerMonth} hint={pub?.frequency === 'fortnightly' ? 'A fortnightly magazine usually has 2 copies a month.' : 'Billed once a month, on the first active day.'} className="max-w-[200px]">
              <input className="input" type="number" min={1} max={60} value={form.copiesPerMonth} onChange={(e) => set({ copiesPerMonth: e.target.value })} />
            </Field>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" required error={errors.startDate}>
            <input className="input" type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </Field>
          <Field label="End date" error={errors.endDate} hint="Leave empty if ongoing">
            <input className="input" type="date" value={form.endDate} min={form.startDate} onChange={(e) => set({ endDate: e.target.value })} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
