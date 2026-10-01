import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  CalendarRange, ChevronRight, FileText, Files, History, LayoutDashboard, LogOut, Menu, Newspaper, Users, Wallet, X,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { initials } from '../lib/format';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/publications', label: 'Publications & Rates', icon: Newspaper },
  { group: 'Billing' },
  { to: '/billing/customer', label: 'Customer Bill', icon: FileText },
  { to: '/billing/monthly', label: 'All Monthly Bills', icon: Files },
  { to: '/billing/yearly', label: 'Yearly Report', icon: CalendarRange },
  { group: 'Accounts' },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/activity', label: 'Activity & Logins', icon: History },
];

const CRUMBS = {
  '/': [['Dashboard']],
  '/customers': [['Customers']],
  '/publications': [['Publications & Rates']],
  '/billing/customer': [['Billing'], ['Customer Bill']],
  '/billing/monthly': [['Billing'], ['All Monthly Bills']],
  '/billing/yearly': [['Billing'], ['Yearly Report']],
  '/payments': [['Payments']],
  '/activity': [['Activity & Logins']],
};

// Pages with a dynamic title (e.g. customer name) push it into the breadcrumb via this hook
const CrumbContext = createContext(() => {});
export function useCrumb(label) {
  const set = useContext(CrumbContext);
  useEffect(() => {
    set(label || null);
    return () => set(null);
  }, [label, set]);
}

function Breadcrumb({ extra }) {
  const { pathname } = useLocation();
  let trail = CRUMBS[pathname];
  if (!trail && pathname.startsWith('/customers/')) trail = [['Customers', '/customers'], [extra || 'Customer']];
  if (!trail) return null;
  return (
    <nav aria-label="Breadcrumb" className="no-print mb-3 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
      <Link to="/" className="hover:text-primary">Home</Link>
      {trail.map(([label, to], i) => (
        <span key={label + i} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" aria-hidden />
          {to ? <Link to={to} className="hover:text-primary">{label}</Link> : <span className={i === trail.length - 1 ? 'font-medium text-ink-soft' : ''} aria-current={i === trail.length - 1 ? 'page' : undefined}>{label}</span>}
        </span>
      ))}
    </nav>
  );
}

export default function AppLayout() {
  const { admin, logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [crumb, setCrumb] = useState(null);
  const { pathname } = useLocation();

  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  const sidebar = (
    <nav aria-label="Main" className="flex flex-col gap-0.5 p-3">
      {NAV.map((item, i) =>
        item.group ? (
          <div key={item.group} className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{item.group}</div>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:bg-primary-50 hover:text-primary'
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px]" aria-hidden />
            {item.label}
          </NavLink>
        )
      )}
    </nav>
  );

  const handleLogout = async () => {
    await logout();
    toast.info('You have been signed out.');
  };

  return (
    <div className="app-shell min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>

      {/* Top header band */}
      <header className="no-print sticky top-0 z-40 bg-gradient-to-r from-primary-900 via-primary-800 to-primary-600 text-white shadow-md">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 hover:bg-white/10 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/" aria-label="Go to dashboard"><Logo /></Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-semibold">{admin?.name}</div>
              <div className="text-xs text-primary-200">Administrator</div>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold ring-1 ring-white/30" aria-hidden>{initials(admin?.name)}</span>
            <button onClick={handleLogout} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10">
              <LogOut className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="no-print sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-line bg-surface lg:block">
          {sidebar}
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="no-print fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} aria-hidden />
            <aside className="pop-in absolute left-0 top-0 h-full w-72 overflow-y-auto bg-surface shadow-lift">
              <div className="flex h-16 items-center justify-between bg-primary-900 px-4">
                <Logo showTagline={false} />
                <button className="rounded-lg p-2 text-white hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close navigation menu"><X className="h-5 w-5" /></button>
              </div>
              {sidebar}
            </aside>
          </div>
        )}

        <main id="main" className="app-main min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <CrumbContext.Provider value={setCrumb}>
            <Breadcrumb extra={crumb} />
            <Outlet />
          </CrumbContext.Provider>
        </main>
      </div>
    </div>
  );
}
