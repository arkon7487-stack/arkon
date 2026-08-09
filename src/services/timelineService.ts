import { supabase } from '@/lib/supabase';
import type { ActivityTimelineEntry } from '@/types';

export const timelineService = {
  async add(entityType: string, entityId: string, eventType: string, message: string, meta?: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from('activity_timeline').insert({
      entity_type: entityType,
      entity_id: entityId,
      event_type: eventType,
      message,
      meta: meta ?? null,
    });
    if (error) throw error;
  },

  async getByEntity(entityType: string, entityId: string): Promise<ActivityTimelineEntry[]> {
    const { data, error } = await supabase
      .from('activity_timeline')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ActivityTimelineEntry[]) ?? [];
  },

  async getRecent(limit = 20): Promise<ActivityTimelineEntry[]> {
    const { data, error } = await supabase
      .from('activity_timeline')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as ActivityTimelineEntry[]) ?? [];
  },
};
