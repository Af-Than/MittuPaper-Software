import { useEffect, useState } from 'react';
import Modal from './Modal';
import { Field, Skeleton } from './ui';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { money, monthLabel, paiseToRupeeInput, rupeesToPaise, todayKey } from '../lib/format';

/**
 * Record a payment for a customer. Always loads the customer's live due-months list (oldest
 * first) when opened — never trusts a number passed in as a prop, since a payment anywhere
 * can change what's owed elsewhere. Defaults to paying the whole balance oldest-month-first;
 * the admin can instead target one specific month.
 */
export default function PaymentModal({ open, customerId, customerName, onClose, onSaved }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [mode2, setMode2] = useState('auto'); // 'auto' = oldest-first | 'target' = one chosen month
  const [targetBillId, setTargetBillId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [payMode, setPayMode] = useState('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !customerId) return;
    setLoading(true);
    setError('');
    setMode2('auto');
    setDate(todayKey());
    setPayMode('cash');
    setNote('');
    api
      .paymentsDue(customerId)
      .then((r) => {
        setMonths(r.months);
        setTotalDue(r.totalDue);
        setAmount(r.totalDue ? paiseToRupeeInput(r.totalDue) : '');
        setTargetBillId(r.months[0]?.billId || '');
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [open, customerId]);

  const targetMonth = months.find((m) => m.billId === targetBillId);
  const cap = mode2 === 'target' ? targetMonth?.pending || 0 : totalDue;

  const submit = async (e) => {
    e.preventDefault();
    const paise = rupeesToPaise(amount);
    if (!paise || paise <= 0) return setError('Enter an amount greater than zero');
    if (paise > cap) return setError(`The amount cannot exceed ${money(cap)}${mode2 === 'target' ? ' for this month' : ''}`);
    setError('');
    setBusy(true);
    try {
      const r = await api.recordPayment({
        customer: customerId,
        amount: paise,
        date,
        mode: payMode,
        note,
        ...(mode2 === 'target' ? { targetBillId } : {}),
      });
      const cleared = r.allocations.reduce((n, a) => n + a.amount, 0) === totalDue;
      toast.success(cleared ? 'Payment recorded — every due month is now cleared' : `Payment of ${money(paise)} recorded`);
      onSaved?.(r);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      description={customerName}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="pay-form" className="btn-primary" disabled={busy || loading || !months.length}>{busy ? 'Saving…' : 'Record payment'}</button>
        </>
      }
    >
      {loading ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
      ) : !months.length ? (
        <p className="py-6 text-center text-sm text-ink-muted">This customer has no pending balance.</p>
      ) : (
        <form id="pay-form" onSubmit={submit} noValidate className="space-y-4">
          <div className="rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/70"><th className="th px-3 py-2">Month</th><th className="th px-3 py-2 text-right">Pending</th></tr></thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.billId} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-1.5">{monthLabel(m.year, m.month)}{m.ageInMonths === 0 ? '' : ` (${m.ageInMonths} mo ago)`}</td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums">{money(m.pending)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-canvas font-semibold"><td className="px-3 py-1.5">Total due</td><td className="px-3 py-1.5 text-right tabular-nums text-danger">{money(totalDue)}</td></tr></tfoot>
            </table>
          </div>

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink">Apply this payment to</legend>
            <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup">
              <button type="button" role="radio" aria-checked={mode2 === 'auto'} onClick={() => { setMode2('auto'); setAmount(paiseToRupeeInput(totalDue)); setError(''); }} className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode2 === 'auto' ? 'bg-primary text-white' : 'text-ink-soft'}`}>Oldest month first</button>
              <button type="button" role="radio" aria-checked={mode2 === 'target'} onClick={() => { setMode2('target'); setAmount(paiseToRupeeInput(targetMonth?.pending || months[0].pending)); setError(''); }} className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode2 === 'target' ? 'bg-primary text-white' : 'text-ink-soft'}`}>A specific month</button>
            </div>
          </fieldset>

          {mode2 === 'target' && (
            <Field label="Month">
              <select className="input" value={targetBillId} onChange={(e) => { setTargetBillId(e.target.value); setAmount(paiseToRupeeInput(months.find((m) => m.billId === e.target.value)?.pending || 0)); }}>
                {months.map((m) => <option key={m.billId} value={m.billId}>{monthLabel(m.year, m.month)} — {money(m.pending)} pending</option>)}
              </select>
            </Field>
          )}

          <Field label="Amount received (₹)" required error={error}>
            <input className="input text-lg font-semibold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} data-autofocus />
          </Field>
          <button type="button" className="btn-ghost btn-sm -mt-2" onClick={() => setAmount(paiseToRupeeInput(cap))}>Pay full amount ({money(cap)})</button>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" required>
              <input className="input" type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Mode">
              <select className="input" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          <Field label="Note">
            <input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </Field>
        </form>
      )}
    </Modal>
  );
}
