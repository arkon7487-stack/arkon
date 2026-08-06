/**
 * useNotifications — React hook for subscribing to realtime notifications.
 *
 * Creates a SINGLE Supabase Realtime subscription on the notifications table
 * (INSERT events only). Filters by the current user's scope:
 * - Workers: only notifications where recipient_employee_id matches their employee_id
 * - Admins: all admin-audience notifications
 *
 * On new notification: calls the onNewNotification callback + triggers data refresh.
 *
 * Duplicate protection: the NotificationManager tracks processed IDs.
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { deliverNotification, warmAudioContext } from '@/lib/notifications/manager';
import type { RichNotification } from '@/lib/notifications/types';

interface UseNotificationsOptions {
  onNewNotification?: (notif: RichNotification) => void;
  enabled?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}): void {
  const { onNewNotification, enabled = true } = options;
  const { session } = useAuth();
  const callbackRef = useRef(onNewNotification);
  callbackRef.current = onNewNotification;

  const employeeId = session?.profile?.employee_id;
  const isAdmin = session?.kind === 'staff' && (
    session.role?.key === 'super_admin' ||
    session.role?.key === 'admin' ||
    session.role?.key === 'manager'
  );

  const handlePayload = useCallback((payload: { new: Record<string, unknown> }) => {
    const row = payload.new as unknown as RichNotification;
    if (!row || !row.id) return;

    // Scope filtering
    if (isAdmin) {
      // Admins receive admin-audience notifications
      if (row.audience !== 'admin' && row.audience !== 'staff') return;
    } else if (employeeId) {
      // Workers only receive their own notifications
      if (row.recipient_employee_id !== employeeId) return;
    } else {
      return;
    }

    deliverNotification(row);
    callbackRef.current?.(row);
  }, [isAdmin, employeeId]);

  useEffect(() => {
    if (!enabled || !session) return;

    // Warm audio context on first interaction
    warmAudioContext();

    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        handlePayload,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, session, handlePayload]);
}
