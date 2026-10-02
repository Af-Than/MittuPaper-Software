import { BRAND } from '../lib/brand';

export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="rgb(44 83 146)" />
      <path d="M11 11h14a4 4 0 0 1 4 4v14H15a4 4 0 0 1-4-4V11z" fill="#fff" />
      <path d="M15 17h10M15 21h10M15 25h6" stroke="rgb(44 83 146)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="30" cy="12" r="3.2" fill="rgb(205 220 241)" />
    </svg>
  );
}

/** Wordmark; name and tagline come from lib/brand.js */
export default function Logo({ light = false, showTagline = true }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div className="leading-tight">
        <div className={`text-base font-semibold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>{BRAND.name}</div>
        {showTagline && <div className={`text-[11px] font-medium ${light ? 'text-primary-200' : 'text-ink-muted'}`}>{BRAND.tagline}</div>}
      </div>
    </div>
  );
}
