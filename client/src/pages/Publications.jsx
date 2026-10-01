import { Fragment, useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, History, IndianRupee, Newspaper, Pencil, Plus, Power } from 'lucide-react';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Badge, EmptyState, ErrorState, Field, PageHeader, Tabs, TableSkeleton } from '../components/ui';
import { dateInput, formatDate, money, paiseToRupeeInput, rupeesToPaise, todayKey } from '../lib/format';

const FREQ = { daily: 'Daily', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' };

/* ---------- Add / edit publication ---------- */
function PublicationModal({ open, publication, defaultType, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!publication;
  const [f, setF] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF(editing
      ? { name: publication.name, type: publication.type, language: publication.language, frequency: publication.frequency }
      : { name: '', type: defaultType, language: 'Malayalam', frequency: defaultType === 'magazine' ? 'monthly' : 'daily', rate: '', effectiveFrom: todayKey() });
  }, [open, publication, defaultType, editing]);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!f.name?.trim()) errs.name = 'Name is required';
    if (!f.language?.trim()) errs.language = 'Language is required';
    let paise = null;
    if (!editing) {
      paise = rupeesToPaise(f.rate);
      if (paise === null || f.rate === '') errs.rate = 'Enter the rate per copy';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const base = { name: f.name.trim(), type: f.type, language: f.language.trim(), frequency: f.frequency };
      if (editing) await api.updatePublication(publication._id, base);
      else await api.createPublication({ ...base, initialRate: paise, effectiveFrom: f.effectiveFrom });
      toast.success(editing ? 'Publication updated' : `${base.name} added`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit publication' : 'Add publication'}
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="pub-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <form id="pub-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Name" required error={errors.name}><input className="input ml" value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type"><select className="input" value={f.type || 'newspaper'} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="newspaper">Newspaper</option><option value="magazine">Magazine</option></select></Field>
          <Field label="Language" required error={errors.language}><input className="input" value={f.language || ''} onChange={(e) => setF({ ...f, language: e.target.value })} /></Field>
          <Field label="Frequency"><select className="input" value={f.frequency || 'daily'} onChange={(e) => setF({ ...f, frequency: e.target.value })}>{Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        {!editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rate per copy (₹)" required error={errors.rate}><input className="input" inputMode="decimal" value={f.rate || ''} onChange={(e) => setF({ ...f, rate: e.target.value })} placeholder="e.g. 9.50" /></Field>
            <Field label="Effective from"><input className="input" type="date" value={f.effectiveFrom || ''} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} /></Field>
          </div>
        )}
        {editing && <p className="text-xs text-ink-muted">To change the price, use <strong>Update rate</strong> so the history is kept.</p>}
      </form>
    </Modal>
  );
}

/* ---------- Update rate ---------- */
function RateModal({ open, publication, onClose, onSaved }) {
  const toast = useToast();
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(todayKey());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setRate(''); setDate(todayKey()); setError(''); }
  }, [open, publication]);

  if (!publication) return null;
  const submit = async (e) => {
    e.preventDefault();
    const paise = rupeesToPaise(rate);
    if (rate === '' || paise === null) return setError('Enter the new rate per copy');
    setBusy(true);
    try {
      await api.addRate(publication._id, { ratePerCopy: paise, effectiveFrom: date });
      toast.success(`${publication.name}: new rate ${money(paise)} from ${formatDate(date)}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Update rate" description={publication.name}
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="rate-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update rate'}</button></>}>
      <form id="rate-form" onSubmit={submit} noValidate className="space-y-4">
        <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-soft">Current rate: <strong className="text-ink">{money(publication.currentRate)}</strong> per copy</p>
        <Field label="New rate per copy (₹)" required error={error}><input className="input text-lg font-semibold" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={paiseToRupeeInput(publication.currentRate)} data-autofocus /></Field>
        <Field label="Effective from" required hint="Deliveries on and after this date use the new rate. Earlier bills do not change."><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </form>
    </Modal>
  );
}

/* ---------- Rate history timeline ---------- */
function Timeline({ rates }) {
  const today = todayKey();
  return (
    <ol className="relative ml-2 border-l-2 border-primary-100 pl-6">
      {rates.map((r, i) => {
        const date = dateInput(r.effectiveFrom);
        const isCurrent = i === rates.findIndex((x) => dateInput(x.effectiveFrom) <= today);
        const future = date > today;
        return (
          <li key={date + i} className="relative pb-4 last:pb-0">
            <span className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-surface ${isCurrent ? 'bg-primary ring-2 ring-primary-200' : 'bg-primary-200'}`} aria-hidden />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-ink">{money(r.ratePerCopy)}</span>
              {isCurrent && <Badge tone="success">Current</Badge>}
              {future && <Badge tone="warning">Scheduled</Badge>}
            </div>
            <p className="text-xs text-ink-muted">From {formatDate(date)}{r.setBy ? ` · set by ${r.setBy}` : ''}</p>
          </li>
        );
      })}
    </ol>
  );
}

