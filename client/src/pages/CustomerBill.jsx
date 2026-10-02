import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, FileText, HandCoins, Printer, RefreshCw, TriangleAlert } from 'lucide-react';
import { api } from '../api';
import { download, errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useAllCustomers } from '../hooks/useAllCustomers';
import { useToast } from '../context/ToastContext';
import { BRAND } from '../lib/brand';
import { Badge, EmptyState, ErrorState, MonthYearPicker, PageHeader, Skeleton, StatusBadge, Tabs, shiftMonth } from '../components/ui';
import PaymentModal from '../components/PaymentModal';
import ReminderButton from '../components/ReminderButton';
import { LogoMark } from '../components/Logo';
import { WEEKDAYS, currentYearMonth, formatDate, formatDateTime, money, monthLabel } from '../lib/format';

function RateCell({ line }) {
  if (line.segments?.length > 1) {
    return (
      <div className="space-y-0.5 text-right">
        {line.segments.map((s) => <div key={s.ratePerCopy} className="whitespace-nowrap text-xs text-ink-soft">{money(s.ratePerCopy)} × {s.copies}</div>)}
      </div>
    );
  }
  return <span className="tabular-nums">{money(line.ratePerCopy)}</span>;
}

/** "Month | Billed | Paid | Pending", ending in a grand total — never a single rolled-up number. */
function PreviousDuesTable({ breakdown }) {
  if (!breakdown.length) return null;
  const total = breakdown.reduce((n, d) => n + d.pending, 0);
  return (
    <div className="avoid-break border-t border-line px-6 py-5">
      <h3 className="mb-1 text-sm font-semibold text-ink">Previous dues</h3>
      <p className="mb-3 text-xs text-ink-muted">
        Pending since {monthLabel(breakdown[0].year, breakdown[0].month)} ({breakdown.length} month{breakdown.length > 1 ? 's' : ''})
      </p>
      <table className="w-full max-w-md text-sm">
        <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted"><th className="py-1.5 text-left">Month</th><th className="py-1.5 text-right">Billed</th><th className="py-1.5 text-right">Paid</th><th className="py-1.5 text-right">Pending</th></tr></thead>
        <tbody>
          {breakdown.map((d) => (
            <tr key={d.billId} className="border-b border-line/60">
              <td className="py-1.5">{monthLabel(d.year, d.month)}</td>
              <td className="py-1.5 text-right tabular-nums text-ink-soft">{money(d.billed)}</td>
              <td className="py-1.5 text-right tabular-nums text-success">{money(d.paid)}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{money(d.pending)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="font-semibold"><td className="py-1.5" colSpan={3}>Total previous dues</td><td className="py-1.5 text-right tabular-nums">{money(total)}</td></tr></tfoot>
      </table>
    </div>
  );
}

export default function CustomerBill() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const now = currentYearMonth();
  const customerId = params.get('customer') || '';
  const year = Number(params.get('year')) || now.year;
  const month = Number(params.get('month')) || now.month;
  const [tab, setTab] = useState('invoice');
  const [busy, setBusy] = useState('');
  const [payOpen, setPayOpen] = useState(false);

  const customers = useAllCustomers();
  const view = useApi(() => api.billView({ customer: customerId, year, month }), [customerId, year, month], { enabled: !!customerId });
  const due = useApi(() => api.paymentsDue(customerId), [customerId], { enabled: !!customerId });

  const setQuery = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  const setMonth = ({ year: y, month: m }) => setQuery({ year: y, month: m });

  const v = view.data;
  const bill = v?.bill;
  // Show the saved bill when it exists, otherwise a live preview
  const doc = useMemo(() => (bill ? bill : v ? { ...v.computed, status: null } : null), [bill, v]);
  const customer = v?.customer;
  const dueBreakdown = doc?.dueBreakdown || [];

  const generate = async () => {
    setBusy('generate');
    try {
      await api.generateBill({ customer: customerId, year, month });
      toast.success(bill ? 'Bill refreshed' : `${monthLabel(year, month)} bill generated`);
      await Promise.all([view.reload(), due.reload()]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const exportXlsx = async () => {
    if (!bill) return toast.info('Generate the bill first, then download it.');
    setBusy('excel');
    try {
      await download('/export/bill', { customer: customerId, year, month }, 'bill.xlsx');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const delivered = doc?.days?.filter((d) => d.copies > 0) || [];

  return (
    <>
      <PageHeader title="Customer Monthly Bill" subtitle="Invoice, daily breakdown, payment and Excel export for one customer" />

      {/* Controls */}
      <div className="card no-print mb-5 flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-[240px] flex-1">
          <label htmlFor="bill-customer" className="mb-1 block text-sm font-medium text-ink">Customer</label>
          <select id="bill-customer" className="input ml" value={customerId} onChange={(e) => setQuery({ customer: e.target.value })}>
            <option value="">Select a customer…</option>
            {(customers.data || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-ink">Month</span>
          <div className="flex items-center gap-2">
            <button className="btn-secondary px-2.5" onClick={() => setMonth(shiftMonth({ year, month }, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
            <MonthYearPicker year={year} month={month} onChange={setMonth} />
            <button className="btn-secondary px-2.5" onClick={() => setMonth(shiftMonth({ year, month }, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {!customerId ? (
        <div className="card"><EmptyState icon={FileText} title="Choose a customer" message="Pick a customer and a month to see their invoice and day-by-day breakdown." /></div>
      ) : view.error ? (
        <div className="card"><ErrorState message={view.error} onRetry={view.reload} /></div>
      ) : !doc ? (
        <div className="card space-y-4 p-6"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-40" /><Skeleton className="h-24 w-1/2" /></div>
      ) : (
        <>
          {/* Banners */}
          <div className="no-print space-y-3">
            {!bill && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800" role="status">
                <FileText className="h-5 w-5 shrink-0" aria-hidden />
                <span className="flex-1">This is a <strong>preview</strong>. The bill for {monthLabel(year, month)} has not been generated yet.</span>
              </div>
            )}
            {v.stale && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning" role="status">
                <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
                <span className="flex-1">Subscriptions, adjustments or earlier bills changed after this bill was generated (current figures: {money(v.computed.totalPayable)}). Refresh to update it.</span>
                <button className="btn-secondary btn-sm" onClick={generate} disabled={!!busy}><RefreshCw className="h-3.5 w-3.5" /> Refresh now</button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="no-print mb-4 mt-4 flex flex-wrap items-center justify-between gap-3">
            <Tabs label="Bill view" value={tab} onChange={setTab} tabs={[{ key: 'invoice', label: 'Invoice' }, { key: 'daily', label: 'Daily breakdown', count: delivered.length }]} />
            <div className="flex flex-wrap gap-2">
              {(!bill || !(bill.balance === 0 && bill.amountPaid > 0)) && (
                <button className="btn-primary" onClick={generate} disabled={!!busy}><RefreshCw className={`h-4 w-4 ${busy === 'generate' ? 'animate-spin' : ''}`} /> {bill ? 'Refresh bill' : 'Generate bill'}</button>
              )}
              <button className="btn-secondary" onClick={() => setPayOpen(true)} disabled={!due.data?.totalDue} title={!due.data?.totalDue ? 'No pending balance' : ''}><HandCoins className="h-4 w-4" /> Record payment</button>
              <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
              <button className="btn-secondary" onClick={exportXlsx} disabled={busy === 'excel'}><Download className="h-4 w-4" /> Excel</button>
            </div>
          </div>

          {due.data?.totalDue > 0 && (
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
              <span className="text-sm text-ink-soft">Send a reminder for <strong className="text-ink">{money(due.data.totalDue)}</strong> across {due.data.months.length} month{due.data.months.length > 1 ? 's' : ''}:</span>
              <ReminderButton customerName={customer.name} phone={customer.phone} months={due.data.months} totalDue={due.data.totalDue} />
            </div>
          )}

          {/* Invoice (print area) */}
          <section className="card print-area overflow-hidden" aria-label="Bill">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-surface px-6 py-5 text-ink">
              <div className="flex items-center gap-3">
                <LogoMark className="h-11 w-11" />
                <div>
                  <div className="text-lg font-bold">{BRAND.name}</div>
                  <div className="text-xs text-ink-muted">{BRAND.longTagline}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-ink-muted">Statement for</div>
                <div className="text-xl font-bold">{monthLabel(year, month)}</div>
                {bill && <div className="text-xs text-ink-muted">Generated {formatDateTime(bill.generatedAt)}</div>}
              </div>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Billed to</div>
                <div className="mt-1 text-lg font-semibold text-ink ml">{customer.name}</div>
                <div className="max-w-sm text-sm text-ink-soft ml">{customer.address}</div>
                <div className="text-sm text-ink-soft">{customer.phone}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Status</div>
                <div className="mt-1">{bill ? <StatusBadge status={bill.status} /> : <Badge tone="primary">Preview</Badge>}</div>
              </div>
            </div>

            <div className={tab === 'invoice' ? '' : 'hidden'}>
              <div className="overflow-x-auto px-6">
                <table className="w-full text-sm">
                  <thead><tr className="border-y border-line bg-canvas/70"><th className="th px-3">Publication</th><th className="th px-3 text-right">Copies</th><th className="th px-3 text-right">Rate / copy</th><th className="th px-3 text-right">Amount</th></tr></thead>
                  <tbody>
                    {doc.lineItems.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-ink-muted">No subscriptions are active in this month.</td></tr>}
                    {doc.lineItems.map((l) => (
                      <tr key={l.publicationId || l.publication} className="border-b border-line/60">
                        <td className="px-3 py-3">
                          <div className="font-medium text-ink ml">{l.publicationName}</div>
                          {(l.skippedCopies > 0 || l.extraCopies > 0) && (
                            <div className="text-xs text-ink-muted">{l.skippedCopies > 0 && `${l.skippedCopies} skipped`}{l.skippedCopies > 0 && l.extraCopies > 0 && ' · '}{l.extraCopies > 0 && `${l.extraCopies} extra`}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{l.copies}</td>
                        <td className="px-3 py-3 text-right"><RateCell line={l} /></td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">{money(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PreviousDuesTable breakdown={dueBreakdown} />

              <div className="flex justify-end px-6 py-5">
                <dl className="avoid-break w-full max-w-sm space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-ink-soft">Current charges</dt><dd className="tabular-nums">{money(doc.currentCharges)}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-soft">Previous dues {dueBreakdown.length ? `(${dueBreakdown.length} mo, see above)` : ''}</dt><dd className="tabular-nums">{money(doc.previousDue)}</dd></div>
                  <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total payable</dt><dd className="tabular-nums">{money(doc.totalPayable)}</dd></div>
                  {bill && <div className="flex justify-between"><dt className="text-ink-soft">Paid this month</dt><dd className="tabular-nums text-success">− {money(bill.amountPaid)}</dd></div>}
                  {bill && (
                    <div className={`flex justify-between rounded-lg px-3 py-2 text-base font-bold ${bill.balance === 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
                      <dt>{bill.balance === 0 ? 'This month cleared' : 'This month\'s balance'}</dt><dd className="tabular-nums">{money(bill.balance)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Daily breakdown: shown on its tab, and always printed after the invoice */}
            <div className={tab === 'daily' ? 'border-t border-line' : 'hidden print:block print:border-t print:border-line print:break-before-page'}>
              <h2 className="px-6 pt-5 text-base font-semibold text-ink">Day-by-day breakdown <span className="font-normal text-ink-muted">· {monthLabel(year, month)}</span></h2>
              <div className="overflow-x-auto px-6 py-4">
                <table className="w-full text-sm">
                  <thead><tr className="border-y border-line bg-canvas/70"><th className="th px-3">Date</th><th className="th px-3">Day</th><th className="th px-3">Delivered</th><th className="th px-3 text-right">Copies</th><th className="th px-3 text-right">Amount</th><th className="th px-3 text-right">Running total</th></tr></thead>
                  <tbody>
                    {doc.days.map((d) => (
                      <tr key={d.date} className={`border-b border-line/50 ${d.copies === 0 ? 'text-ink-muted' : ''} ${d.weekday === 0 ? 'bg-canvas/60' : ''}`}>
                        <td className="whitespace-nowrap px-3 py-2">{formatDate(d.date)}</td>
                        <td className="px-3 py-2">{WEEKDAYS[d.weekday]}</td>
                        <td className="px-3 py-2 ml">{d.items.length ? d.items.map((i) => `${i.publicationName}${i.copies > 1 ? ` ×${i.copies}` : ''}`).join(', ') : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{d.copies}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(d.amount)}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{money(d.runningTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-primary font-bold"><td className="px-3 py-2" colSpan={3}>Total</td><td className="px-3 py-2 text-right tabular-nums">{doc.days.reduce((n, d) => n + d.copies, 0)}</td><td className="px-3 py-2 text-right tabular-nums">{money(doc.currentCharges)}</td><td /></tr></tfoot>
                </table>
              </div>
            </div>

            <p className="border-t border-line px-6 py-3 text-center text-xs text-ink-muted">Thank you. Amounts are in Indian Rupees (₹). · {BRAND.name}</p>
          </section>

          <PaymentModal open={payOpen} customerId={customerId} customerName={customer.name} onClose={() => setPayOpen(false)} onSaved={() => { view.reload(); due.reload(); }} />
        </>
      )}
    </>
  );
}
