import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Home, ClipboardCheck, QrCode, UserCircle, Phone, MapPin,
  Clock, CheckCircle2, Play, Square, LogOut, X,
  Navigation, Bell, FileText, Save, AlertTriangle,
} from 'lucide-react';
import { ArkonLogo } from '@/components/ArkonLogo';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { visitService } from '@/services/visitService';
import { notificationService } from '@/services/notificationService';
import { useVisitRealtime } from '@/lib/qr/useQrScanner';
import { useNotifications } from '@/lib/notifications/useNotifications';
import { requestBrowserNotificationPermission } from '@/lib/notifications/manager';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { formatDate, formatTime, cn } from '@/lib/utils';
import { VISIT_STATUS_LABELS, VISIT_TYPE_LABELS } from '@/lib/locale';
import { QrScannerView, type ScanPhase, type ScanOutcome } from '@/components/QrScannerView';
import { QrWorkflow } from '@/lib/qr/workflow';
import type { QrWorkflowResult } from '@/lib/qr/types';
import type { VisitWithRelations, NotificationItem } from '@/types';

/* ===== Helpers ===== */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return v.contract?.package?.name ?? v.package?.name ?? '—';
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed': return 'bg-success-50 text-success-700';
    case 'started': return 'bg-warning-50 text-warning-700';
    case 'cancelled': return 'bg-danger-50 text-danger-700';
    default: return 'bg-brand-50 text-brand-700';
  }
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

/* ===== QrScanner (now uses layered architecture) ===== */
/* The inline scanner has been replaced by the reusable QrScannerView */
/* component + QrWorkflow + useQrScanner hook. See src/lib/qr/ */

/* ===== Visit Detail Modal ===== */

