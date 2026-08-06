/**
 * QrScannerView — UI component for the camera preview + scan overlay.
 *
 * Visual phases:
 *   searching  → scan line animation, blue frame, "جارٍ البحث عن الرمز..."
 *   detected    → brief flash, "تم العثور على الرمز"
 *   validating  → spinner, "جارٍ التحقق من الرمز..."
 *   updating    → spinner, "جارٍ تحديث حالة الزيارة..."
 *   success     → green frame, checkmark animation, success message
 *   error       → red frame, error message, retry
 */

import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Camera, RotateCcw, ScanLine, Loader2, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQrScanner } from '@/lib/qr/useQrScanner';
import type { CameraError } from '@/lib/qr/types';

export type ScanPhase = 'searching' | 'detected' | 'validating' | 'updating' | 'success' | 'error';

export interface ScanOutcome {
  success: boolean;
  message: string;
  action?: 'start_visit' | 'finish_visit';
}

interface QrScannerViewProps {
  onCodeDecoded: (code: string) => void;
  /** Current scan phase controlled by parent */
  phase: ScanPhase;
  /** Outcome details for success/error display */
  outcome?: ScanOutcome | null;
  /** Called when user dismisses error to resume scanning */
  onDismissError?: () => void;
}

export function QrScannerView({ onCodeDecoded, phase, outcome, onDismissError }: QrScannerViewProps) {
  const { videoRef, canvasRef, state, error, retry, resumeScanning } = useQrScanner({ onCodeDecoded });
  const [manualCode, setManualCode] = useState('');
  const prefersReducedMotion = useRef(false);
  const beepPlayed = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Resume scanning when returning to searching phase
  useEffect(() => {
    if (phase === 'searching') {
      resumeScanning();
    }
  }, [phase, resumeScanning]);

  // Haptic + sound on success
  useEffect(() => {
    if (phase === 'success' && !beepPlayed.current) {
      beepPlayed.current = true;
      triggerHaptic(60);
      playSuccessBeep();
    }
    if (phase === 'searching') {
      beepPlayed.current = false;
    }
  }, [phase]);

  const showManual = state === 'error' && error && (error.kind === 'unsupported' || error.kind === 'notfound');

  const isSuccess = phase === 'success';
  const isError = phase === 'error';
  const isProcessing = phase === 'detected' || phase === 'validating' || phase === 'updating';
  const isSearching = phase === 'searching' && state === 'scanning';

  const frameColor = isSuccess
    ? 'border-success-400 shadow-[0_0_20px_4px_rgba(34,197,94,0.4)]'
    : isError
      ? 'border-danger-400 shadow-[0_0_20px_4px_rgba(239,68,68,0.3)]'
      : isProcessing
        ? 'border-brand-400 shadow-[0_0_16px_3px_rgba(59,130,246,0.3)]'
        : 'border-white/70';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={cn(
        'relative aspect-square w-full max-w-xs overflow-hidden rounded-2xl border-2 bg-slate-900 transition-all duration-300',
        frameColor,
      )}>
        <video
          ref={videoRef}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300',
            state === 'scanning' ? 'opacity-100' : 'opacity-0',
            isSuccess || isProcessing ? 'brightness-75' : '',
          )}
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning frame overlay */}
        {state === 'scanning' && !isSuccess && (
          <div className="pointer-events-none absolute inset-0">
            <div className={cn(
              'absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 transition-colors duration-300',
              frameColor,
            )} />
            {/* Corner brackets */}
            <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2">
              <CornerBrackets color={isSuccess ? 'bg-success-400' : isProcessing ? 'bg-brand-400' : 'bg-white/80'} />
            </div>
            {/* Scan line — only while searching */}
            {isSearching && !prefersReducedMotion.current && (
              <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl">
                <div className="absolute inset-x-0 h-0.5 bg-brand-400 shadow-[0_0_8px_2px_rgba(59,130,246,0.6)] animate-scan-line" />
              </div>
            )}
          </div>
        )}

        {/* Success overlay */}
        {isSuccess && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/60 backdrop-blur-sm">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success-500 animate-success-pop">
                <CheckCircle2 size={48} className="text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-lg font-700 text-white">تم مسح الرمز بنجاح</p>
            {outcome?.message && (
              <p className="rounded-lg bg-success-500/20 px-4 py-1.5 text-base font-600 text-success-300">
                {outcome.message}
              </p>
            )}
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/50 backdrop-blur-sm">
            <Loader2 size={36} className="animate-spin text-brand-400" />
            <p className="text-sm font-600 text-white">
              {phase === 'detected' && 'تم العثور على الرمز'}
              {phase === 'validating' && 'جارٍ التحقق من الرمز...'}
              {phase === 'updating' && 'جارٍ تحديث حالة الزيارة...'}
            </p>
          </div>
        )}

        {/* Error overlay */}
        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/70 backdrop-blur-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-500">
              <X size={32} className="text-white" strokeWidth={2.5} />
            </div>
            <p className="px-6 text-center text-sm font-600 text-white">
              {outcome?.message ?? 'الرمز غير صالح'}
            </p>
            {onDismissError && (
              <button
                onClick={onDismissError}
                className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-600 text-white transition hover:bg-white/20"
              >
                إعادة المحاولة
              </button>
            )}
          </div>
        )}

        {/* Starting state */}
        {state === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Camera size={32} className="animate-pulse" />
              <p className="text-sm">جارٍ فتح الكاميرا...</p>
            </div>
          </div>
        )}

        {/* Idle state */}
        {state === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <Camera size={32} className="text-slate-500" />
          </div>
        )}

        {/* Camera error state */}
        {state === 'error' && !isError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <ErrorDisplay error={error!} onRetry={retry} />
          </div>
        )}
      </div>

      {/* Status text below frame */}
      {isSearching && (
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-2 text-sm font-600 text-slate-600">
            <ScanLine size={16} className="text-brand-500" />
            <span>وجّه الكاميرا نحو رمز QR الخاص بالعميل</span>
          </div>
          <p className="text-xs text-slate-400">جارٍ البحث عن الرمز...</p>
        </div>
      )}

      {isSuccess && (
        <p className="text-sm font-600 text-success-600">يمكنك إغلاق هذه النافذة الآن</p>
      )}

      {/* Manual entry fallback */}
      {state === 'scanning' && phase === 'searching' && (
        <div className="flex w-full items-center gap-2">
          <input
            className="input flex-1"
            placeholder="أدخل رمز QR يدوياً (بديل)"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            dir="ltr"
          />
          <button
            className="btn-primary shrink-0"
            onClick={() => {
              if (manualCode.trim()) {
                onCodeDecoded(manualCode.trim());
                setManualCode('');
              }
            }}
            disabled={!manualCode.trim()}
          >
            تأكيد
          </button>
        </div>
      )}

      {state === 'error' && error && !showManual && (
        <button onClick={retry} className="flex items-center gap-1.5 text-sm font-600 text-brand-600 underline">
          <RotateCcw size={14} /> إعادة محاولة الكاميرا
        </button>
      )}
    </div>
  );
}

