/**
 * useQrScanner — React hook that wires together the Camera Layer + Scanner Layer.
 *
 * This hook is the bridge between React and the platform-agnostic layers.
 * It manages refs, lifecycle, and state so UI components can stay simple.
 *
 * On React Native, you would replace `WebCameraController` with a
 * `NativeCameraController` that implements the same `CameraController`
 * interface. The scanner layer, workflow layer, and sync layer stay unchanged.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { WebCameraController } from './webCamera';
import { QrScanner } from './scanner';
import { QrRealtimeSync } from './realtime';
import type { CameraError, ScanState, OnCodeDecoded } from './types';

export interface UseQrScannerOptions {
  /** Called when a QR code is decoded from the camera. */
  onCodeDecoded: OnCodeDecoded;
  /** Whether to auto-start the camera on mount. Default: true. */
  autoStart?: boolean;
}

export interface UseQrScannerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  state: ScanState;
  error: CameraError | null;
  start: () => Promise<void>;
  stop: () => void;
  retry: () => void;
  /** Clear the processing lock so the scanner can fire again. Call after workflow completes. */
  resumeScanning: () => void;
}

export function useQrScanner(options: UseQrScannerOptions): UseQrScannerReturn {
  const { autoStart = true } = options;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<WebCameraController | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const startingRef = useRef(false);
  const onDecodedRef = useRef(options.onCodeDecoded);
  onDecodedRef.current = options.onCodeDecoded;

  const [state, setState] = useState<ScanState>('idle');
  const [error, setError] = useState<CameraError | null>(null);

  const stop = useCallback(() => {
    startingRef.current = false;
    scannerRef.current?.stopLoop();
    cameraRef.current?.stop();
    setState('stopped');
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;

    setError(null);
    setState('starting');

    if (!cameraRef.current) {
      cameraRef.current = new WebCameraController(videoRef, canvasRef);
    }

    try {
      await cameraRef.current.start();
    } catch (err) {
      startingRef.current = false;
      const camErr = err as CameraError;
      setError(camErr);
      setState('error');
      return;
    }

    if (!startingRef.current) {
      cameraRef.current.stop();
      return;
    }

    scannerRef.current = new QrScanner(cameraRef.current, (code) => {
      onDecodedRef.current(code);
    });

    scannerRef.current.startLoop();
    setState('scanning');
  }, []);

  const retry = useCallback(() => {
    stop();
    setTimeout(() => { start(); }, 200);
  }, [start, stop]);

  const resumeScanning = useCallback(() => {
    scannerRef.current?.resumeLoop();
  }, []);

  useEffect(() => {
    if (autoStart) { start(); }
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { videoRef, canvasRef, state, error, start, stop, retry, resumeScanning };
}

/**
 * Hook for subscribing to Supabase Realtime visit changes.
 * Powers instant synchronization across Admin Dashboard, Worker App, and Customer Portal.
 */
export function useVisitRealtime(
  handler: () => void,
  enabled = true,
): void {
  const syncRef = useRef<QrRealtimeSync | null>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    syncRef.current = new QrRealtimeSync();
    syncRef.current.subscribe(() => {
      handlerRef.current();
    });
    return () => { syncRef.current?.unsubscribe(); };
  }, [enabled]);
}