function VisitDetailModal({ visit, onClose, onNotesSaved }: { visit: VisitWithRelations; onClose: () => void; onNotesSaved?: () => void }) {
  const { add } = useToast();
  const { session } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState<ScanPhase>('searching');
  const [scanOutcome, setScanOutcome] = useState<ScanOutcome | null>(null);
  const [notes, setNotes] = useState(visit.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [history, setHistory] = useState<VisitWithRelations[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const clientId = visit.contract?.client?.id ?? visit.client?.id;

  useEffect(() => {
    if (!clientId) return;
    setLoadingHistory(true);
    visitService.getByClient(clientId)
      .then((all) => setHistory(all.filter((v) => v.id !== visit.id).slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [clientId, visit.id]);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScan = async (code: string) => {
    if (scanPhase !== 'searching') return;
    setScanPhase('detected');
    await sleep(300);
    setScanPhase('validating');
    await sleep(400);

    let result: QrWorkflowResult;
    try {
      result = await QrWorkflow.processScanForVisit(code, visit, session?.profile?.employee_id);
    } catch {
      setScanOutcome({ success: false, message: 'تعذر تحديث الزيارة، تحقق من الاتصال وحاول مرة أخرى' });
      setScanPhase('error');
      return;
    }

    if (!result.success) {
      setScanOutcome({ success: false, message: result.message });
      setScanPhase('error');
      return;
    }

    setScanPhase('updating');
    await sleep(300);
    setScanOutcome({
      success: true,
      action: result.action ?? undefined,
      message: result.action === 'start_visit' ? 'بدأت الزيارة' : 'تم إنهاء الزيارة',
    });
    setScanPhase('success');

    try { add(result.message, 'success'); } catch { /* toast is non-critical */ }

    closeTimerRef.current = setTimeout(() => {
      setScanning(false);
      setScanPhase('searching');
      setScanOutcome(null);
      onClose();
    }, 1800);
  };

  const handleDismissError = () => {
    setScanPhase('searching');
    setScanOutcome(null);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await visitService.saveNotes(visit.id, notes.trim());
      add('تم حفظ الملاحظات', 'success');
      onNotesSaved?.();
    } catch {
      add('فشل حفظ الملاحظات', 'error');
    } finally { setSavingNotes(false); }
  };

  const phone = getClientPhone(visit);
  const address = getClientAddress(visit);
  const instructions = (visit as any).visit_instructions ?? (visit.contract as any)?.visit_instructions ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-700 text-slate-900">تفاصيل الزيارة</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-400">العميل</p>
            <p className="font-600 text-slate-900">{getClientName(visit)}</p>
            {visit.visit_type && visit.visit_type !== 'normal' && (
              <span className={cn('mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-600', visit.visit_type === 'emergency' ? 'bg-danger-50 text-danger-700' : 'bg-brand-50 text-brand-700')}>
                {visit.visit_type === 'emergency' ? 'زيارة طارئة' : 'زيارة إضافية'}
              </span>
            )}
            <p className="mt-1 text-xs text-slate-400">الباقة</p>
            <p className="text-sm text-slate-700">{getPackageName(visit)}</p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-600"><MapPin size={16} className="text-slate-400" /> {address}</div>
            <div className="flex items-center gap-2 text-slate-600"><Clock size={16} className="text-slate-400" /> {formatDate(visit.scheduled_date)} {visit.scheduled_start_time ? `• ${formatTime(visit.scheduled_start_time)}` : ''}</div>
            <div className="flex items-center gap-2">
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-600', statusBadgeClass(visit.status))}>
                {VISIT_STATUS_LABELS[visit.status] ?? visit.status}
              </span>
            </div>
          </div>

          {instructions && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-slate-700">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-600 text-brand-600"><FileText size={14} /> تعليمات الزيارة</p>
              {instructions}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-1.5 text-xs font-600 text-slate-400">ملاحظات الزيارة</p>
            <textarea
              className="input min-h-[80px] resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أضف ملاحظات حول الزيارة..."
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes || notes.trim() === (visit.notes ?? '').trim()}
              className="btn-primary mt-2 flex w-full items-center justify-center gap-2 text-sm"
            >
              {savingNotes ? 'جاري الحفظ...' : <><Save size={14} /> حفظ الملاحظات</>}
            </button>
          </div>

          {history.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-600 text-slate-400">سجل زيارات هذا العميل</p>
              <div className="space-y-1.5">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="text-slate-600">{formatDate(h.scheduled_date)} {h.scheduled_start_time ? formatTime(h.scheduled_start_time) : ''}</span>
                    <span className={cn('rounded-full px-2 py-0.5 font-600', statusBadgeClass(h.status))}>
                      {VISIT_STATUS_LABELS[h.status] ?? h.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scanning ? (
            <div className="rounded-xl border border-brand-200 p-4">
              <QrScannerView
                onCodeDecoded={handleScan}
                phase={scanPhase}
                outcome={scanOutcome}
                onDismissError={handleDismissError}
              />
              <button
                onClick={() => {
                  if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
                  setScanning(false);
                  setScanPhase('searching');
                  setScanOutcome(null);
                }}
                className="mt-3 w-full text-center text-sm text-slate-500"
              >إلغاء</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(visit.status === 'scheduled' || visit.status === 'started') && (
                <button
                  onClick={() => setScanning(true)}
                  className={cn('flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-600', visit.status === 'scheduled' ? 'bg-brand-600 text-white' : 'bg-success-600 text-white')}
                >
                  {visit.status === 'scheduled' ? <><Play size={16} /> بدء الزيارة</> : <><Square size={16} /> إنهاء</>}
                </button>
              )}
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 py-2.5 text-sm font-600 text-slate-700">
                  <Phone size={16} /> اتصال
                </a>
              )}
              {address && address !== '—' && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 py-2.5 text-sm font-600 text-slate-700"
                >
                  <Navigation size={16} /> انتقال
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== WorkerApp Layout ===== */

export function WorkerApp() {
  const { session } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const workerName = session?.profile?.employee?.full_name ?? session?.profile?.display_name ?? 'الموظف';
  const employeeId = session?.profile?.employee_id;

  // Load unread count
  const loadUnread = useCallback(async () => {
    if (!employeeId) return;
    try {
      setUnreadCount(await notificationService.unreadCountForEmployee(employeeId));
    } catch { /* */ }
  }, [employeeId]);

  useEffect(() => {
    loadUnread();
    // Request browser notification permission on first load
    requestBrowserNotificationPermission().catch(() => {});
  }, [loadUnread]);

  // Realtime notifications: sounds, toasts, browser notifications, badge update
  useNotifications({
    onNewNotification: () => { loadUnread(); },
  });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50" dir="rtl">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/60 bg-white/95 px-4 backdrop-blur">
        <ArkonLogo size={28} withWordmark variant="compact" />
        <div className="flex items-center gap-2">
          <NavLink to="/worker/notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-700 text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-600 text-brand-700">
            {workerName.charAt(0)}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 pb-20">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-slate-200/60 bg-white/95 px-2 py-2 backdrop-blur">
        <NavLink to="/worker" end className={({ isActive }) => cn('flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-500 transition', isActive ? 'text-brand-700' : 'text-slate-400')}>
          <Home size={22} /> الرئيسية
        </NavLink>
        <NavLink to="/worker/visits" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-500 transition', isActive ? 'text-brand-700' : 'text-slate-400')}>
          <ClipboardCheck size={22} /> الزيارات
        </NavLink>
        <NavLink to="/worker/qr" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-500 transition', isActive ? 'text-brand-700' : 'text-slate-400')}>
          <QrCode size={22} /> مسح
        </NavLink>
        <NavLink to="/worker/profile" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-500 transition', isActive ? 'text-brand-700' : 'text-slate-400')}>
          <UserCircle size={22} /> الملف
        </NavLink>
      </nav>
    </div>
  );
}

/* ===== Worker Home ===== */

export function WorkerHome() {
  const { session } = useAuth();
  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [allVisits, setAllVisits] = useState<VisitWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<VisitWithRelations | null>(null);

  const workerName = session?.profile?.employee?.full_name ?? session?.profile?.display_name ?? 'الموظف';
  const employeeId = session?.profile?.employee_id;

  const loadVisits = useCallback(async () => {
    if (!employeeId) { setLoading(false); return; }
    try {
      setError(false);
      const all = await visitService.getByEmployee(employeeId);
      setAllVisits(all);
      setVisits(all.filter((v) => isToday(v.scheduled_date)));
    } catch { setError(true); } finally { setLoading(false); }
  }, [employeeId]);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  // Realtime: instantly refresh when any visit changes in the database
  useVisitRealtime(() => { if (employeeId) loadVisits(); });

  // Focus fallback: refetch when the tab/app regains focus (mobile readiness)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadVisits(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loadVisits]);

  if (loading) return <PageLoader label="جاري التحميل..." />;
  if (error) return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" dir="rtl">
      <AlertTriangle size={32} className="text-warning-500" />
      <p className="text-sm text-slate-600">تعذر تحميل الزيارات</p>
      <button onClick={loadVisits} className="btn-primary">إعادة المحاولة</button>
    </div>
  );
  if (!employeeId) return <EmptyState title="لا يوجد ملف موظف" description="لم يتم العثور على ملف الموظف المرتبط بحسابك." />;

  const completed = visits.filter((v) => v.status === 'completed').length;
  const remaining = visits.filter((v) => v.status === 'scheduled' || v.status === 'started').length;
  const todayStr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const upcomingVisits = allVisits
    .filter((v) => v.status === 'scheduled' && !isToday(v.scheduled_date))
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const nextVisit = upcomingVisits[0];

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <div>
        <h1 className="font-display text-xl font-700 text-slate-900">مرحباً، {workerName}</h1>
        <p className="text-sm text-slate-500">{todayStr}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-2xl font-700 text-slate-900">{visits.length}</p>
          <p className="text-xs text-slate-500">زيارات اليوم</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-700 text-success-600">{completed}</p>
          <p className="text-xs text-slate-500">مكتملة</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-700 text-warning-600">{remaining}</p>
          <p className="text-xs text-slate-500">المتبقية</p>
        </div>
      </div>

      {nextVisit && (
        <div className="card border-brand-200 p-4">
          <p className="mb-1 text-xs font-600 text-brand-600">الزيارة القادمة</p>
          <p className="font-600 text-slate-900">{getClientName(nextVisit)}</p>
          <p className="text-xs text-slate-500">{formatDate(nextVisit.scheduled_date)} {nextVisit.scheduled_start_time ? `• ${formatTime(nextVisit.scheduled_start_time)}` : ''}</p>
          <p className="text-xs text-slate-400">{getClientAddress(nextVisit)}</p>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-600 text-slate-700">زيارات اليوم</h2>
        <div className="space-y-2">
          {visits.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={32} className="text-slate-300" />} title="لا زيارات اليوم" description="لا توجد زيارات مجدولة لهذا اليوم." />
          ) : (
            visits.map((v) => (
              <button key={v.id} onClick={() => setSelected(v)} className="card flex w-full items-center gap-3 p-4 text-right transition hover:shadow-glow">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
                  <ClipboardCheck size={20} className="text-brand-600" />
                </div>
                <div className="flex-1">
                  <p className="font-600 text-slate-900">{getClientName(v)}</p>
                  <p className="text-xs text-slate-500">{formatTime(v.scheduled_start_time ?? '')} • {getClientAddress(v)}</p>
                  {v.visit_type && v.visit_type !== 'normal' && (
                    <span className={cn('mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-600', v.visit_type === 'emergency' ? 'bg-danger-50 text-danger-700' : 'bg-brand-50 text-brand-700')}>
                      {VISIT_TYPE_LABELS[v.visit_type] ?? v.visit_type}
                    </span>
                  )}
                </div>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-600', statusBadgeClass(v.status))}>
                  {VISIT_STATUS_LABELS[v.status] ?? v.status}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {selected && <VisitDetailModal visit={selected} onClose={() => setSelected(null)} onNotesSaved={loadVisits} />}
    </div>
  );
}

/* ===== Worker Visits ===== */

export function WorkerVisits() {
  const { session } = useAuth();
  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<VisitWithRelations | null>(null);
  const [tab, setTab] = useState<'today' | 'upcoming' | 'history'>('today');
  const employeeId = session?.profile?.employee_id;

  const loadVisits = useCallback(async () => {
    if (!employeeId) { setLoading(false); return; }
    try {
      setError(false);
      setVisits(await visitService.getByEmployee(employeeId));
    } catch { setError(true); } finally { setLoading(false); }
  }, [employeeId]);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  // Focus fallback: refetch on tab/app focus
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadVisits(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loadVisits]);

  if (loading) return <PageLoader label="جاري التحميل..." />;
  if (error) return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" dir="rtl">
      <AlertTriangle size={32} className="text-warning-500" />
      <p className="text-sm text-slate-600">تعذر تحميل الزيارات</p>
      <button onClick={loadVisits} className="btn-primary">إعادة المحاولة</button>
    </div>
  );

  const today = visits.filter((v) => isToday(v.scheduled_date));
  const upcoming = visits.filter((v) => v.status === 'scheduled' && !isToday(v.scheduled_date));
  const history = visits.filter((v) => v.status === 'completed' || v.status === 'cancelled');
  const shown = tab === 'today' ? today : tab === 'upcoming' ? upcoming : history;

  return (
    <div className="space-y-3 p-4" dir="rtl">
      <h1 className="font-display text-xl font-700 text-slate-900">زياراتي</h1>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
        <button onClick={() => setTab('today')} className={cn('rounded-lg py-2 text-xs font-600 transition', tab === 'today' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500')}>اليوم ({today.length})</button>
        <button onClick={() => setTab('upcoming')} className={cn('rounded-lg py-2 text-xs font-600 transition', tab === 'upcoming' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500')}>قادمة ({upcoming.length})</button>
        <button onClick={() => setTab('history')} className={cn('rounded-lg py-2 text-xs font-600 transition', tab === 'history' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500')}>سابقة ({history.length})</button>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={32} className="text-slate-300" />} title="لا توجد زيارات" description="لا توجد زيارات في هذا القسم." />
      ) : (
        shown.map((v) => (
          <button key={v.id} onClick={() => setSelected(v)} className="card flex w-full items-center gap-3 p-4 text-right transition hover:shadow-glow">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
              <ClipboardCheck size={20} className="text-brand-600" />
            </div>
            <div className="flex-1">
              <p className="font-600 text-slate-900">{getClientName(v)}</p>
              <p className="text-xs text-slate-500">{formatDate(v.scheduled_date)} {v.scheduled_start_time ? `• ${formatTime(v.scheduled_start_time)}` : ''}</p>
              <p className="text-xs text-slate-400">{getClientAddress(v)}</p>
            </div>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-600', statusBadgeClass(v.status))}>
              {VISIT_STATUS_LABELS[v.status] ?? v.status}
            </span>
          </button>
        ))
      )}
      {selected && <VisitDetailModal visit={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ===== Worker QR ===== */

export function WorkerQr() {
  const { session } = useAuth();
  const { add } = useToast();
  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [scanPhase, setScanPhase] = useState<ScanPhase>('searching');
  const [scanOutcome, setScanOutcome] = useState<ScanOutcome | null>(null);
  const employeeId = session?.profile?.employee_id;

  const loadVisits = useCallback(async () => {
    if (!employeeId) return;
    try { setVisits(await visitService.getByEmployee(employeeId)); } catch { /* */ }
  }, [employeeId]);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  // Realtime: refresh visit list when any visit changes
  useVisitRealtime(() => { loadVisits(); });

  const handleScan = async (code: string) => {
    if (scanPhase !== 'searching') return;
    setScanPhase('detected');
    await sleep(300);
    setScanPhase('validating');
    await sleep(400);

    let wfResult: QrWorkflowResult;
    try {
      wfResult = await QrWorkflow.processScan(code, visits);
    } catch {
      setScanOutcome({ success: false, message: 'تعذر تحديث الزيارة، تحقق من الاتصال وحاول مرة أخرى' });
      setScanPhase('error');
      return;
    }

    if (!wfResult.success) {
      setScanOutcome({ success: false, message: wfResult.message });
      setScanPhase('error');
      return;
    }

    setScanPhase('updating');
    await sleep(300);
    setScanOutcome({
      success: true,
      action: wfResult.action ?? undefined,
      message: wfResult.action === 'start_visit' ? 'بدأت الزيارة' : 'تم إنهاء الزيارة',
    });
    setScanPhase('success');

    try { add(wfResult.message, 'success'); } catch { /* toast is non-critical */ }
    try { loadVisits(); } catch { /* list refresh is non-critical */ }

    setTimeout(() => {
      setScanPhase('searching');
      setScanOutcome(null);
    }, 1800);
  };

  const handleDismissError = () => {
    setScanPhase('searching');
    setScanOutcome(null);
  };

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <h1 className="font-display text-xl font-700 text-slate-900">مسح QR</h1>
      <p className="text-sm text-slate-500">امسح رمز QR الخاص بالعميل لبدء أو إنهاء الزيارة.</p>
      <QrScannerView
        onCodeDecoded={handleScan}
        phase={scanPhase}
        outcome={scanOutcome}
        onDismissError={handleDismissError}
      />
    </div>
  );
}

/* ===== Worker Notifications ===== */

export function WorkerNotifications() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const employeeId = session?.profile?.employee_id;

  const load = useCallback(async () => {
    if (!employeeId) { setLoading(false); return; }
    try {
      setNotifications(await notificationService.listForEmployee(employeeId) as unknown as NotificationItem[]);
    } catch { /* */ } finally { setLoading(false); }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh when new notifications arrive
  useNotifications({
    onNewNotification: () => { load(); },
  });

  const markAllRead = async () => {
    if (!employeeId) return;
    try {
      await notificationService.markAllReadForEmployee(employeeId);
      await load();
    } catch { /* */ }
  };

  if (loading) return <PageLoader label="جاري التحميل..." />;

  return (
    <div className="space-y-3 p-4" dir="rtl">
      <h1 className="font-display text-xl font-700 text-slate-900">الإشعارات</h1>
      {notifications.length === 0 ? (
        <EmptyState icon={<Bell size={32} className="text-slate-300" />} title="لا إشعارات" description="لم تصدر أي إشعارات بعد." />
      ) : (
        notifications.map((n) => (
          <div key={n.id} className={cn('card p-3', !n.read && 'border-brand-200 bg-brand-50/30')}>
            <div className="flex items-start gap-2">
              <Bell size={16} className={cn('mt-0.5 shrink-0', n.read ? 'text-slate-300' : 'text-brand-600')} />
              <div className="flex-1">
                <p className="text-sm font-600 text-slate-900">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>}
                <p className="mt-1 text-xs text-slate-400">{formatDate(n.created_at)}</p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ===== Worker Profile ===== */

export function WorkerProfile() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const { add } = useToast();
  const employee = session?.profile?.employee;
  const [phone, setPhone] = useState(employee?.phone_number ?? '');
  const [photoUrl, setPhotoUrl] = useState(employee?.photo_url ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!employee?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({ phone_number: phone, photo_url: photoUrl || null, updated_at: new Date().toISOString() })
        .eq('id', employee.id);
      if (error) throw error;
      add('تم حفظ التغييرات', 'success');
    } catch {
      add('فشل الحفظ', 'error');
    } finally { setSaving(false); }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <h1 className="font-display text-xl font-700 text-slate-900">الملف الشخصي</h1>

      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xl font-700 text-brand-700">
            {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : (employee?.full_name?.charAt(0) ?? '?')}
          </div>
          <div>
            <p className="font-600 text-slate-900">{employee?.full_name ?? '—'}</p>
            <p className="text-sm text-slate-500">{employee?.job_title ?? employee?.position ?? ''}</p>
            <p className="text-xs text-slate-400">{employee?.service_area ?? ''}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">رقم الهاتف</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label className="label">رابط الصورة</label>
            <input className="input" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} dir="ltr" placeholder="https://..." />
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>

      <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-lg bg-danger-50 py-3 text-sm font-600 text-danger-600">
        <LogOut size={18} /> تسجيل الخروج
      </button>
    </div>
  );
}
