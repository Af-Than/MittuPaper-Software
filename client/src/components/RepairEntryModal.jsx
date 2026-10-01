import { useEffect, useState } from 'react';
import Modal from './Modal';
import { Field } from './ui';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { dateInput, nowISTInput, paiseToRupeeInput, rupeesToPaise } from '../lib/format';

const CATEGORIES = ['service', 'tyre', 'brake', 'engine', 'battery', 'electrical', 'accident', 'other'];
const empty = (vehicle) => ({
  vehicle: vehicle?._id || '', repairedAt: nowISTInput(), category: 'service', description: '', workshop: '',
  partsCost: '', labourCost: '', odometer: vehicle?.odometer || '', invoiceNo: '', status: 'completed',
  nextServiceDate: '', nextServiceKm: '', paymentMode: 'cash',
});

export default function RepairEntryModal({ open, vehicle, vehicles = [], onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(empty(vehicle));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setForm(empty(vehicle)); setErrors({}); } }, [open, vehicle]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const total = (rupeesToPaise(form.partsCost) || 0) + (rupeesToPaise(form.labourCost) || 0);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.vehicle) errs.vehicle = 'Choose a vehicle';
    if (!form.description.trim()) errs.description = 'Describe the repair';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.createRepair({
        ...form, description: form.description.trim(), partsCost: rupeesToPaise(form.partsCost) || 0, labourCost: rupeesToPaise(form.labourCost) || 0,
        odometer: form.odometer === '' ? null : Number(form.odometer), nextServiceDate: form.nextServiceDate || null, nextServiceKm: form.nextServiceKm === '' ? null : Number(form.nextServiceKm),
      });
      toast.success('Repair entry recorded');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add repair entry" size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="repair-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <form id="repair-form" onSubmit={submit} noValidate className="space-y-4">
        {!vehicle && (
          <Field label="Vehicle" required error={errors.vehicle}>
            <select className="input" value={form.vehicle} onChange={(e) => set({ vehicle: e.target.value })}>
              <option value="">Select a vehicle…</option>
              {vehicles.map((v) => <option key={v._id} value={v._id}>{v.registrationNumber}</option>)}
            </select>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date & time" required><input className="input" type="datetime-local" value={form.repairedAt} onChange={(e) => set({ repairedAt: e.target.value })} /></Field>
          <Field label="Category"><select className="input" value={form.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        </div>
        <Field label="Description" required error={errors.description}><input className="input" value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={300} /></Field>
        <Field label="Workshop"><input className="input" value={form.workshop} onChange={(e) => set({ workshop: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Parts cost (₹)"><input className="input" inputMode="decimal" value={form.partsCost} onChange={(e) => set({ partsCost: e.target.value })} /></Field>
          <Field label="Labour cost (₹)"><input className="input" inputMode="decimal" value={form.labourCost} onChange={(e) => set({ labourCost: e.target.value })} /></Field>
          <Field label="Total" hint="Parts + labour"><input className="input" disabled value={paiseToRupeeInput(total)} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Odometer (km)"><input className="input" type="number" min={0} value={form.odometer} onChange={(e) => set({ odometer: e.target.value })} /></Field>
          <Field label="Invoice no."><input className="input" value={form.invoiceNo} onChange={(e) => set({ invoiceNo: e.target.value })} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status"><select className="input" value={form.status} onChange={(e) => set({ status: e.target.value })}><option value="completed">Completed</option><option value="pending">Pending</option></select></Field>
          <Field label="Payment mode"><select className="input" value={form.paymentMode} onChange={(e) => set({ paymentMode: e.target.value })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="other">Other</option></select></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Next service date" hint="Optional"><input className="input" type="date" value={dateInput(form.nextServiceDate)} onChange={(e) => set({ nextServiceDate: e.target.value })} /></Field>
          <Field label="Next service at (km)" hint="Optional"><input className="input" type="number" min={0} value={form.nextServiceKm} onChange={(e) => set({ nextServiceKm: e.target.value })} /></Field>
        </div>
      </form>
    </Modal>
  );
}
