import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'accent';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  brand: 'bg-brand-50 text-brand-600 border-brand-200',
  success: 'bg-success-500/15 text-success-500 border-success-500/30',
  warning: 'bg-warning-500/15 text-warning-400 border-warning-500/30',
  danger: 'bg-danger-500/15 text-danger-400 border-danger-500/30',
  accent: 'bg-brand-50 text-brand-500 border-accent-500/30',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('badge border', tones[tone], className)}>{children}</span>;
}

const statusMap: Record<string, Tone> = {
  active: 'success',
  draft: 'neutral',
  expired: 'danger',
  archived: 'neutral',
  cancelled: 'danger',
  scheduled: 'brand',
  completed: 'success',
  cancelled_visit: 'danger',
  unpaid: 'warning',
  paid: 'success',
  partial: 'brand',
  issued: 'warning',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const safeStatus = status ?? '';
  const tone = statusMap[safeStatus] ?? 'neutral';
  return <Badge tone={tone}>{label ?? (safeStatus.replace(/_/g, ' ') || '—')}</Badge>;
}
