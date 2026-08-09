/**
 * Scanner Layer — platform-agnostic QR decoder.
 *
 * Takes raw RGBA frames from any `CameraController` (web or native)
 * and decodes QR codes using jsQR. This layer has zero knowledge of:
 *   - How the camera was opened (web vs native)
 *   - What the QR code means (validation, visit status)
 *   - How to sync the result to Supabase
 *
 * Its only responsibility: "given pixels, return a QR string or null."
 */

import jsQR from 'jsqr';
import type { CameraController, FrameData, OnCodeDecoded } from './types';

// Downsample large frames to this max dimension for faster decoding.
// 480px is enough for QR recognition and keeps jsQR fast on mobile.
const MAX_DECODE_DIMENSION = 480;

export class QrScanner {
  private camera: CameraController;
  private onDecoded: OnCodeDecoded;
  private rafId: number | null = null;
  private scanning = false;
  private lastCode = '';
  private lastCodeTime = 0;
  private readonly debounceMs = 3000;
  private processing = false;

  // Reusable downsample canvas to avoid per-frame allocation
  private downsampleCanvas: HTMLCanvasElement | null = null;
  private downsampleCtx: CanvasRenderingContext2D | null = null;

  constructor(camera: CameraController, onDecoded: OnCodeDecoded) {
    this.camera = camera;
    this.onDecoded = onDecoded;
  }

  startLoop(): void {
    if (this.scanning) return;
    this.scanning = true;
    this.processing = false;
    this.tick();
  }

  stopLoop(): void {
    this.scanning = false;
    this.processing = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  isScanning(): boolean {
    return this.scanning;
  }

  /**
   * Decode a single frame synchronously.
   * Uses inversionAttempts: 'attemptBoth' to handle both normal and
   * inverted QR codes (e.g. light-on-dark from screen glare or printed
   * on colored backgrounds).
   *
   * Downsamples large frames for performance — decoding a 1080p frame
   * every animation frame is too slow on mobile devices.
   */
  static decodeFrame(frame: FrameData): string | null {
    const { data, width, height } = frame;

    // Downsample if the frame is larger than the max decode dimension
    let decodeData = data;
    let decodeWidth = width;
    let decodeHeight = height;

    if (width > MAX_DECODE_DIMENSION || height > MAX_DECODE_DIMENSION) {
      const scale = MAX_DECODE_DIMENSION / Math.max(width, height);
      decodeWidth = Math.round(width * scale);
      decodeHeight = Math.round(height * scale);

      // Create a temporary canvas for downsampling
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = decodeWidth;
      tempCanvas.height = decodeHeight;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!tempCtx) return null;

      // Draw the full-resolution frame scaled down
      // We need an ImageData object from the original data
      const tempImageData = new ImageData(new Uint8ClampedArray(data), width, height);
      tempCtx.putImageData(tempImageData, 0, 0);

      // Now draw it scaled onto another canvas
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = decodeWidth;
      scaledCanvas.height = decodeHeight;
      const scaledCtx = scaledCanvas.getContext('2d', { willReadFrequently: true });
      if (!scaledCtx) return null;
      scaledCtx.drawImage(tempCanvas, 0, 0, decodeWidth, decodeHeight);

      const scaledData = scaledCtx.getImageData(0, 0, decodeWidth, decodeHeight);
      decodeData = scaledData.data;
    }

    const code = jsQR(decodeData, decodeWidth, decodeHeight, {
      inversionAttempts: 'attemptBoth',
    });
    return code?.data ?? null;
  }

  private tick = (): void => {
    if (!this.scanning) return;

    // Skip frame processing while a previous decode is being handled
    if (this.processing) {
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }

    const frame = this.camera.getFrame();
    if (frame) {
      const decoded = QrScanner.decodeFrame(frame);
      if (decoded) {
        const now = Date.now();
        // Debounce: don't fire the same code twice within debounce window
        if (decoded !== this.lastCode || now - this.lastCodeTime > this.debounceMs) {
          this.lastCode = decoded;
          this.lastCodeTime = now;
          this.processing = true;
          this.onDecoded(decoded);
          // Loop continues but won't fire again until processing is cleared
          // by the caller via resumeLoop() after the workflow completes.
        }
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  /**
   * Clear the processing lock so the scanner can fire again.
   * Called by the UI layer after the QR workflow completes (success or error).
   */
  resumeLoop(): void {
    this.processing = false;
  }
}
