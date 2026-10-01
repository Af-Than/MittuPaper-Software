import { useState } from 'react';
import { Download, HandCoins, Receipt } from 'lucide-react';
import { api } from '../api';
import { download, errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { Badge, EmptyState, ErrorState, MonthYearPicker, PageHeader, Skeleton } from '../components/ui';
import SalaryPayModal from '../components/SalaryPayModal';
import SalarySlipModal from '../components/SalarySlipModal';
import { currentYearMonth, formatIST, initials, money } from '../lib/format';
import { salaryStatusMeta } from '../lib/expenseFormat';

export default function Salaries() {
  const toast = useToast();
  const [ym, setYm] = useState(currentYearMonth());
  const [payRow, setPayRow] = useState(null);
  const [slip, setSlip] = useState(null);
  const [exporting, setExporting] = useState(false);
  const { data, loading, error, reload } = useApi(() => api.salaryGrid(ym), [ym.year, ym.month]);

  const exportXlsx = async () => {
    setExporting(true);
    try {
      await download('/export/salaries', ym, `salary-register-${ym.year}-${ym.month}.xlsx`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader title="Salaries" subtitle="Pay employees for the month and track status" actions={<><button className="btn-secondary" onClick={exportXlsx} disabled={exporting}><Download className="h-4 w-4" /> Excel</button><MonthYearPicker year={ym.year} month={ym.month} onChange={setYm} /></>} />

      {error ? <div className="card"><ErrorState message={error} onRetry={reload} /></div> : loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card space-y-3 p-4"><Skeleton className="h-11 w-3/4" /><Skeleton className="h-10" /></div>)}</div>
      ) : !data.length ? (
        <div className="card"><EmptyState icon={HandCoins} title="No employees" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((row) => {
            const st = salaryStatusMeta(row.status.status);
            return (
              <article key={row.employee._id} className="card p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-700 to-primary-500 text-sm font-semibold text-white" aria-hidden>{initials(row.employee.name)}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-ink ml">{row.employee.name}</h3>
                    <p className="text-xs text-ink-muted">Base: {money(row.employee.monthlySalary)}</p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                {row.payment ? (
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                    <div>
                      <div className="font-semibold tabular-nums text-success">{money(row.payment.netPaid)}</div>
                      <div className="text-xs text-ink-muted">Paid {formatIST(row.payment.paidOn)}</div>
                    </div>
                    <button className="btn-secondary btn-sm" onClick={() => setSlip(row.payment._id)}><Receipt className="h-3.5 w-3.5" /> Slip</button>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                    {row.outstandingAdvance > 0 && <span className="text-xs text-warning">Advance due: {money(row.outstandingAdvance)}</span>}
                    <button className="btn-primary btn-sm ml-auto" onClick={() => setPayRow(row)}><HandCoins className="h-3.5 w-3.5" /> Pay salary</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <SalaryPayModal open={!!payRow} row={payRow} year={ym.year} month={ym.month} onClose={() => setPayRow(null)} onSaved={reload} />
      <SalarySlipModal open={!!slip} paymentId={slip} onClose={() => setSlip(null)} />
    </>
  );
}
