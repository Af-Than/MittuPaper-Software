import { useEffect, useState } from 'react';
import Modal from './Modal';
import { Field } from './ui';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { dateInput } from '../lib/format';

const EMPTY = { registrationNumber: '', type: 'scooter', makeModel: '', fuelType: 'petrol', assignedEmployee: '', status: 'active', odometer: 0, insuranceExpiry: '', pollutionExpiry: '', fitnessExpiry: '', nextServiceDueKm: '', notes: '' };
const TYPES = ['bike', 'scooter', 'mini-van', 'auto', 'ev-scooter'];
const FUEL_TYPES = ['petrol', 'diesel', 'electric'];

export default function VehicleFormModal({ open, vehicle, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const employees = useApi(() => api.employees({ active: 'true', limit: 100 }), [], { enabled: open });

  useEffect(() => {
    if (open) {
      setForm(
        vehicle
          ? {
              registrationNumber: vehicle.registrationNumber, type: vehicle.type, makeModel: vehicle.makeModel || '', fuelType: vehicle.fuelType,
              assignedEmployee: vehicle.assignedEmployee?._id || vehicle.assignedEmployee || '', status: vehicle.status, odometer: vehicle.odometer,
              insuranceExpiry: dateInput(vehicle.insuranceExpiry), pollutionExpiry: dateInput(vehicle.pollutionExpiry), fitnessExpiry: dateInput(vehicle.fitnessExpiry),
              nextServiceDueKm: vehicle.nextServiceDueKm ?? '', notes: vehicle.notes || '',
            }
          : EMPTY
      );
      setErrors({});
    }
  }, [open, vehicle]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    const reg = form.registrationNumber.trim().toUpperCase();
    if (!/^KL-\d{1,2}-[A-Z]{1,2}-\d{4}$/.test(reg)) errs.registrationNumber = 'Enter a valid Kerala registration, e.g. KL-07-AB-1234';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const body = {
        ...form, registrationNumber: reg, assignedEmployee: form.assignedEmployee || null, odometer: Number(form.odometer) || 0,
        insuranceExpiry: form.insuranceExpiry || null, pollutionExpiry: form.pollutionExpiry || null, fitnessExpiry: form.fitnessExpiry || null,
        nextServiceDueKm: form.nextServiceDueKm === '' ? null : Number(form.nextServiceDueKm), notes: form.notes.trim(),
      };
      const saved = vehicle ? await api.updateVehicle(vehicle._id, body) : await api.createVehicle(body);
      toast.success(vehicle ? 'Vehicle updated' : `${saved.registrationNumber} added`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={vehicle ? 'Edit vehicle' : 'Add vehicle'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="veh-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <form id="veh-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registration number" required error={errors.registrationNumber} hint="e.g. KL-07-AB-1234"><input className="input uppercase" value={form.registrationNumber} onChange={set('registrationNumber')} /></Field>
          <Field label="Make / model"><input className="input" value={form.makeModel} onChange={set('makeModel')} placeholder="e.g. Honda Activa" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type"><select className="input" value={form.type} onChange={set('type')}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
          <Field label="Fuel type"><select className="input" value={form.fuelType} onChange={set('fuelType')}>{FUEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
          <Field label="Status"><select className="input" value={form.status} onChange={set('status')}><option value="active">Active</option><option value="in-repair">In repair</option><option value="retired">Retired</option></select></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assigned employee"><select className="input" value={form.assignedEmployee} onChange={set('assignedEmployee')}><option value="">Not assigned</option>{(employees.data?.items || []).map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</select></Field>
          <Field label="Odometer (km)"><input className="input" type="number" min={0} value={form.odometer} onChange={set('odometer')} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Insurance expiry"><input className="input" type="date" value={form.insuranceExpiry} onChange={set('insuranceExpiry')} /></Field>
          <Field label="PUC expiry"><input className="input" type="date" value={form.pollutionExpiry} onChange={set('pollutionExpiry')} /></Field>
          <Field label="Fitness expiry"><input className="input" type="date" value={form.fitnessExpiry} onChange={set('fitnessExpiry')} /></Field>
        </div>
        <Field label="Next service due at (km)"><input className="input max-w-[200px]" type="number" min={0} value={form.nextServiceDueKm} onChange={set('nextServiceDueKm')} /></Field>
        <Field label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} maxLength={500} /></Field>
      </form>
    </Modal>
  );
}
