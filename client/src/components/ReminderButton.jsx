import { useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { money, monthLabel } from '../lib/format';
import { BRAND } from '../lib/brand';

/** Builds the reminder text. `months` = ascending due-months list [{year, month, pending}]. */
function buildMessage(customerName, months, totalDue, lang) {
  const list = months.map((m) => `${monthLabel(m.year, m.month)}: ${money(m.pending)}`).join('\n');
  if (lang === 'ml') {
    return (
      `പ്രിയ ${customerName},\n\nനിങ്ങളുടെ പത്രം/മാസിക വിതരണത്തിന് താഴെ പറയുന്ന മാസങ്ങളിലെ തുക ബാക്കിയുണ്ട്:\n\n${list}\n\nമൊത്തം ബാക്കി: ${money(totalDue)}\n\nദയവായി എത്രയും വേഗം തുക അടയ്ക്കുക. നന്ദി.\n— ${BRAND.name}`
    );
  }
  return (
    `Dear ${customerName},\n\nThis is a reminder that your newspaper/magazine delivery payment is pending for:\n\n${list}\n\nTotal outstanding: ${money(totalDue)}\n\nKindly clear the dues at your earliest convenience. Thank you.\n— ${BRAND.name}`
  );
}

const digitsOnly = (phone) => (phone || '').replace(/\D/g, '');

/** "Copy reminder" + WhatsApp deep-link, with English/Malayalam templates. No WhatsApp API needed. */
export default function ReminderButton({ customerName, phone, months, totalDue, className = '' }) {
  const toast = useToast();
  const [lang, setLang] = useState('en');
  const [copied, setCopied] = useState(false);
  if (!months?.length) return null;

  const message = buildMessage(customerName, months, totalDue, lang);
  const waNumber = digitsOnly(phone);
  const waHref = `https://wa.me/91${waNumber}?text=${encodeURIComponent(message)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success('Reminder message copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — please copy manually');
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Reminder language">
        <button type="button" onClick={() => setLang('en')} aria-pressed={lang === 'en'} className={`rounded-md px-2.5 py-1 text-xs font-medium ${lang === 'en' ? 'bg-primary text-white' : 'text-ink-soft'}`}>EN</button>
        <button type="button" onClick={() => setLang('ml')} aria-pressed={lang === 'ml'} className={`rounded-md px-2.5 py-1 text-xs font-medium ${lang === 'ml' ? 'bg-primary text-white' : 'text-ink-soft'}`}>മലയാളം</button>
      </div>
      <button type="button" className="btn-secondary btn-sm" onClick={copy}>
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />} Copy reminder
      </button>
      <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm bg-success-soft text-success hover:bg-success-soft/80">
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </a>
    </div>
  );
}
