import { useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../api';
import { download, errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { ErrorState, MonthYearPicker, PageHeader, Skeleton, Tabs } from '../components/ui';
import { currentYearMonth, money, monthLabel } from '../lib/format';

const ROW = (label, key, bold) => ({ label, key, bold });
const ROWS = [ROW('Income collected', 'income'), ROW('Fuel', 'fuel'), ROW('Repairs', 'repairs'), ROW('Salaries', 'salaries'), ROW('Other expenses', 'other'), ROW('Publisher cost', 'publisherCost'), ROW('Total expenses', 'totalExpenses', true), ROW('Net profit / (loss)', 'netProfit', true)];

export default function ProfitLoss() {
  const toast = useToast();
  const [mode, setMode] = useState('month');
  const [ym, setYm] = useState(currentYearMonth());
  const [exporting, setExporting] = useState(false);
  const params = mode === 'month' ? ym : { year: ym.year };
  const { data: pnl, loading, error, reload } = useApi(() => api.profitLoss(params), [mode, ym.year, ym.month]);

  const exportXlsx = async () => {
    setExporting(true);
    try {
      await download('/export/profit-loss', params, 'profit-loss.xlsx');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader title="Profit & Loss" subtitle="Income against expenses, by category" actions={<button className="btn-secondary" onClick={exportXlsx} disabled={exporting}><Download className="h-4 w-4" /> Excel</button>} />

      <div className="card mb-5 flex flex-wrap items-end gap-4 p-4">
        <Tabs label="Period" value={mode} onChange={setMode} tabs={[{ key: 'month', label: 'Month' }, { key: 'year', label: 'Year' }]} />
        <MonthYearPicker year={ym.year} month={ym.month} onChange={setYm} hideMonth={mode === 'year'} />
      </div>

      <div className="card max-w-xl p-6">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading || !pnl ? <Skeleton className="h-64" /> : (
          <>
            <h2 className="mb-4 text-base font-semibold text-ink">{mode === 'month' ? monthLabel(ym.year, ym.month) : `Year ${ym.year}`}</h2>
            <dl className="space-y-1 text-sm">
              {ROWS.map((r) => (
                <div key={r.key} className={`flex justify-between py-1.5 ${r.bold ? 'border-t border-line pt-2 font-bold' : ''}`}>
                  <dt className={r.key !== 'income' && !r.bold ? 'text-ink-soft' : ''}>{r.label}</dt>
                  <dd className={`tabular-nums ${r.key === 'netProfit' ? (pnl.netProfit >= 0 ? 'text-success' : 'text-danger') : ''}`}>
                    {['fuel', 'repairs', 'salaries', 'other', 'publisherCost', 'totalExpenses'].includes(r.key) && pnl[r.key] > 0 ? '− ' : ''}{money(pnl[r.key])}
                  </dd>
                </div>
              ))}
            </dl>
            {pnl.marginPct != null && <p className="mt-4 text-right text-sm text-ink-muted">Net margin: <strong className="text-ink">{pnl.marginPct.toFixed(1)}%</strong></p>}
          </>
        )}
      </div>
    </>
  );
}
