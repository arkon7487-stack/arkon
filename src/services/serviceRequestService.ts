import { supabase } from '@/lib/supabase';
import type { ServiceRequest } from '@/types';

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
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as ServiceRequest;
  },
};
