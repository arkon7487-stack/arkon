/**
 * useNotifications — React hook for subscribing to realtime notifications.
 *
 * Creates a Supabase Realtime subscription on the notifications table
 * (INSERT events only). Each hook instance creates its own uniquely-named
 * channel so multiple components (Header bell + full Notifications page)
 * can coexist without colliding on the same RealtimeChannel instance.
 *
 * Scope filtering:
 * - Workers: only notifications where recipient_employee_id matches their employee_id
 * - Admins: all admin-audience notifications
 *
 * Duplicate protection: the NotificationManager tracks processed IDs.
 * Realtime failures are non-fatal — the page still renders existing data.
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

    if (isAdmin) {
      if (row.audience !== 'admin' && row.audience !== 'staff') return;
    } else if (employeeId) {
      if (row.recipient_employee_id !== employeeId) return;
    } else {
      return;
    }

    deliverNotification(row);
    callbackRef.current?.(row);
  }, [isAdmin, employeeId]);

  useEffect(() => {
    if (!enabled || !session) return;

    warmAudioContext();

    const channelName = `notifications-realtime-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        handlePayload,
      );

    try {
      channel.subscribe();
    } catch {
      // Realtime subscription failure is non-fatal;
      // existing notifications remain visible via the initial fetch.
      supabase.removeChannel(channel);
      return;
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, session, handlePayload]);
}
