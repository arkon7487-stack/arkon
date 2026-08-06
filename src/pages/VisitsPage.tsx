import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar, Search, QrCode, PlayCircle, CheckCircle2, Clock, MapPin,
  Lock, User, ChevronRight, Filter,
} from 'lucide-react';
import { visitService } from '@/services/visitService';
import type { VisitWithRelations } from '@/types';
import { notificationService } from '@/services/notificationService';
import { auditService } from '@/services/auditService';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { StatusBadge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { QrScannerView, type ScanPhase, type ScanOutcome } from '@/components/QrScannerView';
import { QrWorkflow } from '@/lib/qr/workflow';
import { useVisitRealtime } from '@/lib/qr/useQrScanner';
import { formatDate, formatDateTime, initials, cn } from '@/lib/utils';
import { VISIT_STATUS_LABELS } from '@/lib/locale';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type StatusFilter = 'all' | 'pending' | 'scheduled' | 'started' | 'completed' | 'archived';

export function VisitsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [scanVisit, setScanVisit] = useState<VisitWithRelations | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>('searching');
  const [scanOutcome, setScanOutcome] = useState<ScanOutcome | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVisits(await visitService.list());
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useVisitRealtime(() => { load(); });

  const filtered = visits.filter((v) => {
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    const clientName = v.contract?.client?.full_name ?? '';
    const empName = v.employee?.full_name ?? '';
    const matchesQuery =
      clientName.toLowerCase().includes(query.toLowerCase()) ||
      empName.toLowerCase().includes(query.toLowerCase()) ||
      v.contract?.contract_number?.toLowerCase().includes(query.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCodeDecoded = useCallback(async (code: string) => {
    if (!scanVisit || scanPhase !== 'searching') return;

    // Phase 1: QR detected
    setScanPhase('detected');
    await sleep(300);

    // Phase 2: Validating
    setScanPhase('validating');
    await sleep(400);

    // --- Business operation: QR validation + database update ---
    // This is the ONLY operation that can set the error state.
    let result;
    try {
      result = await QrWorkflow.processScanForVisit(code, scanVisit);
    } catch (err) {
      setScanOutcome({ success: false, message: (err as Error).message });
      setScanPhase('error');
      return;
    }

    if (!result.success) {
      setScanOutcome({ success: false, message: result.message });
      setScanPhase('error');
      return;
    }

    // --- Database update succeeded. Success is now confirmed. ---
    setScanPhase('updating');
    await sleep(300);

    setScanOutcome({
      success: true,
      action: result.action ?? undefined,
      message: result.action === 'start_visit' ? 'تم بدء الزيارة بنجاح' : 'تم إنهاء الزيارة بنجاح',
    });
    setScanPhase('success');

    // --- Post-success side effects: notifications, audit, local refresh ---
    // Failures here must NEVER reverse the confirmed success state.
    void (async () => {
      try {
        if (result.action === 'start_visit') {
          await notificationService.notifyVisitStarted(scanVisit.id, scanVisit.contract?.client?.full_name ?? 'client');
          await auditService.log({ action: 'qr_scan_start', entityType: 'visit', entityId: scanVisit.id, newValue: { status: 'started' } });
        } else if (result.action === 'finish_visit') {
          await notificationService.notifyVisitCompleted(scanVisit.id, scanVisit.contract?.client?.full_name ?? 'client');
          await auditService.log({ action: 'qr_scan_finish', entityType: 'visit', entityId: scanVisit.id, newValue: { status: 'completed' } });
        }
      } catch (err) {
        console.warn('[QR] Post-success notification/audit failed (non-blocking):', err);
      }
      try { await load(); } catch (err) { console.warn('[QR] Post-success list refresh failed:', err); }
    })();

    // Close after 1.8s — success confirmation stays visible
    closeTimerRef.current = setTimeout(() => {
      setScanVisit(null);
      setScanPhase('searching');
      setScanOutcome(null);
    }, 1800);
  }, [scanVisit, scanPhase, load]);

  const handleDismissError = useCallback(() => {
    setScanPhase('searching');
    setScanOutcome(null);
  }, []);

  const handleCloseScanModal = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setScanVisit(null);
    setScanPhase('searching');
    setScanOutcome(null);
  }, []);

  if (loading) return <PageLoader label="جارٍ تحميل الزيارات…" />;

  const statusCounts = {
    all: visits.length,
    pending: visits.filter((v) => v.status === 'pending').length,
    scheduled: visits.filter((v) => v.status === 'scheduled').length,
    started: visits.filter((v) => v.status === 'started').length,
    completed: visits.filter((v) => v.status === 'completed').length,
    archived: visits.filter((v) => v.status === 'archived').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-700 text-slate-50">الزيارات</h1>
        <p className="mt-1 text-sm text-slate-400">إكمال دورة حياة الزيارة. الزيارات مُولّدة من العقود — ولا تُنشأ يدوياً أبداً.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(statusCounts) as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-500 capitalize transition',
              statusFilter === s ? 'bg-brand-500 text-white' : 'border-slate-200/80 text-slate-500 hover:bg-slate-100/50',
            )}
          >
            {s === 'all' ? 'الكل' : (VISIT_STATUS_LABELS[s] ?? s)} ({statusCounts[s]})
          </button>
        ))}
      </div>

      <div className="relative w-full max-w-xl">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-9" placeholder="بحث حسب العميل أو الموظف أو العقد…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Calendar size={32} />} title="لا توجد زيارات" description="الزيارات تُنشأ تلقائياً عند تفعيل عقد." /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const clientName = v.contract?.client?.full_name ?? '—';
            const isLocked = v.status === 'completed' || v.status === 'archived';
            return (
              <div key={v.id} className="card card-hover p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-xs font-700 text-brand-600">
                      {v.visit_index ?? '—'}
                    </span>
                    <div>
                      <p className="font-600 text-slate-900">{clientName}</p>
                      <p className="text-xs text-slate-500">{v.contract?.contract_number} · {v.contract?.package?.name}</p>
                    </div>
                  </div>

                  <div className="ml-auto flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Calendar size={14} />
                      {formatDate(v.scheduled_date)}
                      {v.scheduled_start_time && <span className="text-slate-500">· {v.scheduled_start_time}</span>}
                    </div>
                    {v.employee && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-700 text-brand-500">{initials(v.employee.full_name)}</span>
                        {v.employee.full_name}
                      </div>
                    )}
                    <StatusBadge status={v.status} label={VISIT_STATUS_LABELS[v.status] ?? v.status} />
                  </div>
                </div>

                {(v.started_at || v.finished_at) && (
                  <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-200/80 pt-3 text-xs text-slate-500">
                    {v.started_at && <span className="flex items-center gap-1"><PlayCircle size={12} /> بدأت {formatDateTime(v.started_at)}</span>}
                    {v.finished_at && <span className="flex items-center gap-1"><CheckCircle2 size={12} /> انتهت {formatDateTime(v.finished_at)}</span>}
                    {(v.start_gps_lat != null) && <span className="flex items-center gap-1"><MapPin size={12} /> تم تسجيل الموقع</span>}
                    {isLocked && <span className="flex items-center gap-1 text-warning-400"><Lock size={12} /> مقفل</span>}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  {!isLocked && (
                    <button
                      onClick={() => setScanVisit(v)}
                      className="btn-ghost text-sm"
                    >
                      <QrCode size={14} /> {v.status === 'started' ? 'امسح للإنهاء' : 'امسح رمز QR'}
                    </button>
                  )}
                  <Link to={`/clients/${v.contract?.client_id}`} className="text-sm text-brand-600 hover:text-brand-800">
                    عرض العميل
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Scan Modal — uses live camera preview */}
      <Modal
        open={!!scanVisit}
        onClose={handleCloseScanModal}
        title="التحقق عبر QR"
        subtitle={scanVisit ? `زيارة رقم ${scanVisit.visit_index} لـ ${scanVisit.contract?.client?.full_name ?? ''}` : ''}
        size="sm"
        footer={
          <button onClick={handleCloseScanModal} className="btn-ghost">إغلاق</button>
        }
      >
        <div className="space-y-4">
          {scanVisit && scanPhase === 'searching' && (
            <div className="space-y-2 text-sm">
              <Row label="العميل" value={scanVisit.contract?.client?.full_name ?? '—'} />
              <Row label="التاريخ" value={formatDate(scanVisit.scheduled_date)} />
              <Row label="الوقت" value={`${scanVisit.scheduled_start_time ?? '—'} – ${scanVisit.scheduled_end_time ?? '—'}`} />
              <Row label="الحالة" value={VISIT_STATUS_LABELS[scanVisit.status] ?? scanVisit.status} />
            </div>
          )}
          <QrScannerView
            onCodeDecoded={handleCodeDecoded}
            phase={scanPhase}
            outcome={scanOutcome}
            onDismissError={handleDismissError}
          />
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-500 text-slate-800">{value}</span>
    </div>
  );
}
