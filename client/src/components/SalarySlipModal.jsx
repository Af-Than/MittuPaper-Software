import { Printer } from 'lucide-react';
import Modal from './Modal';
import { Skeleton } from './ui';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import { LogoMark } from './Logo';
import { BRAND } from '../lib/brand';
import { formatIST, money, monthLabel } from '../lib/format';

/** Printable salary slip. `paymentId` is the SalaryPayment id. */
export default function SalarySlipModal({ open, paymentId, onClose }) {
  const { data: p, loading } = useApi(() => api.salarySlip(paymentId), [paymentId], { enabled: open && !!paymentId });

  return (
    <Modal open={open} onClose={onClose} title="Salary slip" footer={<><button className="btn-secondary" onClick={onClose}>Close</button>{p && <button className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>}</>}>
      {loading || !p ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="print-area rounded-xl border border-line">
          <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-primary-900 to-primary-700 px-5 py-4 text-white print:bg-none print:text-ink">
            <LogoMark className="h-9 w-9" />
            <div>
              <div className="font-bold">{BRAND.name}</div>
              <div className="text-xs text-primary-200 print:text-ink-muted">Salary Slip — {monthLabel(p.forYear, p.forMonth)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 px-5 py-4 text-sm">
            <div><dt className="text-ink-muted">Employee</dt><dd className="font-medium ml">{p.employee?.name}</dd></div>
            <div><dt className="text-ink-muted">Role</dt><dd className="font-medium capitalize">{p.employee?.role}</dd></div>
            <div><dt className="text-ink-muted">Phone</dt><dd className="font-medium">{p.employee?.phone}</dd></div>
            <div><dt className="text-ink-muted">Paid on</dt><dd className="font-medium">{formatIST(p.paidOn)}</dd></div>
          </div>
          <table className="w-full border-t border-line text-sm">
            <tbody>
              <tr className="border-b border-line/60"><td className="px-5 py-2 text-ink-soft">Base salary</td><td className="px-5 py-2 text-right tabular-nums">{money(p.baseSalary)}</td></tr>
              <tr className="border-b border-line/60"><td className="px-5 py-2 text-ink-soft">Bonus</td><td className="px-5 py-2 text-right tabular-nums text-success">+ {money(p.bonus)}</td></tr>
              <tr className="border-b border-line/60"><td className="px-5 py-2 text-ink-soft">Deductions</td><td className="px-5 py-2 text-right tabular-nums text-danger">− {money(p.deductions)}</td></tr>
              <tr className="border-b border-line/60"><td className="px-5 py-2 text-ink-soft">Advance recovered</td><td className="px-5 py-2 text-right tabular-nums text-danger">− {money(p.advanceRecovered)}</td></tr>
              <tr className="bg-canvas font-bold"><td className="px-5 py-2.5">Net paid</td><td className="px-5 py-2.5 text-right tabular-nums">{money(p.netPaid)}</td></tr>
            </tbody>
          </table>
          <p className="border-t border-line px-5 py-3 text-center text-xs text-ink-muted">Paid via {p.mode.toUpperCase()}{p.reference ? ` · Ref: ${p.reference}` : ''} · {BRAND.name}</p>
        </div>
      )}
    </Modal>
  );
}
