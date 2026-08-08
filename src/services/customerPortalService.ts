import { supabase } from '@/lib/supabase';
import type { VisitWithRelations, ServiceRequest } from '@/types';

const ARKON_COMPANY_ID = '11111111-1111-1111-1111-111111111111';

function assertId(id: string | undefined | null, label: string): string {
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error(`CUSTOMER_IDENTITY_NOT_RESOLVED: ${label}`);
  }
  return id;
}

export const customerPortalService = {
  async getMyVisits(): Promise<VisitWithRelations[]> {
    const { data, error } = await supabase.from('visits').select('*, employee:employees(*), contract:contracts!inner(*, client:clients(*), package:packages(*))').order('scheduled_date', { ascending: true });
    if (error) throw error;
    return (data as VisitWithRelations[]) ?? [];
  },

  async getMyContract(): Promise<any | null> {
    const { data, error } = await supabase.from('contracts').select('*, package:packages(name)').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },

  async getMyUnpaidInvoiceCount(): Promise<number> {
    const { data, error } = await supabase.from('invoices').select('id, status, contract:contracts!inner(client_id)').neq('status', 'paid');
    if (error) throw error;
    return data?.length ?? 0;
  },

  async getMyInvoices(): Promise<any[]> {
    const { data, error } = await supabase.from('invoices').select('*, contract:contracts!inner(client_id)').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).filter((invoice: any) => !invoice.visit_id);
  },

  async getMyVisitCharges(): Promise<Array<{ visit: VisitWithRelations; invoice: any | null }>> {
    const { data: visits, error } = await supabase.from('visits').select('*, employee:employees(*), contract:contracts!inner(*, client:clients(*), package:packages(*))').neq('visit_type', 'normal').order('scheduled_date', { ascending: false });
    if (error) throw error;
    const result: Array<{ visit: VisitWithRelations; invoice: any | null }> = [];
    for (const visit of (visits ?? []) as VisitWithRelations[]) {
      const { data: invoice } = await supabase.from('invoices').select('*').eq('visit_id', visit.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      result.push({ visit, invoice: invoice ?? null });
    }
    return result;
  },

  async getMySupportRequests(): Promise<ServiceRequest[]> {
    const { data, error } = await supabase.from('service_requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ServiceRequest[]) ?? [];
  },

  async createMyServiceRequest(subject: string, message: string): Promise<ServiceRequest> {
    const { data, error } = await supabase.rpc('create_my_service_request', { p_subject: subject, p_message: message });
    if (error) throw error;
    return data as ServiceRequest;
  },

  async getMyRatingForVisit(visitId: string): Promise<any | null> {
    const { data, error } = await supabase.from('visit_ratings').select('*').eq('visit_id', visitId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async createMyRating(input: { visitId: string; clientId: string; employeeId?: string | null; rating: number; comment?: string }): Promise<any> {
    const clientId = assertId(input.clientId, 'client_id');
    const { data, error } = await supabase.from('visit_ratings').insert({ company_id: ARKON_COMPANY_ID, visit_id: input.visitId, client_id: clientId, employee_id: input.employeeId ?? null, rating: input.rating, comment: input.comment?.trim() || null }).select('*').maybeSingle();
    if (error) throw error;
    return data;
  },
};
