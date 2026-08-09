import { supabase } from '@/lib/supabase';
import { ARKON_COMPANY_ID } from '@/lib/supabase';
import type { Client } from '@/types';

export interface ClientInput {
  full_name: string;
  phone_number: string;
  email?: string;
  address?: string;
  service_area?: string;
  date_of_birth?: string;
  gender?: string;
  notes?: string;
  status?: string;
  medical_conditions?: string;
  allergies?: string;
  blood_type?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
}

export const clientService = {
  async list(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Client[]) ?? [];
  },

  async get(id: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as Client) ?? null;
  },

  async create(input: ClientInput): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...input, company_id: ARKON_COMPANY_ID, status: input.status ?? 'active' })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as Client;
  },

  async update(id: string, patch: Partial<ClientInput>): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as Client;
  },

  async checkDuplicate(phoneNumber: string, alternatePhone?: string): Promise<{ exists: boolean; client?: Client }> {
    const phones = [phoneNumber, alternatePhone].filter(Boolean);
    if (phones.length === 0) return { exists: false };
    const { data, error } = await supabase
      .from('clients')
      .select('id, full_name, phone_number, alternate_phone')
      .or(phones.map((p) => `phone_number.eq.${p}`).join(','))
      .maybeSingle();
    if (error) throw error;
    if (data) return { exists: true, client: data as Client };
    return { exists: false };
  },

  async search(query: string): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .or(`full_name.ilike.%${query}%,phone_number.ilike.%${query}%`)
      .order('full_name', { ascending: true })
      .limit(10);
    if (error) throw error;
    return (data as Client[]) ?? [];
  },

  async remove(id: string): Promise<void> {
    const client = await this.get(id);
    if (!client) throw new Error('العميل غير موجود');
    const clientName = client.full_name;

    const { data: contracts } = await supabase
      .from('contracts')
      .select('id')
      .eq('client_id', id);
    const contractIds = (contracts ?? []).map((c: { id: string }) => c.id);

    if (contractIds.length > 0) {
      await supabase
        .from('invoices')
        .update({ archived: true, archive_reason: 'Archived – Customer Deleted', archived_client_name: clientName })
        .in('contract_id', contractIds);

      const { data: invoices } = await supabase
        .from('invoices')
        .select('id')
        .in('contract_id', contractIds);
      const invoiceIds = (invoices ?? []).map((i: { id: string }) => i.id);
      if (invoiceIds.length > 0) {
        await supabase
          .from('payments')
          .update({ archived: true, archive_reason: 'Archived – Customer Deleted' })
          .in('invoice_id', invoiceIds);
      }
    }

    if (contractIds.length > 0) {
      await supabase.from('visits').delete().in('contract_id', contractIds);
    }

    await supabase.from('contracts').delete().eq('client_id', id);
    await supabase.from('qr_codes').delete().eq('client_id', id);

    await supabase
      .from('opportunities')
      .update({ status: 'lost', updated_at: new Date().toISOString() })
      .eq('converted_client_id', id);

    await supabase.from('activity_timeline').delete().eq('entity_type', 'client').eq('entity_id', id);
    await supabase.from('attachments').delete().eq('client_id', id);

    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
  },

  async getProfile(id: string) {
    const [clientRes, contractsRes, visitsRes, attachmentsRes, invoicesRes, activityRes, qrRes] =
      await Promise.all([
        supabase.from('clients').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('contracts')
          .select('*, package:packages(*), employee:employees(*)')
          .eq('client_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('visits')
          .select('*, employee:employees(*), contract:contracts!inner(client_id)')
          .eq('contract.client_id', id)
          .order('scheduled_date', { ascending: false }),
        supabase.from('attachments').select('*').eq('client_id', id),
        supabase
          .from('invoices')
          .select('*, contract:contracts!inner(client_id)')
          .eq('contract.client_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('activity_timeline')
          .select('*')
          .eq('entity_type', 'client')
          .eq('entity_id', id)
          .order('created_at', { ascending: false }),
        supabase.from('qr_codes').select('*').eq('client_id', id).maybeSingle(),
      ]);

    if (clientRes.error) throw clientRes.error;

    return {
      client: clientRes.data as Client | null,
      contracts: (contractsRes.data as any[]) ?? [],
      visits: (visitsRes.data as any[]) ?? [],
      attachments: (attachmentsRes.data as any[]) ?? [],
      invoices: (invoicesRes.data as any[]) ?? [],
      activity: (activityRes.data as any[]) ?? [],
      qrCode: (qrRes.data as any) ?? null,
    };
  },
};