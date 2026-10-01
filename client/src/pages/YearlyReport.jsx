import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Download } from 'lucide-react';
import { api } from '../api';
import { download, errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useAllCustomers } from '../hooks/useAllCustomers';
import { useToast } from '../context/ToastContext';
import { EmptyState, ErrorState, MonthYearPicker, PageHeader, TableSkeleton } from '../components/ui';
import { MONTHS_SHORT, currentYearMonth, money } from '../lib/format';

export default function YearlyReport() {
  const toast = useToast();
  const [year, setYear] = useState(currentYearMonth().year);
  const [customer, setCustomer] = useState('');
  const [exporting, setExporting] = useState(false);
  const customers = useAllCustomers();
  const { data, loading, error, reload } = useApi(() => api.yearly({ year, customer: customer || undefined }), [year, customer]);

  const exportXlsx = async () => {
    setExporting(true);
    try {
      await download('/export/yearly', { year, customer: customer || undefined }, `yearly-report-${year}.xlsx`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const cell = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';

  return (
    <>
      <PageHeader
        title="Yearly Report"
        subtitle="Billed, paid and balance for every month of the year"
        actions={<button className="btn-secondary" onClick={exportXlsx} disabled={exporting || !data?.rows.length}><Download className="h-4 w-4" /> Excel</button>}
      />

      <div className="card mb-5 flex flex-wrap items-end gap-4 p-4">
        <div><span className="mb-1 block text-sm font-medium text-ink">Year</span><MonthYearPicker year={year} month={1} hideMonth onChange={({ year: y }) => setYear(y)} /></div>
        <div className="min-w-[240px] flex-1 sm:max-w-sm">
          <label htmlFor="yr-customer" className="mb-1 block text-sm font-medium text-ink">Customer</label>
          <select id="yr-customer" className="input ml" value={customer} onChange={(e) => setCustomer(e.target.value)}>
            <option value="">All customers</option>
            {(customers.data || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={8} cols={8} /> : data.rows.length === 0 ? (
          <EmptyState icon={CalendarRange} title={`No bills in ${year}`} message="Generate monthly bills and they will appear in this report." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-line bg-canvas/70">
                    <th rowSpan={2} className="th sticky left-0 z-10 min-w-[180px] bg-canvas align-bottom">Customer</th>
                    {MONTHS_SHORT.map((m) => <th key={m} colSpan={3} className="border-l border-line px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-primary">{m}</th>)}
                    <th colSpan={3} className="border-l-2 border-primary px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-primary">Total {year}</th>
                  </tr>
                  <tr className="border-b border-line bg-canvas/70">
                    {MONTHS_SHORT.map((m) => ['Billed', 'Paid', 'Balance'].map((h, i) => <th key={m + h} className={`px-3 pb-2 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-muted ${i === 0 ? 'border-l border-line' : ''}`}>{h}</th>))}
                    {['Billed', 'Paid', 'Outstanding'].map((h, i) => <th key={h} className={`px-3 pb-2 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-muted ${i === 0 ? 'border-l-2 border-primary' : ''}`}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.customer.id} className="border-b border-line/60 hover:bg-canvas/50">
                      <td className="sticky left-0 z-10 bg-surface px-3 py-2 text-sm font-medium"><Link className="ml hover:text-primary hover:underline" to={`/customers/${r.customer.id}`}>{r.customer.name}</Link></td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const c = r.months[m];
                        return [
                          <td key={`${m}b`} className={`${cell} border-l border-line`}>{c ? money(c.billed) : <span className="text-ink-muted">—</span>}</td>,
                          <td key={`${m}p`} className={`${cell} text-success`}>{c ? money(c.paid) : ''}</td>,
                          <td key={`${m}d`} className={`${cell} ${c && c.balance > 0 ? 'font-medium text-danger' : 'text-ink-muted'}`}>{c ? money(c.balance) : ''}</td>,
                        ];
                      })}
                      <td className={`${cell} border-l-2 border-primary font-semibold`}>{money(r.totalBilled)}</td>
                      <td className={`${cell} font-semibold text-success`}>{money(r.totalPaid)}</td>
                      <td className={`${cell} font-semibold ${r.outstanding > 0 ? 'text-danger' : 'text-ink-muted'}`}>{money(r.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-primary bg-primary-50/70 font-bold">
                    <td className="sticky left-0 z-10 bg-primary-50 px-3 py-2.5 text-sm">Total</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => [
                      <td key={`${m}b`} className={`${cell} border-l border-line`}>{money(data.monthTotals[m].billed)}</td>,
                      <td key={`${m}p`} className={`${cell} text-success`}>{money(data.monthTotals[m].paid)}</td>,
                      <td key={`${m}d`} className={`${cell} text-danger`}>{money(data.monthTotals[m].balance)}</td>,
                    ])}
                    <td className={`${cell} border-l-2 border-primary`}>{money(data.totals.billed)}</td>
                    <td className={`${cell} text-success`}>{money(data.totals.paid)}</td>
                    <td className={`${cell} text-danger`}>{money(data.totals.outstanding)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">
              Balance = what the customer still owed after that month's bill (it includes dues carried from earlier months). Outstanding = the balance on the customer's last bill of the year.
            </p>
          </>
        )}
      </div>
    </>
  );
}
