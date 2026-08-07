import { supabase } from '@/lib/supabase';
import type { ServiceRequest } from '@/types';

const ARKON_COMPANY_ID = '11111111-1111-1111-1111-111111111111';

export const serviceRequestService = {
  async listByClient(clientId: string): Promise<ServiceRequest[]> {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ServiceRequest[]) ?? [];
  },

  async create(input: {
    companyId: string;
    clientId: string;
    contractId?: string | null;
    subject: string;
    message: string;
  }): Promise<ServiceRequest> {
    const { data, error } = await supabase
      .from('service_requests')
      .insert({
        company_id: input.companyId,
        client_id: input.clientId,
        contract_id: input.contractId ?? null,
        subject: input.subject,
        message: input.message,
        status: 'open',
        source: 'customer_portal',
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;

    try {
      const { data: client } = await supabase
        .from('clients')
        .select('full_name')
        .eq('id', input.clientId)
        .maybeSingle();
      await supabase.from('notifications').insert({
        audience: 'admin',
        category: 'support',
        notification_type: 'general',
        title: 'طلب دعم جديد من عميل حالي',
        body: client?.full_name ? `${client.full_name} - ${input.subject}` : input.subject,
        read: false,
      });
    } catch { /* non-fatal */ }

    return data as ServiceRequest;
  },
};