function CornerBrackets({ color }: { color: string }) {
  const base = `absolute h-6 w-6 ${color} rounded-full`;
  return (
    <>
      <div className={cn(base, 'left-0 top-0')} style={{ clipPath: 'inset(0 60% 60% 0)' }} />
      <div className={cn(base, 'right-0 top-0')} style={{ clipPath: 'inset(0 0 60% 60%)' }} />
      <div className={cn(base, 'left-0 bottom-0')} style={{ clipPath: 'inset(60% 0 0 60%)' }} />
      <div className={cn(base, 'right-0 bottom-0')} style={{ clipPath: 'inset(60% 60% 0 0)' }} />
    </>
  );
}

function triggerHaptic(ms: number) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(ms);
  } catch { /* no-op on unsupported devices */ }
}

function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close();
  } catch { /* no-op if audio not available */ }
}

function ErrorDisplay({ error, onRetry }: { error: CameraError; onRetry: () => void }) {
  const isWarning = error.kind === 'denied' || error.kind === 'inuse' || error.kind === 'unknown';

  return (
    <div className={cn(
      'mx-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm',
      isWarning ? 'bg-warning-50 text-warning-700' : 'bg-danger-50 text-danger-700',
    )}>
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <div>
        <p>{error.message}</p>
        {(error.kind === 'denied' || error.kind === 'inuse') && (
          <button onClick={onRetry} className="mt-2 text-xs font-600 underline">إعادة المحاولة</button>
        )}
        {error.kind === 'https' && (
          <p className="mt-1 text-xs opacity-80">يجب فتح التطبيق عبر HTTPS أو localhost.</p>
        )}
      </div>
    </div>
  );
}
