import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, ChevronLeft, MapPin, Phone, Clock,
  UserCircle, Navigation, X, Users,
} from 'lucide-react';
import { visitService } from '@/services/visitService';
import { employeeService } from '@/services/employeeService';
import type { VisitWithRelations, Employee } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { formatDate, formatTime, initials, cn } from '@/lib/utils';
import { DAY_NAMES } from '@/lib/utils';
import { useVisitRealtime } from '@/lib/qr/useQrScanner';

const VISIT_LIMIT_IN_CARD = 3;

function statusColor(status: string): string {
  switch (status) {
    case 'scheduled': return 'bg-brand-500';
    case 'started': return 'bg-warning-500';
    case 'completed': return 'bg-success-500';
    case 'cancelled': return 'bg-danger-500';
    case 'overdue': return 'bg-slate-400';
    default: return 'bg-slate-300';
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    scheduled: 'مجدولة', started: 'جارية', completed: 'مكتملة', cancelled: 'ملغاة', overdue: 'متأخرة', pending: 'معلقة',
  };
  return map[status] ?? status;
}

function getWeekDays(weekOffset: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sunday = new Date(today);
  sunday.setDate(sunday.getDate() - sunday.getDay() + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getClientName(v: VisitWithRelations): string {
  return v.contract?.client?.full_name ?? v.client?.full_name ?? 'عميل';
}
function getClientPhone(v: VisitWithRelations): string {
  return v.contract?.client?.phone_number ?? v.client?.phone_number ?? '';
}
function getClientAddress(v: VisitWithRelations): string {
  return v.contract?.client?.address ?? v.client?.address ?? '—';
}
function getPackageName(v: VisitWithRelations): string {
  return v.contract?.package?.name ?? 'عرض سعر مخصص';
}

function calcDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return '—';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}س ${m > 0 ? `${m}د` : ''}` : `${m}د`;
}

export function SchedulePage() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedWorker, setSelectedWorker] = useState<{ employee: Employee; visits: VisitWithRelations[]; day: Date } | null>(null);

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  const load = useCallback(async () => {
    try {
      const [v, e] = await Promise.all([visitService.list(), employeeService.list()]);
      setVisits(v);
      setEmployees(e.filter((emp) => emp.employment_status === 'active'));
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useVisitRealtime(() => { load(); });

  const visitsByDayAndEmployee = useMemo(() => {
    const map: Record<string, Record<string, VisitWithRelations[]>> = {};
    for (const v of visits) {
      const dKey = v.scheduled_date;
      if (!map[dKey]) map[dKey] = {};
      const empId = v.employee_id ?? 'unassigned';
      if (!map[dKey][empId]) map[dKey][empId] = [];
      map[dKey][empId].push(v);
    }
    // Sort each worker's visits by start time
    for (const day of Object.values(map)) {
      for (const empVisits of Object.values(day)) {
        empVisits.sort((a, b) => (a.scheduled_start_time ?? '').localeCompare(b.scheduled_start_time ?? ''));
      }
    }
    return map;
  }, [visits]);

  if (loading) return <PageLoader label="جاري تحميل لوحة الجدولة…" />;

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">لوحة الجدولة الأسبوعية</h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDate(weekStart.toISOString())} — {formatDate(weekEnd.toISOString())}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="btn-ghost p-2"><ChevronRight size={18} /></button>
          <button onClick={() => setWeekOffset(0)} className="btn-ghost text-sm">هذا الأسبوع</button>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="btn-ghost p-2"><ChevronLeft size={18} /></button>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="card"><EmptyState icon={<Users size={32} />} title="لا يوجد موظفون" description="أضف موظفين ميدانيين لعرض الجدولة." /></div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {weekDays.map((day, dayIdx) => {
              const dKey = dateKey(day);
              const dayVisits = visitsByDayAndEmployee[dKey] ?? {};
              const isToday = dateKey(new Date()) === dKey;

              return (
                <div key={dKey} className="w-72 shrink-0">
                  <div className={cn(
                    'mb-2 rounded-lg px-3 py-2 text-center',
                    isToday ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600',
                  )}>
                    <p className="text-sm font-700">{DAY_NAMES[dayIdx]}</p>
                    <p className={cn('text-xs', isToday ? 'text-brand-100' : 'text-slate-400')}>
                      {day.toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {employees.map((emp) => {
                      const empVisits = dayVisits[emp.id] ?? [];
                      if (empVisits.length === 0) return null;

                      const totalHours = empVisits.reduce((sum, v) => {
                        if (!v.scheduled_start_time || !v.scheduled_end_time) return sum;
                        const [sh, sm] = v.scheduled_start_time.split(':').map(Number);
                        const [eh, em] = v.scheduled_end_time.split(':').map(Number);
                        return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                      }, 0);

                      return (
                        <button
                          key={emp.id}
                          onClick={() => setSelectedWorker({ employee: emp, visits: empVisits, day })}
                          className="card card-hover w-full p-3 text-right"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-700 text-brand-600">
                                {initials(emp.full_name)}
                              </span>
                              <div>
                                <p className="text-sm font-600 text-slate-900">{emp.full_name}</p>
                                <p className="text-[11px] text-slate-400">
                                  {empVisits.length} زيارة {totalHours > 0 ? `• ${totalHours.toFixed(1)}س` : ''}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 space-y-1.5">
                            {empVisits.slice(0, VISIT_LIMIT_IN_CARD).map((v) => (
                              <div key={v.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
                                <span className={cn('h-2 w-2 shrink-0 rounded-full', statusColor(v.status))} />
                                <div className="flex-1 min-w-0">
                                  <p className="truncate text-xs font-600 text-slate-700">{getClientName(v)}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {v.scheduled_start_time ? formatTime(v.scheduled_start_time) : ''}
                                    {v.scheduled_end_time ? ` - ${formatTime(v.scheduled_end_time)}` : ''}
                                  </p>
                                </div>
                              </div>
                            ))}
                            {empVisits.length > VISIT_LIMIT_IN_CARD && (
                              <p className="pr-4 text-[11px] text-brand-600">+{empVisits.length - VISIT_LIMIT_IN_CARD} زيارات أخرى</p>
                            )}
                          </div>
                        </button>
                      );
                    })}

                    {Object.keys(dayVisits).length === 0 && (
                      <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center">
                        <p className="text-xs text-slate-300">لا زيارات</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Worker Detail Side Panel */}
      {selectedWorker && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedWorker(null)} />
          <div className="fixed inset-y-0 left-0 z-50 w-full max-w-xl overflow-y-auto bg-white shadow-xl animate-slide-in" dir="rtl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-700 text-brand-700">
                  {initials(selectedWorker.employee.full_name)}
                </span>
                <div>
                  <h2 className="font-display font-700 text-slate-900">{selectedWorker.employee.full_name}</h2>
                  <p className="text-xs text-slate-500">
                    {DAY_NAMES[selectedWorker.day.getDay()]} • {formatDate(selectedWorker.day.toISOString())}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedWorker(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
            </div>

            <div className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">إجمالي الزيارات</p>
                  <p className="font-display text-lg font-700 text-slate-900">{selectedWorker.visits.length}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">ساعات العمل</p>
                  <p className="font-display text-lg font-700 text-slate-900">
                    {selectedWorker.visits.reduce((sum, v) => {
                      if (!v.scheduled_start_time || !v.scheduled_end_time) return sum;
                      const [sh, sm] = v.scheduled_start_time.split(':').map(Number);
                      const [eh, em] = v.scheduled_end_time.split(':').map(Number);
                      return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                    }, 0).toFixed(1)}س
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-600 uppercase tracking-wide text-slate-400">الزيارات</p>
                <div className="space-y-2">
                  {selectedWorker.visits.map((v) => (
                    <div key={v.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2.5 w-2.5 rounded-full', statusColor(v.status))} />
                          <div>
                            <p className="font-600 text-slate-900">{getClientName(v)}</p>
                            <p className="text-xs text-slate-500">{getPackageName(v)}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-600 text-slate-600">
                          {statusLabel(v.status)}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5"><Clock size={12} /> {v.scheduled_start_time ? formatTime(v.scheduled_start_time) : '—'} - {v.scheduled_end_time ? formatTime(v.scheduled_end_time) : '—'} ({calcDuration(v.scheduled_start_time, v.scheduled_end_time)})</div>
                        <div className="flex items-center gap-1.5"><MapPin size={12} /> {getClientAddress(v)}</div>
                        {getClientPhone(v) && <div className="flex items-center gap-1.5"><Phone size={12} /> {getClientPhone(v)}</div>}
                      </div>

                      {v.notes && <p className="mt-1.5 rounded bg-slate-50 px-2 py-1 text-xs text-slate-500">{v.notes}</p>}

                      <div className="mt-2 flex gap-1.5">
                        <button
                          onClick={() => { navigate(`/clients/${v.contract?.client_id ?? v.client?.id}`); setSelectedWorker(null); }}
                          className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-600 text-brand-600 hover:bg-brand-50"
                        >
                          <UserCircle size={12} /> ملف العميل
                        </button>
                        {getClientAddress(v) !== '—' && (
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(getClientAddress(v))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-600 text-brand-600 hover:bg-brand-50"
                          >
                            <Navigation size={12} /> الاتجاهات
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
