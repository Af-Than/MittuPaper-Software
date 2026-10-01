import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

/** Confirmation for destructive actions. onConfirm may be async; the dialog closes on success. */
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', danger = true, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      size="sm"
      title={title}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy} data-autofocus>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={run} disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        {danger && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
        )}
        <div className="text-sm text-ink-soft">{message}</div>
      </div>
    </Modal>
  );
}
