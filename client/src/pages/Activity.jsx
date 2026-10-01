import { useState } from 'react';
import { CheckCircle2, History, ShieldAlert, XCircle } from 'lucide-react';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, Tabs, TableSkeleton } from '../components/ui';
import { describeUserAgent, formatDateTime } from '../lib/format';

const ACTION_LABEL = {
  'rate.changed': ['Rate changed', 'warning'],
  'payment.recorded': ['Payment', 'success'],
  'bill.generated': ['Bill generated', 'primary'],
  'bill.regenerated': ['Bill refreshed', 'primary'],
  'customer.deleted': ['Customer deleted', 'danger'],
  'customer.created': ['Customer added', 'neutral'],
  'customer.updated': ['Customer edited', 'neutral'],
  'publication.created': ['Publication added', 'neutral'],
  'publication.updated': ['Publication edited', 'neutral'],
  'subscription.created': ['Subscription added', 'neutral'],
  'subscription.updated': ['Subscription edited', 'neutral'],
  'subscription.deleted': ['Subscription removed', 'neutral'],
};

function Logins() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(() => api.logins({ page, limit: 20 }), [page]);
  return (
    <>
      <div className="card overflow-hidden">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={8} cols={5} /> : data.items.length === 0 ? (
          <EmptyState icon={History} title="No logins yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas/60"><tr><th className="th">Administrator</th><th className="th">When</th><th className="th">IP address</th><th className="th">Browser / device</th><th className="th">Result</th></tr></thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l._id} className="border-b border-line/60 hover:bg-canvas/50">
                    <td className="td"><div className="font-medium">{l.adminName || l.username}</div><div className="text-xs text-ink-muted">@{l.username}</div></td>
                    <td className="td whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td className="td font-mono text-xs">{l.ip || '—'}</td>
                    <td className="td text-ink-soft" title={l.userAgent}>{describeUserAgent(l.userAgent)}</td>
                    <td className="td">{l.success ? <Badge tone="success"><CheckCircle2 className="h-3 w-3" aria-hidden /> Success</Badge> : <Badge tone="danger"><XCircle className="h-3 w-3" aria-hidden /> Failed</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
    </>
  );
}

function Audit() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(() => api.audit({ page, limit: 20 }), [page]);
  return (
    <>
      <div className="card overflow-hidden">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={8} cols={4} /> : data.items.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="No activity yet" message="Rate changes, payments, bill generation and deletions are recorded here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas/60"><tr><th className="th">When</th><th className="th">Administrator</th><th className="th">Action</th><th className="th">Details</th></tr></thead>
              <tbody>
                {data.items.map((a) => {
                  const [label, tone] = ACTION_LABEL[a.action] || [a.action, 'neutral'];
                  return (
                    <tr key={a._id} className="border-b border-line/60 hover:bg-canvas/50">
                      <td className="td whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                      <td className="td font-medium">{a.adminName || '—'}</td>
                      <td className="td"><Badge tone={tone}>{label}</Badge></td>
                      <td className="td text-ink-soft ml">{a.summary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
    </>
  );
}

export default function Activity() {
  const [tab, setTab] = useState('logins');
  return (
    <>
      <PageHeader title="Activity & Logins" subtitle="Both administrators can see every sign-in and key action" />
      <div className="mb-4"><Tabs label="Activity" value={tab} onChange={setTab} tabs={[{ key: 'logins', label: 'Login history' }, { key: 'audit', label: 'Audit log' }]} /></div>
      {tab === 'logins' ? <Logins /> : <Audit />}
    </>
  );
}
