import { supabase } from '@/lib/supabase';
import type { AuditLog } from '@/types';

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

export const auditService = {
  async log(entry: AuditEntry): Promise<void> {
    const { data: session } = await supabase.auth.getUser();
    const { error } = await supabase.from('audit_logs').insert({
      actor_id: session.user?.id ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      details: entry.details ?? null,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
    });
    if (error) throw error;
  },

  async list(limit = 100): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as AuditLog[]) ?? [];
  },

  async getByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as AuditLog[]) ?? [];
  },
};
