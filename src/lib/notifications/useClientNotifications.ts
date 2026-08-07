/**
 * useClientNotifications — realtime notification hook for the Customer Portal.
 *
 * Subscribes to INSERT events on the notifications table filtered to
 * audience='client'. RLS ensures the client only sees their own
 * notifications (get_client_id_from_token via x-client-token header).
 *
 * On new notification: plays sound (best-effort), shows toast, calls callback.
 * Sound only plays for NEW notifications arriving during the active session,
 * not for existing ones loaded on mount.
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { deliverNotification, warmAudioContext } from '@/lib/notifications/manager';
import type { RichNotification } from '@/lib/notifications/types';

interface UseClientNotificationsOptions {
  onNewNotification?: (notif: RichNotification) => void;
  enabled?: boolean;
}

export function useClientNotifications(options: UseClientNotificationsOptions = {}): void {
  const { onNewNotification, enabled = true } = options;
  const callbackRef = useRef(onNewNotification);
  callbackRef.current = onNewNotification;

  const handlePayload = useCallback((payload: { new: Record<string, unknown> }) => {
    const row = payload.new as unknown as RichNotification;
    if (!row || !row.id) return;
    if (row.audience !== 'client') return;

    deliverNotification(row);
    callbackRef.current?.(row);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    warmAudioContext();

    const channel = supabase
      .channel('client-notifications-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'audience=eq.client' },
        handlePayload,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, handlePayload]);
}
