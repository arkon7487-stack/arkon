/**
 * Per-user notification preferences stored in localStorage.
 *
 * On mobile, these will be stored in AsyncStorage or native settings.
 * The interface stays the same — only the storage layer changes.
 */

import type { NotificationPreferences } from './types';
import { DEFAULT_PREFERENCES } from './types';

const PREFS_KEY = 'arkon_notification_prefs';

export function getPreferences(): NotificationPreferences {
  if (typeof localStorage === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function updatePreferences(patch: Partial<NotificationPreferences>): NotificationPreferences {
  const current = getPreferences();
  const next = { ...current, ...patch };
  savePreferences(next);
  return next;
}
