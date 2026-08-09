import { supabase } from '@/lib/supabase';
import type { Settings } from '@/types';

export const settingsService = {
  async getAll(): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) throw error;
    const map: Record<string, unknown> = {};
    for (const row of (data as Settings[]) ?? []) {
      map[row.key] = row.value;
    }
    return map;
  },

  async get<T>(key: string, fallback: T): Promise<T> {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return (data?.value as T) ?? fallback;
  },

  async set(key: string, value: unknown): Promise<void> {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  },

  async setMany(entries: Record<string, unknown>): Promise<void> {
    const rows = Object.entries(entries).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
  },
};