export default function Publications() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => api.publications());
  const [tab, setTab] = useState('newspaper');
  const [expanded, setExpanded] = useState(null);
  const [pubModal, setPubModal] = useState({ open: false, pub: null });
  const [rateFor, setRateFor] = useState(null);
  const [toggle, setToggle] = useState(null);

  const all = data || [];
  const list = all.filter((p) => p.type === tab);

  const doToggle = async () => {
    try {
      await api.updatePublication(toggle._id, { active: !toggle.active });
      toast.success(`${toggle.name} ${toggle.active ? 'deactivated' : 'activated'}`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  return (
    <>
      <PageHeader
        title="Publications & Rates"
        subtitle="Set the price per copy. Rate changes apply from a date and never alter past bills."
        actions={<button className="btn-primary" onClick={() => setPubModal({ open: true, pub: null })}><Plus className="h-4 w-4" /> Add {tab}</button>}
      />
      <div className="mb-4">
        <Tabs label="Publication type" value={tab} onChange={(t) => { setTab(t); setExpanded(null); }} tabs={[
          { key: 'newspaper', label: 'Newspapers', count: all.filter((p) => p.type === 'newspaper').length },
          { key: 'magazine', label: 'Magazines', count: all.filter((p) => p.type === 'magazine').length },
        ]} />
      </div>

      <div className="card overflow-hidden">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={6} cols={6} /> : list.length === 0 ? (
          <EmptyState icon={tab === 'newspaper' ? Newspaper : BookOpen} title={`No ${tab}s yet`} message="Add one to set its rate and start subscribing customers." action={<button className="btn-primary btn-sm" onClick={() => setPubModal({ open: true, pub: null })}><Plus className="h-4 w-4" /> Add {tab}</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas/60">
                <tr><th className="th w-8"><span className="sr-only">Expand</span></th><th className="th">Name</th><th className="th">Language</th><th className="th">Frequency</th><th className="th text-right">Current rate</th><th className="th text-right">Subscribers</th><th className="th">Status</th><th className="th text-right">Actions</th></tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const open = expanded === p._id;
                  return (
                    <Fragment key={p._id}>
                      <tr className={`border-b border-line/70 hover:bg-canvas/50 ${!p.active ? 'opacity-60' : ''}`}>
                        <td className="td pr-0">
                          <button onClick={() => setExpanded(open ? null : p._id)} className="rounded p-1 text-ink-muted hover:bg-primary-50 hover:text-primary" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} rate history for ${p.name}`}>
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="td font-medium text-ink ml">{p.name}</td>
                        <td className="td text-ink-soft">{p.language}</td>
                        <td className="td"><Badge>{FREQ[p.frequency]}</Badge></td>
                        <td className="td text-right text-base font-semibold tabular-nums text-ink">{money(p.currentRate)}</td>
                        <td className="td text-right tabular-nums">{p.subscribers}</td>
                        <td className="td">{p.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                        <td className="td">
                          <div className="flex justify-end gap-1">
                            <button className="btn-primary btn-sm" onClick={() => setRateFor(p)}><IndianRupee className="h-3.5 w-3.5" /> Update rate</button>
                            <button className="rounded-lg p-2 text-ink-muted hover:bg-primary-50 hover:text-primary" onClick={() => setExpanded(open ? null : p._id)} aria-label={`Rate history for ${p.name}`}><History className="h-4 w-4" /></button>
                            <button className="rounded-lg p-2 text-ink-muted hover:bg-primary-50 hover:text-primary" onClick={() => setPubModal({ open: true, pub: p })} aria-label={`Edit ${p.name}`}><Pencil className="h-4 w-4" /></button>
                            <button className={`rounded-lg p-2 text-ink-muted ${p.active ? 'hover:bg-danger-soft hover:text-danger' : 'hover:bg-success-soft hover:text-success'}`} onClick={() => setToggle(p)} aria-label={`${p.active ? 'Deactivate' : 'Activate'} ${p.name}`}><Power className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-line bg-primary-50/40">
                          <td />
                          <td colSpan={7} className="px-4 py-4">
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Rate history</h3>
                            <Timeline rates={p.rates} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PublicationModal open={pubModal.open} publication={pubModal.pub} defaultType={tab} onClose={() => setPubModal({ open: false, pub: null })} onSaved={reload} />
      <RateModal open={!!rateFor} publication={rateFor} onClose={() => setRateFor(null)} onSaved={reload} />
      <ConfirmDialog
        open={!!toggle}
        danger={!!toggle?.active}
        title={toggle?.active ? 'Deactivate publication?' : 'Activate publication?'}
        message={toggle?.active ? <>New subscriptions to <strong className="text-ink ml">{toggle?.name}</strong> will no longer be possible. Existing subscriptions keep being billed until they end.</> : <><strong className="text-ink ml">{toggle?.name}</strong> will be available for new subscriptions again.</>}
        confirmLabel={toggle?.active ? 'Deactivate' : 'Activate'}
        onConfirm={doToggle}
        onClose={() => setToggle(null)}
      />
    </>
  );
}
