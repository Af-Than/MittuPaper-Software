import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Inbox, MoreHorizontal, RefreshCw } from 'lucide-react';
import { MONTHS, currentYearMonth, money, monthRangeLabel } from '../lib/format';

/* ---------- Form field: label + control + hint + error, wired for accessibility ---------- */
export function Field({ label, error, hint, required, children, className = '' }) {
  const id = useId();
  const child = Children.only(children);
  const control = isValidElement(child)
    ? cloneElement(child, {
        id: child.props.id || id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined,
        className: `${child.props.className || ''} ${error ? 'input-error' : ''}`.trim(),
      })
    : child;
  return (
    <div className={className}>
      <label htmlFor={child.props?.id || id} className="mb-1 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger" aria-hidden> *</span>}
      </label>
      {control}
      {error ? (
        <p id={`${id}-err`} className="mt-1 flex items-center gap-1 text-xs text-danger" role="alert">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/* ---------- Badges ---------- */
const TONES = {
  neutral: 'bg-canvas text-ink-soft border-line',
  primary: 'bg-primary-50 text-primary border-primary-100',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
};
export function Badge({ tone = 'neutral', children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>{children}</span>;
}

const STATUS = {
  paid: { tone: 'success', label: 'Paid', icon: CheckCircle2 },
  partial: { tone: 'warning', label: 'Partial', icon: CircleDot },
  unpaid: { tone: 'danger', label: 'Unpaid', icon: AlertCircle },
};
/** Colour is never the only signal: icon + text label */
export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.unpaid;
  const Icon = s.icon;
  return (
    <Badge tone={s.tone}>
      <Icon className="h-3 w-3" aria-hidden /> {s.label}
    </Badge>
  );
}

/**
 * Due-months badge: "₹1,450 due · 3 months (Jul–Sep 2026)". Colour tracks age — amber for
 * 1 month pending, red for 2 or more — never colour alone (the month count is always in text).
 */
export function DueBadge({ months, due, size = 'md' }) {
  if (!months?.length) return <Badge tone="success">No dues</Badge>;
  const tone = months.length >= 2 ? 'danger' : 'warning';
  return (
    <Badge tone={tone} className={size === 'lg' ? 'text-sm font-semibold' : ''}>
      {money(due)} due · {months.length} {months.length === 1 ? 'month' : 'months'} ({monthRangeLabel(months)})
    </Badge>
  );
}

/* ---------- Loading / empty / error ---------- */
export const Skeleton = ({ className = 'h-4 w-full' }) => <div className={`skeleton ${className}`} aria-hidden />;

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((__, c) => <Skeleton key={c} className="h-5 flex-1" />)}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-ink-muted">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-ink-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger"><AlertCircle className="h-6 w-6" aria-hidden /></span>
      <p className="text-sm text-ink-soft">{message}</p>
      {onRetry && <button className="btn-secondary btn-sm mt-3" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" /> Try again</button>}
    </div>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="t-page">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-canvas p-1 ring-1 ring-line">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-surface text-ink shadow-card ring-1 ring-line' : 'text-ink-soft hover:text-ink'}`}
          >
            {t.label}
            {t.count != null && <span className={`ml-2 rounded-full px-1.5 text-xs ${active ? 'bg-canvas text-ink-soft' : 'bg-line/60 text-ink-muted'}`}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ page, pages, total, onChange }) {
  if (pages <= 1) return total != null ? <p className="px-1 pt-3 text-xs text-ink-muted">{total} total</p> : null;
  return (
    <div className="no-print flex items-center justify-between gap-3 pt-4 text-sm">
      <span className="text-ink-muted">{total != null ? `${total} total · ` : ''}Page {page} of {pages}</span>
      <div className="flex gap-2">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" /> Previous</button>
        <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next <ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/* ---------- Month + year selectors ---------- */
export function MonthYearPicker({ year, month, onChange, hideMonth = false }) {
  const cy = currentYearMonth().year;
  const years = Array.from({ length: 7 }, (_, i) => cy - 5 + i);
  if (!years.includes(year)) years.push(year);
  years.sort();
  return (
    <div className="flex gap-2">
      {!hideMonth && (
        <select aria-label="Month" className="input w-auto" value={month} onChange={(e) => onChange({ year, month: Number(e.target.value) })}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      )}
      <select aria-label="Year" className="input w-auto" value={year} onChange={(e) => onChange({ year: Number(e.target.value), month })}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

/** Shift (year, month) by n months */
export function shiftMonth({ year, month }, n) {
  const k = year * 12 + (month - 1) + n;
  return { year: Math.floor(k / 12), month: (k % 12) + 1 };
}

/**
 * "More" menu for secondary page actions. items: [{ label, to?, onClick?, icon? }]
 * Closes on Esc / outside click; arrow keys move between items.
 */
export function MoreMenu({ items, label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const els = [...root.current.querySelectorAll('[role="menuitem"]')];
        const i = els.indexOf(document.activeElement);
        e.preventDefault();
        els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const itemCls = 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-soft hover:bg-canvas hover:text-ink focus:bg-canvas focus:outline-none';
  return (
    <div ref={root} className="relative">
      <button type="button" className="btn-secondary px-2.5" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="pop-in absolute right-0 top-full z-30 mt-1 min-w-48 rounded-lg border border-line bg-surface p-1 shadow-lift">
          {items.map((it) => {
            const body = <>{it.icon && <it.icon className="h-4 w-4" aria-hidden />}{it.label}</>;
            return it.to ? (
              <Link key={it.label} role="menuitem" to={it.to} className={itemCls} onClick={() => setOpen(false)}>{body}</Link>
            ) : (
              <button key={it.label} type="button" role="menuitem" className={itemCls} onClick={() => { setOpen(false); it.onClick?.(); }}>{body}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
