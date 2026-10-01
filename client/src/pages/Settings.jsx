import { Download } from 'lucide-react';
import { api } from '../api';
import { PageHeader } from '../components/ui';
import { BRAND } from '../lib/brand';

export default function Settings() {
  const downloadBackup = () => {
    // Direct navigation streams the file with the session cookie; a fetch+blob isn't needed for a GET download.
    window.location.href = api.backupUrl();
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Branding and data backup" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-label="Branding">
          <h2 className="mb-2 text-base font-semibold text-ink">Branding</h2>
          <p className="mb-3 text-sm text-ink-soft">
            The business name shown across the app, on invoices and in Excel exports is set in one place for each side of the app:
          </p>
          <ul className="space-y-1 text-sm text-ink-soft">
            <li><code className="rounded bg-canvas px-1.5 py-0.5 text-xs">client/src/lib/brand.js</code> — name, tagline (shown in the UI)</li>
            <li><code className="rounded bg-canvas px-1.5 py-0.5 text-xs">server/config/brand.js</code> — name (used in Excel exports)</li>
          </ul>
          <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm">
            Current name: <strong className="text-ink">{BRAND.name}</strong> — <span className="text-ink-muted">{BRAND.longTagline}</span>
          </p>
        </section>

        <section className="card p-5" aria-label="Backup">
          <h2 className="mb-2 text-base font-semibold text-ink">Data backup</h2>
          <p className="mb-3 text-sm text-ink-soft">Download a full JSON export of customers, publications, bills, payments and the expense module. Keep it somewhere safe.</p>
          <button className="btn-primary" onClick={downloadBackup}><Download className="h-4 w-4" /> Download full data backup (JSON)</button>
        </section>
      </div>
    </>
  );
}
