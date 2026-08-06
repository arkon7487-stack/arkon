/**
 * Synchronization Layer — Supabase Realtime.
 *
 * After a QR scan updates a visit's status in the database,
 * this layer ensures every connected screen (Admin Dashboard, Worker App,
 * Customer Portal) receives the update instantly via Supabase Realtime.
 */

import { supabase } from '@/lib/supabase';
import type { VisitWithRelations } from '@/types';

export type VisitChangeHandler = () => void;

export class QrRealtimeSync {
  private channel: ReturnType<typeof supabase.channel> | null = null;

  /**
   * Subscribe to visit status changes.
   * The handler is called whenever any visit row is inserted, updated, or deleted.
   */
  subscribe(handler: VisitChangeHandler): void {
    this.unsubscribe();

    const channelName = `visits-realtime-${Math.random().toString(36).slice(2, 8)}`;
    this.channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits' },
        (payload) => {
          const eventType = payload.eventType;
          const table = payload.table;
          const oldStatus = (payload.old as Record<string, unknown>)?.status;
          const newStatus = (payload.new as Record<string, unknown>)?.status;
          const visitId = (payload.new as Record<string, unknown>)?.id;
          const employeeId = (payload.new as Record<string, unknown>)?.employee_id;
          const clientId = (payload.new as Record<string, unknown>)?.client_id;
          console.debug('[QR Realtime] event:', { eventType, table, visitId, employeeId, clientId, oldStatus, newStatus });
          handler();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug('[QR Realtime] Channel subscribed:', channelName);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[QR Realtime] Channel error:', channelName);
        } else if (status === 'TIMED_OUT') {
          console.error('[QR Realtime] Channel timed out:', channelName);
        } else if (status === 'CLOSED') {
          console.debug('[QR Realtime] Channel closed:', channelName);
        }
      });
  }

  unsubscribe(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  static async refreshWorkerVisits(employeeId: string): Promise<VisitWithRelations[]> {
    return visitService.getByEmployee(employeeId);
  }

  static async refreshClientVisits(clientId: string): Promise<VisitWithRelations[]> {
    return visitService.getByClient(clientId);
  }
}

import { visitService } from '@/services/visitService';
