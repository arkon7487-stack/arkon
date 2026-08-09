import { supabase } from '@/lib/supabase';
import { ARKON_COMPANY_ID } from '@/lib/supabase';
import type { Lead, LeadActivity, LeadStage } from '@/types';

export interface CreateLeadInput {
  full_name: string;
  phone_number: string;
  alternate_phone?: string;
  address?: string;
  area?: string;
  lead_source?: string;
  interested_service?: string;
  notes?: string;
  stage?: LeadStage;
  assigned_employee_id?: string;
  expected_value?: number;
  follow_up_date?: string;
}

export interface UpdateLeadInput extends Partial<CreateLeadInput> {
  stage?: LeadStage;
  lost_reason?: string;
  converted_client_id?: string;
}

export const leadService = {
  async list(): Promise<Lead[]> {
    const { data, error } = await supabase
      .from('leads')
      .select('*, assigned_employee:employees!leads_assigned_employee_id_fkey(id,full_name,job_title,phone_number)')
      .eq('company_id', ARKON_COMPANY_ID)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Lead[]) ?? [];
  },

  async get(id: string): Promise<Lead | null> {
    const { data, error } = await supabase
      .from('leads')
      .select('*, assigned_employee:employees!leads_assigned_employee_id_fkey(id,full_name,job_title,phone_number)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as Lead) ?? null;
  },

  async create(input: CreateLeadInput): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .insert({
        company_id: ARKON_COMPANY_ID,
        full_name: input.full_name.trim(),
        phone_number: input.phone_number.trim(),
        alternate_phone: input.alternate_phone?.trim() || null,
        address: input.address?.trim() || null,
        area: input.area?.trim() || null,
        lead_source: input.lead_source || null,
        interested_service: input.interested_service?.trim() || null,
        notes: input.notes?.trim() || null,
        stage: input.stage ?? 'new_lead',
        assigned_employee_id: input.assigned_employee_id || null,
        expected_value: input.expected_value ?? null,
        follow_up_date: input.follow_up_date || null,
      })
      .select('*, assigned_employee:employees!leads_assigned_employee_id_fkey(id,full_name,job_title,phone_number)')
      .maybeSingle();
    if (error) throw error;
    const lead = data as Lead;

    await this.addActivity(lead.id, 'lead_created', `تم إنشاء الليد: ${lead.full_name}`, 'النظام');
    return lead;
  },

  async update(id: string, patch: UpdateLeadInput): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, assigned_employee:employees!leads_assigned_employee_id_fkey(id,full_name,job_title,phone_number)')
      .maybeSingle();
    if (error) throw error;
    return data as Lead;
  },

  async changeStage(id: string, newStage: LeadStage, extra?: { lost_reason?: string }, actorName?: string): Promise<Lead> {
    const lead = await this.update(id, { stage: newStage, ...(extra ?? {}) });
    const stageLabels: Record<string, string> = {
      new_lead: 'ليد جديد',
      contacted: 'تم التواصل',
      follow_up: 'متابعة',
      quotation_sent: 'تم إرسال عرض',
      negotiation: 'تفاوض',
      won: 'رابح',
      lost: 'خسارة',
    };
    const msg =
      newStage === 'won' ? `تم الفوز بالصفقة للعميل: ${lead.full_name}` :
      newStage === 'lost' ? `خسارة الصفقة${extra?.lost_reason ? `: ${extra.lost_reason}` : ''}` :
      `تم نقل المرحلة إلى: ${stageLabels[newStage] ?? newStage}`;

    const eventType =
      newStage === 'won' ? 'deal_won' :
      newStage === 'lost' ? 'deal_lost' : 'stage_changed';

    await this.addActivity(id, eventType, msg, actorName);
    return lead;
  },

  async addActivity(leadId: string, eventType: string, message: string, userName?: string, meta?: Record<string, unknown>): Promise<LeadActivity> {
    const { data, error } = await supabase
      .from('lead_activities')
      .insert({ lead_id: leadId, event_type: eventType, message, user_name: userName ?? null, meta: meta ?? null })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as LeadActivity;
  },

  async getActivities(leadId: string): Promise<LeadActivity[]> {
    const { data, error } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as LeadActivity[]) ?? [];
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * List leads eligible for import into Customer Creation:
   * - Not lost
   * - Not already converted (converted_client_id IS NULL)
   * - Not already imported as a customer (no client with source_sales_lead_id = this lead)
   */
  async listEligibleForImport(): Promise<Lead[]> {
    const { data, error } = await supabase
      .from('leads')
      .select('*, assigned_employee:employees!leads_assigned_employee_id_fkey(id,full_name,job_title,phone_number)')
      .neq('stage', 'lost')
      .is('converted_client_id', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const allLeads = (data as Lead[]) ?? [];

    // Filter out leads that already have a customer created from them
    const { data: importedLeadIds } = await supabase
      .from('clients')
      .select('source_sales_lead_id')
      .not('source_sales_lead_id', 'is', null);
    const importedSet = new Set((importedLeadIds ?? []).map((r: { source_sales_lead_id: string }) => r.source_sales_lead_id));
    return allLeads.filter((l) => !importedSet.has(l.id));
  },

  /**
   * Mark a lead as converted into a customer. Links the new client ID,
   * sets conversion timestamp and user. Does NOT delete the lead.
   */
  async markConverted(leadId: string, clientId: string, convertedBy?: string): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .update({
        converted_client_id: clientId,
        converted_at: new Date().toISOString(),
        converted_by: convertedBy ?? null,
        stage: 'won',
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);
    if (error) throw error;
  },

  async getStats(): Promise<{
    total: number;
    byStage: Record<string, number>;
    conversionRate: number;
    totalExpectedValue: number;
  }> {
    const leads = await this.list();
    const byStage: Record<string, number> = {};
    let totalExpectedValue = 0;
    for (const l of leads) {
      byStage[l.stage] = (byStage[l.stage] ?? 0) + 1;
      if (l.expected_value) totalExpectedValue += Number(l.expected_value);
    }
    const won = byStage.won ?? 0;
    const lost = byStage.lost ?? 0;
    const total = leads.length;
    const conversionRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
    return { total, byStage, conversionRate, totalExpectedValue };
  },
};
