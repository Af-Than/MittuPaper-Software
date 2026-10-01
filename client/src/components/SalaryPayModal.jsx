import { useEffect, useState } from 'react';
import Modal from './Modal';
import { Field } from './ui';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { money, monthLabel, nowISTInput, paiseToRupeeInput, rupeesToPaise } from '../lib/format';

/** `row` = one item from the salary grid: { employee, status, suggestedAdvanceRecovery, outstandingAdvance }. */
export default function SalaryPayModal({ open, row, year, month, onClose, onSaved }) {
  const toast = useToast();
  const [bonus, setBonus] = useState('');
  const [deductions, setDeductions] = useState('');
  const [advanceRecovered, setAdvanceRecovered] = useState('');
  const [paidOn, setPaidOn] = useState(nowISTInput());
  const [mode, setMode] = useState('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && row) {
      setBonus('');
      setDeductions('');
      setAdvanceRecovered(row.suggestedAdvanceRecovery ? paiseToRupeeInput(row.suggestedAdvanceRecovery) : '');
      setPaidOn(nowISTInput());
      setMode('cash');
      setReference('');
      setNote('');
    }
  }, [open, row]);

  if (!row) return null;
  const net = Math.max(0, row.employee.monthlySalary + (rupeesToPaise(bonus) || 0) - (rupeesToPaise(deductions) || 0) - (rupeesToPaise(advanceRecovered) || 0));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.paySalary({
        employee: row.employee._id, forYear: year, forMonth: month, bonus: rupeesToPaise(bonus) || 0, deductions: rupeesToPaise(deductions) || 0,
        advanceRecovered: rupeesToPaise(advanceRecovered) || 0, paidOn, mode, reference, note,
      });
      toast.success(`Paid ${row.employee.name} for ${monthLabel(year, month)}`);
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Pay salary" description={`${row.employee.name} · ${monthLabel(year, month)}`}
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="salary-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : `Pay ${money(net)}`}</button></>}>
      <form id="salary-form" onSubmit={submit} noValidate className="space-y-4">
        <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-soft">Base salary: <strong className="text-ink">{money(row.employee.monthlySalary)}</strong>{row.outstandingAdvance > 0 && <> · Outstanding advance: <strong className="text-warning">{money(row.outstandingAdvance)}</strong></>}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Bonus (₹)"><input className="input" inputMode="decimal" value={bonus} onChange={(e) => setBonus(e.target.value)} /></Field>
          <Field label="Deductions (₹)"><input className="input" inputMode="decimal" value={deductions} onChange={(e) => setDeductions(e.target.value)} /></Field>
          <Field label="Advance recovered (₹)" hint={row.outstandingAdvance > 0 ? `Up to ${money(row.outstandingAdvance)}` : undefined}><input className="input" inputMode="decimal" value={advanceRecovered} onChange={(e) => setAdvanceRecovered(e.target.value)} /></Field>
        </div>
        <div className="rounded-lg border border-line px-3 py-2 text-right text-sm"><span className="text-ink-muted">Net payable: </span><strong className="text-base text-ink">{money(net)}</strong></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paid on" required><input className="input" type="datetime-local" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></Field>
          <Field label="Mode"><select className="input" value={mode} onChange={(e) => setMode(e.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option></select></Field>
        </div>
        <Field label="Reference" hint="Optional: transaction/cheque no."><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} /></Field>
        <Field label="Note"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
      </form>
    </Modal>
  );
}
