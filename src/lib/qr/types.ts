/**
 * Shared QR types — platform-agnostic.
 *
 * These interfaces are used by every layer of the QR system:
 *   Camera Layer → Scanner Layer → Validation Layer → Visit Status Layer → Sync Layer
 *
 * The ONLY layer that changes between Web and React Native is the Camera Layer.
 * Everything else (types, validation, workflow, sync) is identical across platforms.
 */

/** Error categories the camera layer can report. */
export type CameraErrorKind =
  | 'https'        // Not in a secure context (HTTPS or localhost)
  | 'unsupported'  // Browser/device lacks MediaDevices API entirely
  | 'denied'       // User denied camera permission
  | 'notfound'     // No camera hardware found
  | 'inuse'        // Camera is locked by another app/tab
  | 'unknown';     // Anything else

/** Structured camera error with a user-friendly Arabic message. */
export interface CameraError {
  kind: CameraErrorKind;
  message: string;
  originalError?: unknown;
}

/** State of the camera/scanner lifecycle. */
export type ScanState = 'idle' | 'starting' | 'scanning' | 'error' | 'stopped';

/**
 * Platform-agnostic camera interface.
 *
 * Web implementation: uses navigator.mediaDevices.getUserMedia + <video> + <canvas>.
 * React Native implementation: will use react-native-vision-camera or expo-camera.
 *
 * Both implementations must satisfy this interface so the scanner layer
 * can call them identically.
 */
export interface CameraController {
  /** Start the camera, preferring the rear lens. Resolves once the stream is live. */
  start(): Promise<void>;
  /** Stop the camera and release all hardware resources. */
  stop(): void;
  /**
   * Grab a single frame as raw RGBA pixel data.
   * Returns null if the camera isn't ready yet (caller should retry).
   */
  getFrame(): FrameData | null;
  /** Whether the camera stream is currently active. */
  isActive(): boolean;
}

/** Raw pixel data from a camera frame, platform-agnostic. */
export interface FrameData {
  /** RGBA pixel buffer, 4 bytes per pixel. */
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** Result of QR validation against the database. */
export interface QrValidationResult {
  valid: boolean;
  clientId?: string;
  codeValue?: string;
}

/** Which visit action a QR scan should trigger. */
export type ScanAction = 'start_visit' | 'finish_visit' | 'none';

/** Outcome of processing a scanned QR code through the full workflow. */
export interface QrWorkflowResult {
  success: boolean;
  action: ScanAction;
  visitId?: string;
  message: string;
}

/** Callback the scanner layer invokes when a QR code is decoded. */
export type OnCodeDecoded = (code: string) => void;

/** Callback the camera layer invokes when an error occurs. */
export type OnCameraError = (error: CameraError) => void;

/** Callback when the scan state changes. */
export type OnScanStateChange = (state: ScanState) => void;
