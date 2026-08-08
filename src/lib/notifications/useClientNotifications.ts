import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
import { deliverNotification, warmAudioContext } from '@/lib/notifications/manager';
import { unlockAudioContext } from '@/lib/notifications/sounds';
import type { RichNotification } from '@/lib/notifications/types';

interface UseClientNotificationsOptions {
  onNewNotification?: (notif: RichNotification) => void;
  enabled?: boolean;
}

const POLL_INTERVAL_MS = 15000;

export function useClientNotifications(options: UseClientNotificationsOptions = {}): void {
  const { onNewNotification, enabled = true } = options;
  const callbackRef = useRef(onNewNotification);
  const knownIdsRef = useRef(new Set<string>());
  const initializedRef = useRef(false);
  callbackRef.current = onNewNotification;

  const deliverNew = useCallback((row: RichNotification) => {
    if (!row?.id || row.audience !== 'client' || knownIdsRef.current.has(row.id)) return;
    knownIdsRef.current.add(row.id);
    deliverNotification(row);
    callbackRef.current?.(row);
  }, []);

  const syncNotifications = useCallback(async () => {
    try {
      const rows = await notificationService.listForClient();
      if (!initializedRef.current) {
        rows.forEach((row) => knownIdsRef.current.add(row.id));
        initializedRef.current = true;
        return;
      }
      rows.slice().reverse().forEach(deliverNew);
    } catch {
      // Polling is best-effort; the next interval or focus refresh retries.
    }
  }, [deliverNew]);

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
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') void syncNotifications();
    };

    document.addEventListener('pointerdown', unlockFromGesture, { passive: true });
    document.addEventListener('keydown', unlockFromGesture, { passive: true });
    document.addEventListener('visibilitychange', refreshOnReturn);
    window.addEventListener('focus', refreshOnReturn);

    const channelName = `client-notifications-realtime-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'audience=eq.client' },
        (payload: { new: Record<string, unknown> }) => deliverNew(payload.new as unknown as RichNotification),
      );

    void syncNotifications();
    const interval = window.setInterval(() => { void syncNotifications(); }, POLL_INTERVAL_MS);

    try {
      channel.subscribe();
    } catch {
      supabase.removeChannel(channel);
    }

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('pointerdown', unlockFromGesture);
      document.removeEventListener('keydown', unlockFromGesture);
      document.removeEventListener('visibilitychange', refreshOnReturn);
      window.removeEventListener('focus', refreshOnReturn);
      supabase.removeChannel(channel);
    };
  }, [enabled, deliverNew, syncNotifications]);
}
