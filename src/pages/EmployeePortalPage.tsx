import { useCallback, useEffect, useRef, useState } from 'react';
import {
  QrCode,
  Camera,
  Play,
  CheckCircle,
  Clock,
  MapPin,
  X,
  Calendar,
  User,
  AlertCircle,
} from 'lucide-react';
import { visitService } from '@/services/visitService';
import { qrService } from '@/services/qrService';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { formatDate, formatDateTime, cn } from '@/lib/utils';
import type { VisitWithRelations } from '@/types';

/* =========================================================================
 * Status helpers (Arabic labels + light-theme badge tones)
 * ========================================================================= */

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'مجدولة',
  started: 'قيد التنفيذ',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
  archived: 'مؤرشفة',
  pending: 'بانتظار',
};

const STATUS_TONES: Record<string, string> = {
  scheduled: 'bg-brand-50 text-brand-600 border-brand-200',
  started: 'bg-amber-50 text-amber-600 border-amber-200',
  completed: 'bg-success-500/10 text-success-600 border-success-500/30',
  cancelled: 'bg-danger-50 text-danger-600 border-danger-200',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
  pending: 'bg-slate-50 text-slate-500 border-slate-200',
};

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES.pending;
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-600', tone)}>
      {label}
    </span>
  );
}

/* =========================================================================
 * GPS helper
 * ========================================================================= */

