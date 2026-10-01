import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Fuel, Plus, Wrench } from 'lucide-react';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import { useCrumb } from '../components/AppLayout';
import { Badge, EmptyState, ErrorState, Skeleton } from '../components/ui';
import FuelEntryModal from '../components/FuelEntryModal';
import RepairEntryModal from '../components/RepairEntryModal';
import { formatIST, money } from '../lib/format';
import { FUEL_TYPE_LABEL, REPAIR_CATEGORY_LABEL, VEHICLE_STATUS_LABEL, VEHICLE_TYPE_LABEL } from '../lib/expenseFormat';

export default function VehicleDetail() {
  const { id } = useParams();
  const { data: vehicle, loading, error, reload } = useApi(() => api.vehicle(id), [id]);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);

  useCrumb(vehicle?.registrationNumber);

  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  if (loading && !vehicle) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  if (!vehicle) return null;

  // Running total chart: odometer vs date from fuel entries
  const chart = vehicle.fuel.map((f) => ({ date: f.fuelledAt.slice(0, 10), odometer: f.odometer }));

  const unifiedTimeline = [
    ...vehicle.fuel.map((f) => ({ kind: 'fuel', at: f.fuelledAt, label: `Fuel — ${f.litres}L`, amount: f.amount })),
    ...vehicle.repairs.map((r) => ({ kind: 'repair', at: r.repairedAt, label: `${REPAIR_CATEGORY_LABEL[r.category]} — ${r.description}`, amount: r.total })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <div className="space-y-6">
      <section className="card p-5" aria-label="Vehicle summary">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-ink">{vehicle.registrationNumber}</h1>
              <Badge tone={vehicle.status === 'active' ? 'success' : vehicle.status === 'in-repair' ? 'warning' : 'neutral'}>{VEHICLE_STATUS_LABEL[vehicle.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{vehicle.makeModel || VEHICLE_TYPE_LABEL[vehicle.type]} · {FUEL_TYPE_LABEL[vehicle.fuelType]} · {vehicle.odometer} km · {vehicle.assignedEmployee?.name || 'Unassigned'}</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setFuelOpen(true)}><Fuel className="h-3.5 w-3.5" /> Add fuel</button>
            <button className="btn-secondary btn-sm" onClick={() => setRepairOpen(true)}><Wrench className="h-3.5 w-3.5" /> Add repair</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div><div className="text-xs text-ink-muted">Total spent</div><div className="text-lg font-bold">{money(vehicle.stats.totalSpent)}</div></div>
          <div><div className="text-xs text-ink-muted">Fuel</div><div className="text-lg font-bold">{money(vehicle.stats.totalFuel)}</div></div>
          <div><div className="text-xs text-ink-muted">Repairs</div><div className="text-lg font-bold">{money(vehicle.stats.totalRepairs)}</div></div>
          <div><div className="text-xs text-ink-muted">Avg mileage</div><div className="text-lg font-bold">{vehicle.stats.averageMileage ? vehicle.stats.averageMileage.toFixed(1) : '—'} km/unit</div></div>
        </div>
      </section>

      <section className="card p-5" aria-label="Odometer over time">
        <h2 className="mb-3 text-base font-semibold text-ink">Odometer over time</h2>
        {chart.length < 2 ? <EmptyState title="Not enough data yet" message="Add more fuel entries to see the trend." /> : (
          <div className="h-56" role="img" aria-label="Line chart of odometer reading over time">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgb(219 227 239)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: 'rgb(219 227 239)' }} tick={{ fontSize: 11, fill: 'rgb(107 122 148)' }} />
                <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 12, fill: 'rgb(107 122 148)' }} />
                <Tooltip />
                <Line dataKey="odometer" stroke="rgb(47 111 208)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card" aria-label="Fuel log">
          <div className="border-b border-line px-5 py-4"><h2 className="text-base font-semibold text-ink">Fuel log</h2></div>
          {!vehicle.fuel.length ? <EmptyState icon={Fuel} title="No fuel entries" /> : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface"><tr className="border-b border-line"><th className="th">Date</th><th className="th text-right">Litres</th><th className="th text-right">Amount</th><th className="th text-right">Odo</th></tr></thead>
                <tbody>
                  {[...vehicle.fuel].reverse().map((f) => (
                    <tr key={f._id} className="border-b border-line/60 last:border-0">
                      <td className="td whitespace-nowrap">{formatIST(f.fuelledAt)}</td>
                      <td className="td text-right tabular-nums">{f.litres}</td>
                      <td className="td text-right tabular-nums">{money(f.amount)}</td>
                      <td className="td text-right tabular-nums">{f.odometer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card" aria-label="Repair log">
          <div className="border-b border-line px-5 py-4"><h2 className="text-base font-semibold text-ink">Repair log</h2></div>
          {!vehicle.repairs.length ? <EmptyState icon={Wrench} title="No repair entries" /> : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface"><tr className="border-b border-line"><th className="th">Date</th><th className="th">Category</th><th className="th text-right">Total</th><th className="th">Status</th></tr></thead>
                <tbody>
                  {vehicle.repairs.map((r) => (
                    <tr key={r._id} className="border-b border-line/60 last:border-0">
                      <td className="td whitespace-nowrap">{formatIST(r.repairedAt)}</td>
                      <td className="td">{REPAIR_CATEGORY_LABEL[r.category]}</td>
                      <td className="td text-right tabular-nums">{money(r.total)}</td>
                      <td className="td"><Badge tone={r.status === 'pending' ? 'warning' : 'success'}>{r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card p-5" aria-label="Documents">
        <h2 className="mb-3 text-base font-semibold text-ink">Documents</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[['Insurance', vehicle.insuranceExpiry], ['PUC', vehicle.pollutionExpiry], ['Fitness', vehicle.fitnessExpiry]].map(([label, date]) => (
            <div key={label} className="rounded-lg border border-line p-3 text-sm"><div className="text-ink-muted">{label}</div><div className="font-medium">{date ? formatIST(date).split(',')[0] : 'Not set'}</div></div>
          ))}
        </div>
      </section>

      <section className="card p-5" aria-label="Timeline">
        <h2 className="mb-3 text-base font-semibold text-ink">Unified timeline</h2>
        {!unifiedTimeline.length ? <EmptyState title="No events yet" /> : (
          <ol className="relative ml-2 max-h-96 space-y-4 overflow-y-auto border-l-2 border-primary-100 pl-6">
            {unifiedTimeline.map((e, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ${e.kind === 'fuel' ? 'bg-primary' : 'bg-warning'}`} aria-hidden />
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>{e.label}</span>
                  <span className="font-medium tabular-nums">{money(e.amount)}</span>
                </div>
                <p className="text-xs text-ink-muted">{formatIST(e.at)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <FuelEntryModal open={fuelOpen} vehicle={vehicle} onClose={() => setFuelOpen(false)} onSaved={reload} />
      <RepairEntryModal open={repairOpen} vehicle={vehicle} onClose={() => setRepairOpen(false)} onSaved={reload} />
    </div>
  );
}
