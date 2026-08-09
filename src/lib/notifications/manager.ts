/**
 * NotificationManager — the delivery layer for ARKON notifications.
 *
 * This is the ONLY layer that changes when moving to native mobile push.
 * On web: delivers via toast + browser notification + sound.
 * On mobile (future): will deliver via native push (FCM/APNs) + local notification + sound.
 *
 * The business logic (when to notify, who to notify, notification content)
 * lives in the database triggers and is identical across platforms.
 *
 * Duplicate protection: each notification ID is tracked — the same ID
 * can never produce two sounds, two toasts, or two browser notifications.
 */

import type { RichNotification, NotificationType } from './types';
import { SOUND_MAP } from './types';
import { playSound, warmAudioContext } from './sounds';
import { getPreferences } from './preferences';

type ToastPush = (type: 'success' | 'error' | 'info', message: string) => void;

const processedIds = new Set<string>();
const MAX_PROCESSED = 200;

let toastPushFn: ToastPush | null = null;

export function setToastPushFn(fn: ToastPush): void {
  toastPushFn = fn;
}

function trimProcessed(): void {
  if (processedIds.size > MAX_PROCESSED) {
    const arr = Array.from(processedIds);
    processedIds.clear();
    arr.slice(-100).forEach((id) => processedIds.add(id));
  }
}

function shouldShowBrowserNotification(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

function showBrowserNotification(title: string, body: string, link: string | null): void {
  if (!shouldShowBrowserNotification()) return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/arkon-logo.svg',
      tag: 'arkon-notification',
      data: { link },
    });
    n.onclick = () => {
      window.focus();
      if (link) {
        window.location.href = link;
      }
      n.close();
    };
  } catch {
    // ignore
  }
}

export function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return Promise.resolve('denied');
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Promise.resolve(Notification.permission);
  }
  return Notification.requestPermission();
}

export function deliverNotification(notif: RichNotification): void {
  // Duplicate protection — never process the same notification twice
  if (processedIds.has(notif.id)) return;
  processedIds.add(notif.id);
  trimProcessed();

  const prefs = getPreferences();
  const soundId = SOUND_MAP[notif.notification_type] ?? 'general';

  // Sound
  if (prefs.soundEnabled) {
    playSound(soundId);
  }

  // Toast
  if (prefs.toastEnabled && toastPushFn) {
    const toastType: 'success' | 'info' = notif.notification_type === 'visit_completed' ? 'success' : 'info';
    const message = notif.body ?? notif.title;
    toastPushFn(toastType, message);
  }

  // Browser notification (when tab not focused)
  if (prefs.browserNotificationsEnabled && typeof document !== 'undefined' && !document.hasFocus()) {
    showBrowserNotification(notif.title, notif.body ?? '', notif.link);
  }
}

export { warmAudioContext };
