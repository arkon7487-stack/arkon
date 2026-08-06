/**
 * Camera Layer — Web implementation.
 *
 * This is the ONLY file that changes between Web and React Native.
 * The React Native version will implement the same `CameraController`
 * interface using native camera APIs (react-native-vision-camera or expo-camera).
 *
 * Responsibilities:
 *   1. Check secure context (HTTPS or localhost).
 *   2. Check MediaDevices / getUserMedia availability.
 *   3. Request camera permission (preferring rear camera).
 *   4. Provide live video preview via a <video> element ref.
 *   5. Extract raw RGBA frames for the scanner layer.
 *   6. Handle errors: denied, not found, in use, unsupported, insecure.
 *
 * No business logic lives here — no QR decoding, no validation, no visit updates.
 */

import type { CameraController, CameraError, FrameData } from './types';

export class WebCameraController implements CameraController {
  private videoRef: React.RefObject<HTMLVideoElement | null>;
  private canvasRef: React.RefObject<HTMLCanvasElement | null>;
  private stream: MediaStream | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
  ) {
    this.videoRef = videoRef;
    this.canvasRef = canvasRef;
  }

  async start(): Promise<void> {
    // 1. Secure context check
    if (!window.isSecureContext) {
      throw this.makeError('https', 'مسح QR يتطلب اتصالاً آمناً (HTTPS). يرجى الوصول للتطبيق عبر رابط آمن.');
    }

    // 2. MediaDevices availability check
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      throw this.makeError('unsupported', 'هذا المتصفح لا يدعم الوصول إلى الكاميرا عبر MediaDevices API.');
    }

    // 3. Request camera, preferring rear lens
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (err) {
      throw this.classifyError(err);
    }

    // 4. Attach to video element for live preview
    //    Wait for the video element to be mounted in the DOM.
    //    The video element is always rendered by QrScannerView (opacity-toggled),
    //    so it should be available immediately. But we guard with a small retry
    //    in case React hasn't committed the ref yet.
    const video = await this.waitForVideo();
    if (!video) {
      this.stop();
      throw this.makeError('unknown', 'تعذر العثور على عنصر الفيديو في الصفحة.');
    }

    video.srcObject = this.stream;
    video.setAttribute('playsinline', 'true');
    video.muted = true;

    // 5. Wait for loadedmetadata before calling play()
    //    iOS Safari requires this sequence — calling play() before
    //    the stream metadata is loaded results in a black preview.
    await this.waitForMetadata(video);

    try {
      await video.play();
    } catch {
      // Autoplay can reject on some browsers even with muted+playsInline.
      // The video may still play; if not, frames won't be available
      // and the user will see a static preview. Not fatal.
    }

    // 6. Prepare canvas context for frame extraction
    const canvas = this.canvasRef.current;
    if (canvas) {
      this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    }
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    const video = this.videoRef.current;
    if (video) {
      video.srcObject = null;
      video.pause();
    }
    this.ctx = null;
  }

  getFrame(): FrameData | null {
    const video = this.videoRef.current;
    const canvas = this.canvasRef.current;
    if (!video || !canvas || !this.ctx) return null;
    if (video.readyState < video.HAVE_CURRENT_DATA) return null;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    this.ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    return {
      data: imageData.data,
      width: imageData.width,
      height: imageData.height,
    };
  }

  isActive(): boolean {
    return this.stream !== null && this.stream.active === true;
  }

  /**
   * Wait for the video element ref to be populated.
   * Retries every 50ms for up to 2 seconds.
   */
  private waitForVideo(): Promise<HTMLVideoElement | null> {
    return new Promise((resolve) => {
      const existing = this.videoRef.current;
      if (existing) {
        resolve(existing);
        return;
      }
      let attempts = 0;
      const max = 40; // 40 × 50ms = 2s
      const interval = setInterval(() => {
        const v = this.videoRef.current;
        if (v) {
          clearInterval(interval);
          resolve(v);
        } else if (++attempts >= max) {
          clearInterval(interval);
          resolve(null);
        }
      }, 50);
    });
  }

  /**
   * Wait for the video element's loadedmetadata event.
   * On iOS Safari, video.play() will not produce a visible frame
   * until the metadata has loaded and the element knows its dimensions.
   */
  private waitForMetadata(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve) => {
      if (video.readyState >= 1) {
        resolve();
        return;
      }
      const onLoaded = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        resolve();
      };
      video.addEventListener('loadedmetadata', onLoaded, { once: true });

      // Safety timeout: don't hang forever if metadata never fires
      setTimeout(() => {
        video.removeEventListener('loadedmetadata', onLoaded);
        resolve();
      }, 3000);
    });
  }

  private classifyError(err: unknown): CameraError {
    const name = (err as DOMException)?.name ?? '';
    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return this.makeError('denied', 'تم رفض إذن الكاميرا. يرجى السماح بالوصول إلى الكاميرا في إعدادات المتصفح.');
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return this.makeError('notfound', 'لم يتم العثور على كاميرا على هذا الجهاز.');
      case 'NotReadableError':
      case 'TrackStartError':
        return this.makeError('inuse', 'الكاميرا قيد الاستخدام بواسطة تطبيق آخر. أغلق التطبيقات الأخرى وحاول مرة أخرى.');
      default:
        return this.makeError('unknown', 'تعذر الوصول إلى الكاميرا. تحقق من الأذونات وحاول مرة أخرى.');
    }
  }

  private makeError(kind: CameraError['kind'], message: string, originalError?: unknown): CameraError {
    return { kind, message, originalError };
  }
}
