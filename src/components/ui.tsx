import type { ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn, toEnglishDigits, parseNumericInput } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'brand' | 'accent' | 'success' | 'warning';
  to?: string;
}

const toneMap = {
  brand: 'bg-brand-50 text-brand-600',
  accent: 'bg-brand-50 text-brand-500',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
};

export function StatCard({ label, value, icon: Icon, tone = 'brand', to }: StatCardProps) {
  const content = (
    <div className="card card-hover group p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-500 uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 font-display text-2xl font-700 text-slate-900">{value}</p>
        </div>
        <div className={cn('rounded-xl p-2.5', toneMap[tone])}>
          <Icon size={20} />
        </div>
      </div>
      {to && (
        <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 transition group-hover:text-brand-600">
          View
        </div>
      )}
    </div>
  );
  return to ? <a href={to} className="block">{content}</a> : content;
}

interface FieldProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  step?: number;
  inputMode?: 'numeric' | 'decimal';
}

export function Field({ label, value, onChange, type = 'text', error, placeholder, required, min, step, inputMode }: FieldProps) {
  const handleNumeric = (raw: string) => {
    if (type === 'number') {
      const englished = toEnglishDigits(raw);
      onChange(englished);
    } else {
      onChange(raw);
    }
  };
  return (
    <div>
      <label className="label">{label}{required && <span className="text-danger-500"> *</span>}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => handleNumeric(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
        inputMode={inputMode ?? (type === 'number' ? 'decimal' : undefined)}
        dir={type === 'number' ? 'ltr' : undefined}
      />
      {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
    </div>
  );
}

interface NumberInputProps {
  label?: string;
  value: number | undefined | null;
  onChange: (v: number | undefined) => void;
  min?: number;
  step?: number;
  placeholder?: string;
  required?: boolean;
  className?: string;
  prefix?: string;
  dir?: 'ltr' | 'rtl';
}

export function NumberInput({ label, value, onChange, min = 0, step = 1, placeholder, required, className, prefix, dir = 'ltr' }: NumberInputProps) {
  const displayValue = value == null || (value === 0 && !required) ? '' : String(value);
  return (
    <div>
      {label && <label className="label">{label}{required && <span className="text-danger-500"> *</span>}</label>}
      <div className={cn('relative', className)}>
        <input
          type="text"
          inputMode={step === 1 ? 'numeric' : 'decimal'}
          className={cn('input', prefix && 'pl-8')}
          value={displayValue}
          onChange={(e) => {
            const parsed = parseNumericInput(e.target.value);
            onChange(parsed ?? undefined);
          }}
          onBlur={(e) => {
            const parsed = parseNumericInput(e.target.value);
            if (parsed != null && min != null && parsed < min) onChange(min);
          }}
          placeholder={placeholder}
          required={required}
          min={min}
          step={step}
          dir={dir}
        />
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{prefix}</span>}
      </div>
    </div>
  );
}

interface DataRowProps {
  label: string;
  value: ReactNode;
}

export function DataRow({ label, value }: DataRowProps) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value}</dd>
    </div>
  );
}

interface DetailRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

export function DetailRow({ icon: Icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg bg-slate-100 p-2 text-slate-500"><Icon size={16} /></div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-500 text-slate-800">{value}</p>
      </div>
    </div>
  );
}

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search…' }: SearchBarProps) {
  return (
    <div className="relative max-w-md">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input className="input pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-slide-in">
        <div className="card p-6">
          <h2 className="font-display text-lg font-600 text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{message}</p>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={onClose} className="btn-ghost">{cancelLabel}</button>
            <button onClick={() => { onConfirm(); onClose(); }} className={danger ? 'btn-danger' : 'btn-primary'}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <div className="rounded-2xl bg-danger-50 p-4 text-danger-500">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="text-sm text-slate-600">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn-ghost text-sm">Retry</button>}
    </div>
  );
}
