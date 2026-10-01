import { useEffect, useState } from 'react';
import Modal from './Modal';
import { Field } from './ui';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';

const EMPTY = { name: '', phone: '', address: '', notes: '', active: true, employee: '', routeName: '' };

/** Add / edit a customer. `customer` = existing record to edit, or null to create. */
export default function CustomerFormModal({ open, customer, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const employees = useApi(() => api.employees({ active: 'true', limit: 100 }), [], { enabled: open });

  useEffect(() => {
    if (open) {
      setForm(
        customer
          ? { name: customer.name, phone: customer.phone, address: customer.address, notes: customer.notes || '', active: customer.active, employee: customer.employee?._id || customer.employee || '', routeName: customer.routeName || '' }
          : EMPTY
      );
      setErrors({});
    }
  }, [open, customer]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) errs.phone = 'Enter a valid 10-digit Indian mobile number';
    if (!form.address.trim()) errs.address = 'Address is required';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const body = { ...form, name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), notes: form.notes.trim(), employee: form.employee || null, routeName: form.routeName.trim() };
      const saved = customer ? await api.updateCustomer(customer._id, body) : await api.createCustomer(body);
      toast.success(customer ? 'Customer updated' : `${saved.name} added`);
      onSaved?.(saved);
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
      title={customer ? 'Edit customer' : 'Add customer'}
      description="Names and addresses can be typed in English or Malayalam."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="customer-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : customer ? 'Save changes' : 'Add customer'}</button>
        </>
      }
    >
      <form id="customer-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Full name" required error={errors.name}>
          <input className="input ml" value={form.name} onChange={set('name')} maxLength={120} />
        </Field>
        <Field label="Mobile number" required error={errors.phone} hint="10 digits, without +91">
          <input className="input" inputMode="numeric" value={form.phone} onChange={set('phone')} maxLength={10} />
        </Field>
        <Field label="Delivery address" required error={errors.address}>
          <textarea className="input ml" rows={3} value={form.address} onChange={set('address')} maxLength={300} />
        </Field>
        <Field label="Notes" hint="Optional: gate instructions, preferred time, etc.">
          <textarea className="input ml" rows={2} value={form.notes} onChange={set('notes')} maxLength={500} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Delivery employee" hint="Optional — for the daily delivery sheet">
            <select className="input" value={form.employee} onChange={set('employee')}>
              <option value="">Not assigned</option>
              {(employees.data?.items || []).map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label="Route name" hint="Optional, e.g. 'Pattom Route'">
            <input className="input ml" value={form.routeName} onChange={set('routeName')} maxLength={80} />
          </Field>
        </div>
        {customer && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="h-4 w-4 rounded border-line accent-[rgb(20_74_159)]" checked={form.active} onChange={set('active')} />
            Active customer (inactive customers are skipped when generating bills)
          </label>
        )}
      </form>
    </Modal>
  );
}
