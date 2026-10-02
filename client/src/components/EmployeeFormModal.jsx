import { useEffect, useState } from 'react';
import Modal from './Modal';
import { Field } from './ui';
import { api } from '../api';
import { errorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { paiseToRupeeInput, rupeesToPaise, todayKey } from '../lib/format';

const EMPTY = { name: '', phone: '', role: 'delivery', joinDate: todayKey(), monthlySalary: '', salaryDueDay: 1, notes: '', active: true };

export default function EmployeeFormModal({ open, employee, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(employee ? { name: employee.name, phone: employee.phone, role: employee.role, joinDate: employee.joinDate.slice(0, 10), monthlySalary: paiseToRupeeInput(employee.monthlySalary), salaryDueDay: employee.salaryDueDay, notes: employee.notes || '', active: employee.active } : EMPTY);
      setErrors({});
    }
  }, [open, employee]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) errs.phone = 'Enter a valid 10-digit Indian mobile number';
    const salary = rupeesToPaise(form.monthlySalary);
    if (salary === null || salary <= 0) errs.monthlySalary = 'Enter the monthly salary';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const body = { ...form, name: form.name.trim(), phone: form.phone.trim(), monthlySalary: salary, salaryDueDay: Number(form.salaryDueDay), notes: form.notes.trim() };
      const saved = employee ? await api.updateEmployee(employee._id, body) : await api.createEmployee(body);
      toast.success(employee ? 'Employee updated' : `${saved.name} added`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={employee ? 'Edit employee' : 'Add employee'}
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="emp-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <form id="emp-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Full name" required error={errors.name}><input className="input ml" value={form.name} onChange={set('name')} maxLength={120} /></Field>
        <Field label="Mobile number" required error={errors.phone} hint="10 digits, without +91"><input className="input" inputMode="numeric" value={form.phone} onChange={set('phone')} maxLength={10} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role"><select className="input" value={form.role} onChange={set('role')}><option value="delivery">Delivery</option><option value="supervisor">Supervisor</option></select></Field>
          <Field label="Join date"><input className="input" type="date" value={form.joinDate} onChange={set('joinDate')} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monthly salary (₹)" required error={errors.monthlySalary}><input className="input" inputMode="decimal" value={form.monthlySalary} onChange={set('monthlySalary')} /></Field>
          <Field label="Salary due day" hint="Day of month salary is due"><input className="input" type="number" min={1} max={28} value={form.salaryDueDay} onChange={set('salaryDueDay')} /></Field>
        </div>
        <Field label="Notes"><textarea className="input ml" rows={2} value={form.notes} onChange={set('notes')} maxLength={500} /></Field>
        {employee && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="h-4 w-4 rounded border-line accent-[rgb(44_83_146)]" checked={form.active} onChange={set('active')} />
            Active employee
          </label>
        )}
      </form>
    </Modal>
  );
}
