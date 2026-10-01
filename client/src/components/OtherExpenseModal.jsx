import { useEffect, useState } from 'react';
import Modal from './Modal';
import { Field } from './ui';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { rupeesToPaise, todayKey } from '../lib/format';

const CATEGORIES = ['rent', 'electricity', 'phone-internet', 'stationery-packing', 'publisher-payment', 'miscellaneous'];
const EMPTY = { category: 'miscellaneous', amount: '', date: todayKey(), description: '', paymentMode: 'cash' };

export default function OtherExpenseModal({ open, expense, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(expense ? { category: expense.category, amount: (expense.amount / 100).toFixed(2), date: expense.date.slice(0, 10), description: expense.description, paymentMode: expense.paymentMode } : EMPTY);
      setErrors({});
    }
  }, [open, expense]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    const amount = rupeesToPaise(form.amount);
    if (!amount || amount <= 0) errs.amount = 'Enter an amount';
    if (!form.description.trim()) errs.description = 'Describe the expense';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const body = { ...form, amount, description: form.description.trim() };
      if (expense) await api.updateOtherExpense(expense._id, body);
      else await api.createOtherExpense(body);
      toast.success(expense ? 'Expense updated' : 'Expense recorded');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={expense ? 'Edit expense' : 'Add expense'}
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="oe-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <form id="oe-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Category"><select className="input" value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('-', ' / ')}</option>)}</select></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)" required error={errors.amount}><input className="input" inputMode="decimal" value={form.amount} onChange={set('amount')} /></Field>
          <Field label="Date" required><input className="input" type="date" value={form.date} onChange={set('date')} /></Field>
        </div>
        <Field label="Description" required error={errors.description}><input className="input" value={form.description} onChange={set('description')} maxLength={300} /></Field>
        <Field label="Payment mode"><select className="input" value={form.paymentMode} onChange={set('paymentMode')}><option value="cash">Cash</option><option value="upi">UPI</option><option value="other">Other</option></select></Field>
      </form>
    </Modal>
  );
}
