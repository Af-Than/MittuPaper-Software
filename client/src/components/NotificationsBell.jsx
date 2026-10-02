import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import { money, monthsLabel } from '../lib/format';

/** Bell combining expense alerts with customers 2+ months overdue. Polled lightly on open. */
export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const { data: dash } = useApi(() => api.expenseDashboard(), [], { enabled: open });
  const { data: overdue } = useApi(() => api.customers({ filter: 'overdue', limit: 10 }), [], { enabled: open });

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const alerts = dash?.alerts;
  const alertCount = alerts ? Object.values(alerts).reduce((n, a) => n + a.length, 0) : 0;
  const overdueCount = overdue?.total || 0;
  const total = alertCount + overdueCount;

  return (
    <div ref={boxRef} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-ink-soft hover:bg-canvas" aria-label={`Notifications${total ? `, ${total} unread` : ''}`}>
        <Bell className="h-5 w-5" />
        {total > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{total > 9 ? '9+' : total}</span>}
      </button>
      {open && (
        <div className="pop-in absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-line bg-surface p-3 text-ink shadow-lift">
          <h3 className="mb-2 text-sm font-semibold">Notifications</h3>
          {!dash || !overdue ? (
            <p className="py-4 text-center text-sm text-ink-muted">Loading…</p>
          ) : total === 0 ? (
            <p className="py-4 text-center text-sm text-ink-muted">All clear — nothing needs attention.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {overdue.items.map((c) => (
                <li key={c._id}>
                  <Link to={`/customers/${c._id}`} onClick={() => setOpen(false)} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-canvas">
                    <span className="ml truncate">{c.name} — {monthsLabel(c.dueMonths.length)} overdue</span>
                    <span className="shrink-0 font-medium text-danger">{money(c.due)}</span>
                  </Link>
                </li>
              ))}
              {alerts?.documents.map((a, i) => (
                <li key={`d${i}`}><Link to={`/expenses/vehicles/${a.vehicleId}`} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-canvas">{a.registrationNumber} — {a.doc} {a.expired ? 'expired' : `expires in ${a.days}d`}</Link></li>
              ))}
              {alerts?.salaryPending.map((a, i) => (
                <li key={`s${i}`}><Link to={`/expenses/employees/${a.employeeId}`} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-canvas ml">{a.name} — salary {a.overdue ? 'overdue' : 'due soon'}</Link></li>
              ))}
              {alerts?.serviceDue.map((a, i) => (
                <li key={`sv${i}`}><Link to={`/expenses/vehicles/${a.vehicleId}`} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-canvas">{a.registrationNumber} — service due</Link></li>
              ))}
              {alerts?.mileageDrops.map((a, i) => (
                <li key={`m${i}`}><Link to={`/expenses/vehicles/${a.vehicleId}`} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-canvas">{a.registrationNumber} — mileage dropped</Link></li>
              ))}
              {alerts?.repairsPending.map((a) => (
                <li key={a.id} className="block rounded-lg px-2 py-1.5 text-sm text-ink-soft">{a.registrationNumber} — repair pending</li>
              ))}
            </ul>
          )}
          <Link to="/expenses" onClick={() => setOpen(false)} className="mt-2 block text-center text-xs font-medium text-primary hover:underline">View expense dashboard</Link>
        </div>
      )}
    </div>
  );
}
