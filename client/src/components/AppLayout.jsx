import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bike, CalendarRange, ChevronRight, FileSpreadsheet, FileText, Files, Fuel, History, LayoutDashboard, LogOut,
  Menu, Newspaper, Receipt, Settings as SettingsIcon, TrendingUp, Truck, Users, Wallet, Wrench, X,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import NotificationsBell from './NotificationsBell';
import GlobalSearch from './GlobalSearch';
import { initials } from '../lib/format';
import { useViewEnter } from '../lib/motion';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { group: 'Billing' },
  { to: '/billing/customer', label: 'Customer Bill', icon: FileText },
  { to: '/billing/monthly', label: 'All Monthly Bills', icon: Files },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/delivery-sheet', label: 'Delivery Sheet', icon: Truck },
  { group: 'Customers' },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/publications', label: 'Publications & Rates', icon: Newspaper },
  { group: 'Expenses' },
  { to: '/expenses', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/expenses/employees', label: 'Employees', icon: Users },
  { to: '/expenses/vehicles', label: 'Vehicles', icon: Bike },
  { to: '/expenses/fuel', label: 'Fuel Log', icon: Fuel },
  { to: '/expenses/repairs', label: 'Repairs', icon: Wrench },
  { to: '/expenses/salaries', label: 'Salaries', icon: Receipt },
  { to: '/expenses/ledger', label: 'Expense Ledger', icon: FileSpreadsheet },
  { group: 'Reports' },
  { to: '/billing/yearly', label: 'Yearly Report', icon: CalendarRange },
  { to: '/expenses/profit-loss', label: 'Profit & Loss', icon: TrendingUp },
  { to: '/activity', label: 'Activity & Logins', icon: History },
  { group: 'Settings' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
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
  '/expenses': [['Expenses'], ['Dashboard']],
  '/expenses/employees': [['Expenses'], ['Employees']],
  '/expenses/vehicles': [['Expenses'], ['Vehicles']],
  '/expenses/fuel': [['Expenses'], ['Fuel Log']],
  '/expenses/repairs': [['Expenses'], ['Repairs']],
  '/expenses/salaries': [['Expenses'], ['Salaries']],
  '/expenses/ledger': [['Expenses'], ['Expense Ledger']],
  '/expenses/profit-loss': [['Expenses'], ['Profit & Loss']],
  '/delivery-sheet': [['Delivery Sheet']],
  '/settings': [['Settings']],
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
  if (!trail && pathname.startsWith('/expenses/employees/')) trail = [['Expenses', '/expenses'], ['Employees', '/expenses/employees'], [extra || 'Employee']];
  if (!trail && pathname.startsWith('/expenses/vehicles/')) trail = [['Expenses', '/expenses'], ['Vehicles', '/expenses/vehicles'], [extra || 'Vehicle']];
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
  const view = useRef(null);
  useViewEnter(view, pathname);

  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  const sidebar = (
    <nav aria-label="Main" className="flex flex-col gap-0.5 p-3">
      {NAV.map((item, i) =>
        item.group ? (
          <div key={item.group} className="mt-5 px-3 pb-1 text-xs font-medium text-ink-muted">{item.group}</div>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive ? 'bg-primary-50 font-medium text-primary' : 'text-ink-soft hover:bg-canvas hover:text-ink'
              }`
            }
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
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

      {/* Top bar */}
      <header className="no-print sticky top-0 z-40 border-b border-line bg-surface">
        <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 text-ink-soft hover:bg-canvas lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/" aria-label="Go to dashboard"><Logo showTagline={false} /></Link>
          </div>
          <div className="hidden flex-1 justify-center px-4 md:flex">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationsBell />
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium text-ink">{admin?.name}</div>
              <div className="text-xs text-ink-muted">Administrator</div>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary" aria-hidden>{initials(admin?.name)}</span>
            <button onClick={handleLogout} className="btn-ghost btn-sm">
              <LogOut className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="no-print sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-line bg-surface lg:block">
          {sidebar}
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="no-print fixed inset-0 z-50 lg:hidden">
            <div className="fade-in absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
            <aside className="drawer-in absolute left-0 top-0 h-full w-64 overflow-y-auto bg-surface shadow-lift">
              <div className="flex h-14 items-center justify-between border-b border-line px-4">
                <Logo showTagline={false} />
                <button className="rounded-lg p-2 text-ink-soft hover:bg-canvas" onClick={() => setOpen(false)} aria-label="Close navigation menu"><X className="h-5 w-5" /></button>
              </div>
              {sidebar}
            </aside>
          </div>
        )}

        <main id="main" className="app-main min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">
          <CrumbContext.Provider value={setCrumb}>
            <div ref={view}>
              <Breadcrumb extra={crumb} />
              <Outlet />
            </div>
          </CrumbContext.Provider>
        </main>
      </div>
    </div>
  );
}
