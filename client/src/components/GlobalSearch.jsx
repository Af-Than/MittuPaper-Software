import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, Search, User, Users } from 'lucide-react';
import { api } from '../api';
import { useDebounced } from '../hooks/useApi';

/** Header search across customers, vehicles and employees. */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(null);
  const boxRef = useRef(null);
  const dq = useDebounced(q, 250);

  useEffect(() => {
    if (dq.trim().length < 2) {
      setResults(null);
      return;
    }
    let active = true;
    api.search(dq).then((r) => active && setResults(r));
    return () => { active = false; };
  }, [dq]);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (path) => {
    navigate(path);
    setQ('');
    setResults(null);
    setOpen(false);
  };

  const hasResults = results && (results.customers.length || results.vehicles.length || results.employees.length);

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        className="input w-full bg-canvas py-1.5 pl-9 pr-3"
        type="search"
        placeholder="Search customers, vehicles, employees…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        aria-label="Global search"
      />
      {open && dq.trim().length >= 2 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-line bg-surface p-2 text-ink shadow-lift">
          {!results ? (
            <p className="px-2 py-3 text-sm text-ink-muted">Searching…</p>
          ) : !hasResults ? (
            <p className="px-2 py-3 text-sm text-ink-muted">No matches</p>
          ) : (
            <>
              {results.customers.length > 0 && (
                <div className="mb-1">
                  <div className="px-2 py-1 text-xs font-semibold uppercase text-ink-muted">Customers</div>
                  {results.customers.map((c) => (
                    <button key={c._id} onClick={() => go(`/customers/${c._id}`)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-primary-50">
                      <User className="h-3.5 w-3.5 text-ink-muted" /> <span className="ml">{c.name}</span> <span className="text-xs text-ink-muted">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.vehicles.length > 0 && (
                <div className="mb-1">
                  <div className="px-2 py-1 text-xs font-semibold uppercase text-ink-muted">Vehicles</div>
                  {results.vehicles.map((v) => (
                    <button key={v._id} onClick={() => go(`/expenses/vehicles/${v._id}`)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-primary-50">
                      <Bike className="h-3.5 w-3.5 text-ink-muted" /> {v.registrationNumber}
                    </button>
                  ))}
                </div>
              )}
              {results.employees.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold uppercase text-ink-muted">Employees</div>
                  {results.employees.map((e) => (
                    <button key={e._id} onClick={() => go(`/expenses/employees/${e._id}`)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-primary-50">
                      <Users className="h-3.5 w-3.5 text-ink-muted" /> <span className="ml">{e.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
