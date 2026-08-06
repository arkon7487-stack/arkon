import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin } from 'lucide-react';
import { visitService } from '@/services/visitService';
import type { VisitWithRelations } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { useToast } from '@/components/Toast';
import { cn, initials, formatDate } from '@/lib/utils';
import { useVisitRealtime } from '@/lib/qr/useQrScanner';

type ViewMode = 'daily' | 'weekly' | 'monthly';
type FilterMode = 'all' | 'employee' | 'client';

const VIEW_LABELS: Record<ViewMode, string> = {
  daily: 'يومي',
  weekly: 'أسبوعي',
  monthly: 'شهري',
};

const FILTER_LABELS: Record<FilterMode, string> = {
  all: 'الكل',
  employee: 'موظف',
  client: 'عميل',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'في الانتظار',
  scheduled: 'مجدول',
  started: 'جاري التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  archived: 'مؤرشف',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-500',
  scheduled: 'bg-brand-500',
  started: 'bg-warning-500',
  completed: 'bg-success-500',
  cancelled: 'bg-danger-500',
  archived: 'bg-slate-300',
};

export function CalendarPage() {
  const toast = useToast();
  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('weekly');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [currentDate, setCurrentDate] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - 30);
      const end = new Date(currentDate);
      end.setDate(end.getDate() + 60);
      setVisits(await visitService.getByDateRange(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)));
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [currentDate, toast]);

  useEffect(() => { load(); }, [load]);

  useVisitRealtime(() => { load(); });

  if (loading) return <PageLoader label="جاري تحميل التقويم…" />;

  const navigate = (direction: number) => {
    const d = new Date(currentDate);
    if (view === 'daily') d.setDate(d.getDate() + direction);
    else if (view === 'weekly') d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    setCurrentDate(d);
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const visitsForDate = (dateStr: string) => visits.filter((v) => v.scheduled_date === dateStr);

  const weekDays = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const monthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  };

  const headerLabel = () => {
    if (view === 'daily') return currentDate.toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (view === 'weekly') {
      const days = weekDays();
      return `${days[0].toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  };

  const renderVisitChip = (v: VisitWithRelations) => (
    <div key={v.id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-xs">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[v.status] ?? 'bg-slate-500')} />
      <span className="truncate text-slate-800">{v.contract?.client?.full_name}</span>
      <span className="text-slate-9000">{v.scheduled_start_time ?? ''}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">التقويم</h1>
          <p className="mt-1 text-sm text-slate-500">تقويم زيارات المؤسسة مع ألوان الحالة اللحظية.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-white p-1">
            {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((m) => (
              <button key={m} onClick={() => setView(m)} className={cn('rounded-md px-3 py-1.5 text-sm font-500 transition', view === m ? 'bg-brand-500 text-white' : 'text-slate-500 hover:text-slate-800')}>{VIEW_LABELS[m]}</button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg bg-white p-1">
            {(['all', 'employee', 'client'] as FilterMode[]).map((f) => (
              <button key={f} onClick={() => setFilterMode(f)} className={cn('rounded-md px-3 py-1.5 text-sm font-500 transition', filterMode === f ? 'bg-brand-50 text-brand-500' : 'text-slate-500 hover:text-slate-800')}>{FILTER_LABELS[f]}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-ghost"><ChevronLeft size={16} /></button>
        <p className="font-display text-lg font-600 text-slate-900">{headerLabel()}</p>
        <button onClick={() => navigate(1)} className="btn-ghost"><ChevronRight size={16} /></button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={cn('h-2.5 w-2.5 rounded-full', color)} /> {STATUS_LABELS[status] ?? status}
          </div>
        ))}
      </div>

      {visits.length === 0 ? (
        <div className="card"><EmptyState icon={<CalendarIcon size={32} />} title="لا توجد زيارات مجدولة" description="فعّل العقود لإنشاء الزيارات." /></div>
      ) : view === 'daily' ? (
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarIcon size={18} className="text-brand-600" />
            <p className="font-display text-sm font-600 text-slate-900">{currentDate.toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="space-y-2">
            {visitsForDate(currentDate.toISOString().slice(0, 10)).length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-9000">لا توجد زيارات مجدولة لهذا اليوم.</p>
            ) : (
              visitsForDate(currentDate.toISOString().slice(0, 10)).map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <span className={cn('h-3 w-3 rounded-full', STATUS_COLORS[v.status])} />
                  <div className="flex-1">
                    <p className="text-sm font-600 text-slate-900">{v.contract?.client?.full_name}</p>
                    <p className="text-xs text-slate-9000">{v.contract?.package?.name} · {v.scheduled_start_time ?? '—'}</p>
                  </div>
                  {v.employee && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-[10px] font-700 text-brand-500">{initials(v.employee.full_name)}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      ) : view === 'weekly' ? (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200">
            {weekDays().map((d) => (
              <div key={d.toISOString()} className={cn('border-r border-slate-200 px-3 py-2 text-center', d.toISOString().slice(0, 10) === todayStr && 'bg-brand-50')}>
                <p className="text-xs font-600 uppercase text-slate-500">{d.toLocaleDateString('ar-EG', { weekday: 'short' })}</p>
                <p className="text-sm font-600 text-slate-800">{d.getDate()}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {weekDays().map((d) => {
              const dayVisits = visitsForDate(d.toISOString().slice(0, 10));
              return (
                <div key={d.toISOString()} className="min-h-32 border-r border-slate-200 p-2">
                  <div className="space-y-1">
                    {dayVisits.slice(0, 4).map(renderVisitChip)}
                    {dayVisits.length > 4 && <p className="text-[10px] text-slate-9000">+{dayVisits.length - 4} زيارة</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200">
            {['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((d) => (
              <div key={d} className="border-r border-slate-200 px-3 py-2 text-center text-xs font-600 uppercase text-slate-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays().map((d, i) => {
              if (!d) return <div key={i} className="min-h-24 border-r border-b border-slate-200 bg-slate-50" />;
              const dayVisits = visitsForDate(d.toISOString().slice(0, 10));
              return (
                <div key={i} className={cn('min-h-24 border-r border-b border-slate-200 p-1.5', d.toISOString().slice(0, 10) === todayStr && 'bg-brand-50')}>
                  <p className={cn('mb-1 text-xs font-600', d.toISOString().slice(0, 10) === todayStr ? 'text-brand-600' : 'text-slate-500')}>{d.getDate()}</p>
                  <div className="space-y-0.5">
                    {dayVisits.slice(0, 3).map((v) => (
                      <div key={v.id} className="flex items-center gap-1 truncate text-[10px] text-slate-600">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_COLORS[v.status])} />
                        <span className="truncate">{v.contract?.client?.full_name}</span>
                      </div>
                    ))}
                    {dayVisits.length > 3 && <p className="text-[9px] text-slate-600">+{dayVisits.length - 3}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
