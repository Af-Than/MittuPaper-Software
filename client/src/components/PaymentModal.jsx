import { useEffect, useState } from 'react';
import Modal from './Modal';
import { Field } from './ui';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { money, monthLabel, paiseToRupeeInput, rupeesToPaise, todayKey } from '../lib/format';

/**
 * Record a payment against a bill. `bill` needs: _id, year, month, balance, totalPayable, amountPaid
 * and (optionally) customer name for the heading. `full` pre-fills the whole balance.
 */
export default function PaymentModal({ open, bill, customerName, full = false, onClose, onSaved }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [mode, setMode] = useState('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && bill) {
      setAmount(full ? paiseToRupeeInput(bill.balance) : '');
      setDate(todayKey());
      setMode('cash');
      setNote('');
      setError('');
    }
  }, [open, bill, full]);

  if (!bill) return null;

  const submit = async (e) => {
    e.preventDefault();
    const paise = rupeesToPaise(amount);
    if (!paise || paise <= 0) return setError('Enter an amount greater than zero');
    if (paise > bill.balance) return setError(`The amount cannot exceed the balance of ${money(bill.balance)}`);
    setError('');
    setBusy(true);
    try {
      const r = await api.recordPayment({ bill: bill._id, amount: paise, date, mode, note });
      toast.success(r.bill.balance === 0 ? 'Payment recorded — bill cleared in full' : `Payment of ${money(paise)} recorded`);
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
      size="sm"
      title="Record payment"
      description={`${customerName || bill.customer?.name || ''} · ${monthLabel(bill.year, bill.month)} bill`}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="pay-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Record payment'}</button>
        </>
      }
    >
      <form id="pay-form" onSubmit={submit} noValidate className="space-y-4">
        <dl className="grid grid-cols-3 gap-2 rounded-lg bg-canvas p-3 text-center text-xs">
          <div><dt className="text-ink-muted">Total payable</dt><dd className="mt-0.5 text-sm font-semibold text-ink">{money(bill.totalPayable)}</dd></div>
          <div><dt className="text-ink-muted">Paid so far</dt><dd className="mt-0.5 text-sm font-semibold text-success">{money(bill.amountPaid)}</dd></div>
          <div><dt className="text-ink-muted">Balance</dt><dd className="mt-0.5 text-sm font-semibold text-danger">{money(bill.balance)}</dd></div>
        </dl>
        <Field label="Amount received (₹)" required error={error}>
          <input className="input text-lg font-semibold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" data-autofocus />
        </Field>
        <button type="button" className="btn-ghost btn-sm -mt-2" onClick={() => setAmount(paiseToRupeeInput(bill.balance))}>Pay full balance ({money(bill.balance)})</button>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required>
            <input className="input" type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Mode">
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
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
    </Modal>
  );
}