function getPosition(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ lat: null, lng: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

/* =========================================================================
 * QrScanner — live camera + BarcodeDetector (with frame fallback)
 * ========================================================================= */

interface QrScannerProps {
  onScan: (code: string) => void;
  onCancel: () => void;
}

function QrScanner({ onScan, onCancel }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Stop the camera stream and cancel any pending animation frame.
  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Detection loop: use BarcodeDetector if available, otherwise a polling
  // approach that simply yields the (rare) decoded frame. We keep the loop
  // running at ~500ms cadence via requestAnimationFrame timestamps.
  const detectLoop = useCallback(() => {
    const last = (detectLoop as any)._last ?? 0;
    const now = performance.now();

    if (now - last >= 500) {
      (detectLoop as any)._last = now;
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && detectorRef.current) {
        detectorRef.current
          .detect(video)
          .then((codes: any[]) => {
            if (codes && codes.length > 0) {
              const value = codes[0]?.rawValue ?? codes[0]?.code ?? '';
              if (value) {
                stop();
                onScan(value);
                return;
              }
            }
            rafRef.current = requestAnimationFrame(detectLoop);
          })
          .catch(() => {
            rafRef.current = requestAnimationFrame(detectLoop);
          });
        return;
      }
    }

    rafRef.current = requestAnimationFrame(detectLoop);
  }, [onScan, stop]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError(null);
      setReady(false);

      // Prefer the native BarcodeDetector API when present.
      const BD = (window as any).BarcodeDetector;
      if (typeof BD !== 'undefined') {
        try {
          detectorRef.current = new BD({ formats: ['qr_code'] });
        } catch {
          detectorRef.current = new BD();
        }
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!cancelled) setError('الكاميرا غير مدعومة على هذا الجهاز.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
        rafRef.current = requestAnimationFrame(detectLoop);
      } catch (err: any) {
        if (cancelled) return;
        const name = err?.name ?? '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('يرجى السماح بالوصول إلى الكاميرا');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError('لا توجد كاميرا متاحة على هذا الجهاز.');
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          setError('تعذّر الوصول إلى الكاميرا، ربما تُستخدم من قبل تطبيق آخر.');
        } else {
          setError('يرجى السماح بالوصول إلى الكاميرا');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 animate-fade-in" dir="rtl">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-brand-600" />
            <h3 className="font-600 text-slate-900">مسح رمز QR</h3>
          </div>
          <button
            type="button"
            onClick={() => { stop(); onCancel(); }}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        {/* Camera viewport */}
        <div className="relative aspect-square w-full bg-slate-900">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Targeting overlay (only when stream is live) */}
          {ready && !error && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-56 w-56 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
            </div>
          )}

          {/* Loading hint */}
          {!ready && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
              <Camera size={28} className="animate-pulse" />
              <p className="text-sm">جارٍ تشغيل الكاميرا…</p>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/95 p-6 text-center">
              <AlertCircle size={32} className="text-danger-400" />
              <p className="text-sm text-white">{error}</p>
              <button
                type="button"
                onClick={() => { stop(); onCancel(); }}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-500 text-white transition hover:bg-white/20"
              >
                إغلاق
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-3">
          <p className="text-center text-xs text-slate-500">
            وجّه الكاميرا نحو رمز QR الخاص بالعميل للتحقق من الزيارة.
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
 * Stat card
 * ========================================================================= */

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Calendar;
  tone: 'brand' | 'accent' | 'success';
}) {
  const toneClass =
    tone === 'brand'
      ? 'bg-brand-50 text-brand-600'
      : tone === 'accent'
        ? 'bg-amber-50 text-amber-600'
        : 'bg-success-500/15 text-success-600';
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-500 uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 font-display text-2xl font-700 text-slate-900">{value}</p>
        </div>
        <div className={cn('rounded-xl p-2.5', toneClass)}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
 * Main page
 * ========================================================================= */

type ScanAction = 'start' | 'finish';

export function EmployeePortalPage() {
  const { session } = useAuth();
  const employeeId = session?.profile?.employee_id ?? null;
  const { push } = useToast();

  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Scanner modal state
  const [scanTarget, setScanTarget] = useState<VisitWithRelations | null>(null);
  const [scanAction, setScanAction] = useState<ScanAction>('start');

  const loadVisits = useCallback(async () => {
    if (!employeeId) { setLoading(false); return; }
    setLoading(true);
    try {
      setVisits(await visitService.getByEmployee(employeeId));
    } catch {
      push('error', 'تعذّر تحميل الزيارات.');
    } finally {
      setLoading(false);
    }
  }, [employeeId, push]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  /* ----- Scan workflow ----- */

  const openScanner = (visit: VisitWithRelations, action: ScanAction) => {
    setScanTarget(visit);
    setScanAction(action);
  };

  const closeScanner = () => {
    setScanTarget(null);
    setScanAction('start');
  };

  const handleScanned = async (code: string) => {
    const visit = scanTarget;
    const action = scanAction;
    if (!visit || !employeeId) return;

    setBusyId(visit.id);
    closeScanner();

    try {
      // 1) Validate the QR code.
      const result = await qrService.validate(code);
      if (!result.valid || !result.clientId) {
        push('error', 'رمز QR غير صالح. يرجى مسح رمز العميل الصحيح.');
        return;
      }

      // 2) Ensure the QR belongs to the SAME client as this visit.
      const visitClientId = visit.contract?.client_id ?? visit.client?.id ?? null;
      if (!visitClientId || result.clientId !== visitClientId) {
        push('error', 'رمز QR لا يطابق العميل المرتبط بهذه الزيارة.');
        return;
      }

      // 3) Capture GPS (best-effort) and update visit status.
      const { lat, lng } = await getPosition();
      if (action === 'start') {
        await visitService.startVisit(visit.id, lat ?? undefined, lng ?? undefined);
        push('success', 'تم بدء الزيارة بنجاح.');
      } else {
        await visitService.finishVisit(visit.id, lat ?? undefined, lng ?? undefined);
        push('success', 'تم إنهاء الزيارة بنجاح.');
      }
      await loadVisits();
    } catch (err: any) {
      const msg = err?.message ?? 'حدث خطأ غير متوقع.';
      push('error', msg);
    } finally {
      setBusyId(null);
    }
  };

  /* -----Derived lists ----- */

  if (loading) return <PageLoader label="جارٍ تحميل بوابة الموظف…" />;
  if (!employeeId) {
    return (
      <EmptyState
        icon={<User size={32} />}
        title="لا يوجد ملف موظف مرتبط"
        description="يرجى التواصل مع المسؤول لربط حسابك بملف الموظف."
      />
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = visits.filter((v) => v.scheduled_date === todayStr);
  const upcoming = visits.filter(
    (v) => v.scheduled_date > todayStr && (v.status === 'scheduled' || v.status === 'pending'),
  );
  const completed = visits.filter((v) => v.status === 'completed');
  const completionRate = visits.length > 0 ? Math.round((completed.length / visits.length) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Page header */}
      <div>
        <h1 className="font-display text-2xl font-700 text-slate-900">بوابة الموظف</h1>
        <p className="mt-1 text-sm text-slate-500">زياراتك المجدولة ومسح رمز QR لبدء وإنهاء الزيارات.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="زيارات اليوم" value={String(today.length)} icon={Calendar} tone="brand" />
        <Stat label="زيارات قادمة" value={String(upcoming.length)} icon={Clock} tone="accent" />
        <Stat label="زيارات مكتملة" value={String(completed.length)} icon={CheckCircle} tone="success" />
        <Stat label="نسبة الإنجاز" value={`${completionRate}%`} icon={QrCode} tone="brand" />
      </div>

      {/* Visits list */}
      {visits.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Calendar size={32} />} title="لا توجد زيارات معينة" description="لم تُسند أي زيارات إليك بعد." />
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((v) => {
            const clientName = v.contract?.client?.full_name ?? v.client?.full_name ?? '—';
            const clientAddress = v.contract?.client?.address ?? v.client?.address ?? null;
            const packageName = v.contract?.package?.name ?? null;
            const isScheduled = v.status === 'scheduled' || v.status === 'pending';
            const isStarted = v.status === 'started';
            const isCompleted = v.status === 'completed';
            const isBusy = busyId === v.id;

            return (
              <div key={v.id} className="card card-hover p-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Index + client */}
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-xs font-700 text-brand-600">
                      {v.visit_index ?? '—'}
                    </span>
                    <div>
                      <p className="font-600 text-slate-900">{clientName}</p>
                      <p className="text-xs text-slate-500">
                        {packageName ? `${packageName} · ` : ''}زيارة رقم {v.visit_index ?? '—'}
                      </p>
                    </div>
                  </div>

                  {/* Date / time / status */}
                  <div className="ml-auto flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Calendar size={14} /> {formatDate(v.scheduled_date)}
                    </span>
                    {v.scheduled_start_time && (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Clock size={14} /> {v.scheduled_start_time}
                      </span>
                    )}
                    <StatusBadge status={v.status} />
                  </div>
                </div>

                {/* Address */}
                {clientAddress && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin size={12} /> {clientAddress}
                  </div>
                )}

                {/* Timestamps */}
                {(v.started_at || v.finished_at) && (
                  <div className="mt-2 flex flex-wrap gap-4 border-t border-slate-200 pt-2 text-xs text-slate-500">
                    {v.started_at && <span>بدأت: {formatDateTime(v.started_at)}</span>}
                    {v.finished_at && <span>انتهت: {formatDateTime(v.finished_at)}</span>}
                  </div>
                )}

                {/* Actions */}
                {(isScheduled || isStarted) && (
                  <div className="mt-3 flex justify-end gap-2">
                    {isScheduled && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openScanner(v, 'start')}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-600 text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Play size={16} /> بدء الزيارة
                      </button>
                    )}
                    {isStarted && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openScanner(v, 'finish')}
                        className="inline-flex items-center gap-2 rounded-lg bg-success-500 px-4 py-2 text-sm font-600 text-white transition hover:bg-success-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle size={16} /> إنهاء الزيارة
                      </button>
                    )}
                  </div>
                )}

                {/* Completed badge */}
                {isCompleted && (
                  <div className="mt-3 flex justify-end">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-success-500/10 px-3 py-1.5 text-xs font-600 text-success-600">
                      <CheckCircle size={14} /> اكتملت الزيارة
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Scanner modal */}
      {scanTarget && (
        <QrScanner onScan={handleScanned} onCancel={closeScanner} />
      )}
    </div>
  );
}

export default EmployeePortalPage;
