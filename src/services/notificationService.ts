import { supabase } from '@/lib/supabase';
import type { NotificationItem, RichNotification } from '@/types';

export interface CreateNotificationInput {
  audience?: string;
  category?: string;
  notification_type?: string;
  recipient_employee_id?: string;
  title: string;
  body?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export const notificationService = {
  async list(): Promise<NotificationItem[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data as NotificationItem[]) ?? [];
  },

  async listForEmployee(employeeId: string): Promise<RichNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data as RichNotification[]) ?? [];
  },

  async listForAdmin(): Promise<RichNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or('audience.eq.admin,audience.eq.staff,recipient_employee_id.is.null')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data as RichNotification[]) ?? [];
  },

  async create(input: CreateNotificationInput): Promise<void> {
    const { error } = await supabase.from('notifications').insert({
      audience: input.audience ?? 'staff',
      category: input.category ?? 'general',
      notification_type: input.notification_type ?? 'general',
      recipient_employee_id: input.recipient_employee_id ?? null,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      read: false,
      metadata: input.metadata ?? {},
    });
    if (error) throw error;
  },

  async notifyContractExpiring(contractNumber: string, clientName: string, daysLeft: number, contractId: string): Promise<void> {
    await this.create({
      category: 'contract',
      notification_type: 'contract',
      title: daysLeft < 0 ? 'Contract expired without renewal' : `Contract expires in ${daysLeft} days`,
      body: `${contractNumber} · ${clientName}`,
      link: `/contracts/${contractId}`,
    });
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) throw error;
  },

  async markAllRead(): Promise<void> {
    const { error } = await supabase.from('notifications').update({ read: true }).neq('read', true);
    if (error) throw error;
  },

  async markAllReadForEmployee(employeeId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_employee_id', employeeId)
      .neq('read', true);
    if (error) throw error;
  },

  async unreadCountForEmployee(employeeId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_employee_id', employeeId)
      .eq('read', false);
    if (error) throw error;
    return count ?? 0;
  },

  async unreadCountForAdmin(): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .or('audience.eq.admin,audience.eq.staff,recipient_employee_id.is.null')
      .eq('read', false);
    if (error) throw error;
    return count ?? 0;
  },

  async listForClient(): Promise<RichNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('audience', 'client')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data as RichNotification[]) ?? [];
  },

  async unreadCountForClient(): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('audience', 'client')
      .eq('read', false);
    if (error) throw error;
    return count ?? 0;
  },

  async markAllReadForClient(): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('audience', 'client')
      .neq('read', true);
    if (error) throw error;
  },
};
