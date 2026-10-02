import { useEffect, useState } from 'react';
import Modal from './Modal';
import { Field } from './ui';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { nowISTInput, paiseToRupeeInput, rupeesToPaise } from '../lib/format';

const empty = (vehicle) => ({
  vehicle: vehicle?._id || '', employee: vehicle?.assignedEmployee?._id || vehicle?.assignedEmployee || '', fuelledAt: nowISTInput(),
  litres: '', pricePerLitre: '', amount: '', odometer: vehicle?.odometer || '', station: '', fullTank: true, paymentMode: 'cash', receiptNo: '', note: '',
});

/** Add a fuel entry. `vehicles` is the picker list; pass a `vehicle` to preselect (e.g. from Vehicle Detail). */
export default function FuelEntryModal({ open, vehicle, vehicles = [], onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(empty(vehicle));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setForm(empty(vehicle)); setErrors({}); }
  }, [open, vehicle]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Auto-calculate amount from litres x price, but let the admin override it.
  const onLitresOrPrice = (patch) => {
    const next = { ...form, ...patch };
    const l = Number(next.litres);
    const p = rupeesToPaise(next.pricePerLitre);
    if (l > 0 && p) next.amount = paiseToRupeeInput(Math.round(l * p));
    set(next);
  };

  const chooseVehicle = (id) => {
    const v = vehicles.find((x) => x._id === id);
    set({ vehicle: id, employee: v?.assignedEmployee?._id || v?.assignedEmployee || '', odometer: v?.odometer || form.odometer });
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.vehicle) errs.vehicle = 'Choose a vehicle';
    if (!(Number(form.litres) > 0)) errs.litres = 'Enter litres';
    const price = rupeesToPaise(form.pricePerLitre);
    const amount = rupeesToPaise(form.amount);
    if (!price) errs.pricePerLitre = 'Enter the price';
    if (!amount) errs.amount = 'Enter the amount';
    if (!(Number(form.odometer) >= 0)) errs.odometer = 'Enter the odometer reading';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.createFuelEntry({ ...form, employee: form.employee || null, litres: Number(form.litres), pricePerLitre: price, amount, odometer: Number(form.odometer) });
      toast.success('Fuel entry recorded');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add fuel entry"
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="fuel-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <form id="fuel-form" onSubmit={submit} noValidate className="space-y-4">
        {!vehicle && (
          <Field label="Vehicle" required error={errors.vehicle}>
            <select className="input" value={form.vehicle} onChange={(e) => chooseVehicle(e.target.value)}>
              <option value="">Select a vehicle…</option>
              {vehicles.map((v) => <option key={v._id} value={v._id}>{v.registrationNumber}</option>)}
            </select>
          </Field>
        )}
        <Field label="Date & time" required><input className="input" type="datetime-local" value={form.fuelledAt} onChange={(e) => set({ fuelledAt: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Litres" required error={errors.litres}><input className="input" inputMode="decimal" value={form.litres} onChange={(e) => onLitresOrPrice({ litres: e.target.value })} /></Field>
          <Field label="Price / litre (₹)" required error={errors.pricePerLitre}><input className="input" inputMode="decimal" value={form.pricePerLitre} onChange={(e) => onLitresOrPrice({ pricePerLitre: e.target.value })} /></Field>
          <Field label="Amount (₹)" required error={errors.amount} hint="Auto-calculated, editable"><input className="input" inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Odometer (km)" required error={errors.odometer}><input className="input" type="number" min={0} value={form.odometer} onChange={(e) => set({ odometer: e.target.value })} /></Field>
          <Field label="Station"><input className="input" value={form.station} onChange={(e) => set({ station: e.target.value })} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment mode"><select className="input" value={form.paymentMode} onChange={(e) => set({ paymentMode: e.target.value })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="other">Other</option></select></Field>
          <Field label="Receipt no."><input className="input" value={form.receiptNo} onChange={(e) => set({ receiptNo: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="h-4 w-4 rounded border-line accent-[rgb(44_83_146)]" checked={form.fullTank} onChange={(e) => set({ fullTank: e.target.checked })} />
          Full tank (needed to calculate mileage accurately)
        </label>
        <Field label="Note"><input className="input" value={form.note} maxLength={200} onChange={(e) => set({ note: e.target.value })} /></Field>
      </form>
    </Modal>
  );
}
