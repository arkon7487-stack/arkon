import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Clock, MapPin } from 'lucide-react';
import { visitService } from '@/services/visitService';
import type { VisitWithRelations } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { cn, initials, formatDate } from '@/lib/utils';

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function visitsForDate(visits: VisitWithRelations[], dateStr: string): VisitWithRelations[] {
  return visits.filter((v) => v.scheduled_date === dateStr);
}

function renderVisitChip(v: VisitWithRelations, navigate: (path: string) => void) {
  return (
    <button
      key={v.id}
      onClick={() => navigate(`/visits`)}
      className="w-full rounded-md bg-brand-50 px-2 py-1 text-right hover:bg-brand-100"
    >
      <p className="truncate text-xs font-600 text-brand-700">
        {v.contract?.client?.full_name ?? v.client?.full_name ?? 'عميل'}
      </p>
      <p className="text-[10px] text-brand-500">
        {v.scheduled_start_time ?? ''} {v.scheduled_end_time ? `- ${v.scheduled_end_time}` : ''}
      </p>
    </button>
  );
}

export function CalendarPage() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'day' | 'week' | 'month'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const load = async (start: Date, end: Date) => {
    try {
      setVisits(await visitService.getByDateRange(dateKey(start), dateKey(end)));
    } catch { /* */ } finally { setLoading(false); }
  };

  useEffect(() => {
    const now = new Date();
    if (view === 'day') {
      load(now, now);
    } else if (view === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      load(start, end);
    } else {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      load(start, end);
    }
  }, [view]);

  const todayStr = dateKey(new Date());

  const weekDays = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const monthDays = (): (Date | null)[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i += 1) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d += 1) days.push(new Date(year, month, d));
    return days;
  };

  if (loading) return <PageLoader label="جاري تحميل التقويم…" />;

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">التقويم</h1>
          <p className="mt-1 text-sm text-slate-500">
            {currentDate.toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn('px-3 py-1.5 text-sm font-600', view === v ? 'bg-brand-600 text-white' : 'text-slate-500')}
              >
                {v === 'day' ? 'يوم' : v === 'week' ? 'أسبوع' : 'شهر'}
              </button>
            ))}
          </div>
          <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="btn-ghost p-2"><ChevronRight size={18} /></button>
          <button onClick={() => setCurrentDate(new Date())} className="btn-ghost text-sm">اليوم</button>
          <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="btn-ghost p-2"><ChevronLeft size={18} /></button>
        </div>
      </div>

      {visits.length === 0 ? (
        <div className="card"><EmptyState icon={<Clock size={32} />} title="لا زيارات" description="لا توجد زيارات مجدولة في هذه الفترة." /></div>
      ) : (
        <div className="card">
          {view === 'day' && (
            <div className="space-y-3">
              <h2 className="font-display font-700 text-slate-900">
                {currentDate.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              {visitsForDate(visits, dateKey(currentDate)).length === 0 ? (
                <p className="text-sm text-slate-400">لا زيارات في هذا اليوم</p>
              ) : (
                <div className="space-y-2">
                  {visitsForDate(visits, dateKey(currentDate)).map((v) => (
                    <div key={v.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-600 text-slate-900">{v.contract?.client?.full_name ?? v.client?.full_name ?? 'عميل'}</p>
                        <span className="text-xs text-slate-400">{v.scheduled_start_time ?? ''}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin size={12} /> {v.contract?.client?.address ?? v.client?.address ?? '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'week' && (
            <div>
              <div className="grid grid-cols-7 border-b border-slate-200">
                {weekDays().map((d) => (
                  <div key={d.toISOString()} className={cn('border-r border-slate-200 px-3 py-2 text-center', dateKey(d) === todayStr && 'bg-brand-50'))}>
                    <p className="text-xs font-600 uppercase text-slate-500">{d.toLocaleDateString('ar-EG', { weekday: 'short' })}</p>
                    <p className="text-sm font-600 text-slate-800">{d.getDate()}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {weekDays().map((d) => {
                  const dayVisits = visitsForDate(visits, dateKey(d));
                  return (
                    <div key={d.toISOString()} className="min-h-32 border-r border-slate-200 p-2">
                      <div className="space-y-1">
                        {dayVisits.slice(0, 4).map(renderVisitChip)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'month' && (
            <div>
              <div className="grid grid-cols-7 border-b border-slate-200">
                {['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map((dn) => (
                  <div key={dn} className="border-r border-slate-200 px-3 py-2 text-center text-xs font-600 text-slate-500">{dn}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays().map((d, i) => {
                  if (!d) return <div key={i} className="min-h-24 border-r border-b border-slate-200 bg-slate-50" />;
                  const dayVisits = visitsForDate(visits, dateKey(d));
                  return (
                    <div key={i} className={cn('min-h-24 border-r border-b border-slate-200 p-1.5', dateKey(d) === todayStr && 'bg-brand-50')}>
                      <p className={cn('mb-1 text-xs font-600', dateKey(d) === todayStr ? 'text-brand-600' : 'text-slate-500')}>{d.getDate()}</p>
                      <div className="space-y-0.5">
                        {dayVisits.slice(0, 3).map(renderVisitChip)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
