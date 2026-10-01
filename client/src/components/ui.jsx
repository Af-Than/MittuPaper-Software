import { Children, cloneElement, isValidElement, useId } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Inbox, RefreshCw } from 'lucide-react';
import { MONTHS, currentYearMonth } from '../lib/format';

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
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>{children}</span>;
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
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
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
    <div className="no-print mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 shadow-card">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${active ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:bg-primary-50 hover:text-primary'}`}
          >
            {t.label}
            {t.count != null && <span className={`ml-2 rounded-full px-1.5 text-xs ${active ? 'bg-white/20' : 'bg-canvas text-ink-muted'}`}>{t.count}</span>}
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
