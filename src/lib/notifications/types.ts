/**
 * Notification type definitions for the ARKON realtime notification system.
 *
 * The notification_type field maps to a specific sound, toast style, and
 * browser notification category. The delivery layer (NotificationManager)
 * uses these types to decide how to present the notification.
 *
 * For future mobile push: these same types will map to FCM/APNs
 * notification channels — only the delivery layer changes.
 */

export type NotificationType =
  | 'visit_assigned'
  | 'visit_updated'
  | 'visit_cancelled'
  | 'visit_started'
  | 'visit_completed'
  | 'new_lead'
  | 'contract'
  | 'schedule'
  | 'general';

export interface NotificationMetadata {
  visit_id?: string;
  employee_id?: string;
  contract_id?: string;
  client_name?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  package_name?: string;
  old_status?: string;
  new_status?: string;
  changes?: string[];
  [key: string]: unknown;
}

export interface RichNotification {
  id: string;
  audience: string;
  category: string;
  notification_type: NotificationType;
  recipient_employee_id: string | null;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  metadata: NotificationMetadata | null;
  created_at: string;
}

export interface NotificationPreferences {
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
  toastEnabled: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  soundEnabled: true,
  browserNotificationsEnabled: true,
  toastEnabled: true,
};

/** Sound IDs mapped to notification types */
export const SOUND_MAP: Record<NotificationType, string> = {
  visit_assigned: 'new_visit',
  visit_updated: 'visit_updated',
  visit_cancelled: 'visit_cancelled',
  visit_started: 'visit_started',
  visit_completed: 'visit_completed',
  new_lead: 'new_lead',
  contract: 'contract',
  schedule: 'schedule',
  general: 'general',
};
