/**
 * useClientNotifications — realtime notification hook for the Customer Portal.
 *
 * Subscribes to INSERT events on the notifications table filtered to
 * audience='client'. RLS ensures the client only sees their own
 * notifications (get_client_id_from_token via x-client-token header).
 *
 * Each hook instance creates its own uniquely-named channel so multiple
 * components can coexist without colliding on the same RealtimeChannel.
 *
 * Sound only plays for NEW notifications arriving during the active session,
 * not for existing ones loaded on mount.
 * Realtime failures are non-fatal — the page still renders existing data.
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { deliverNotification, warmAudioContext } from '@/lib/notifications/manager';
import { unlockAudioContext } from '@/lib/notifications/sounds';
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

    let unlocked = false;
    const unlockFromGesture = () => {
      if (unlocked) return;
      unlocked = true;
      unlockAudioContext();
      document.removeEventListener('pointerdown', unlockFromGesture);
      document.removeEventListener('keydown', unlockFromGesture);
    };

    document.addEventListener('pointerdown', unlockFromGesture, { passive: true });
    document.addEventListener('keydown', unlockFromGesture, { passive: true });

    const channelName = `client-notifications-realtime-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'audience=eq.client' },
        handlePayload,
      );

    try {
      channel.subscribe();
    } catch {
      supabase.removeChannel(channel);
      return () => {
        document.removeEventListener('pointerdown', unlockFromGesture);
        document.removeEventListener('keydown', unlockFromGesture);
      };
    }

    return () => {
      document.removeEventListener('pointerdown', unlockFromGesture);
      document.removeEventListener('keydown', unlockFromGesture);
      supabase.removeChannel(channel);
    };
  }, [enabled, handlePayload]);
}
