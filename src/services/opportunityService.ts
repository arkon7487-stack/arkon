import { supabase } from '@/lib/supabase';
import { ARKON_COMPANY_ID } from '@/lib/supabase';
import type { Opportunity } from '@/types';

export interface OpportunityInput {
  customer_name: string;
  phone_number: string;
  alt_phone?: string;
  address?: string;
  city?: string;
  location_link?: string;
  interested_service?: string;
  expected_budget?: number;
  lead_source?: string;
  notes?: string;
  priority?: string;
  created_by?: string | null;
}

export const opportunityService = {
  async list(): Promise<Opportunity[]> {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*, creator:employees(*)')
      .eq('company_id', ARKON_COMPANY_ID)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Opportunity[]) ?? [];
  },

  async create(input: OpportunityInput): Promise<Opportunity> {
    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        company_id: ARKON_COMPANY_ID,
        ...input,
        status: 'new',
        priority: input.priority ?? 'medium',
      })
      .select('*, creator:employees(*)')
      .maybeSingle();
    if (error) throw error;
    const opp = data as Opportunity;

    // Auto-create a linked Sales lead (idempotent — only if not already linked)
    if (opp && !opp.sales_lead_id) {
      try {
        const { data: lead, error: leadErr } = await supabase
          .from('leads')
          .insert({
            company_id: ARKON_COMPANY_ID,
            full_name: input.customer_name,
            phone_number: input.phone_number,
            alternate_phone: input.alt_phone || null,
            address: input.address || null,
            area: input.city || null,
            lead_source: input.lead_source || null,
            interested_service: input.interested_service || null,
            notes: input.notes || null,
            stage: 'new_lead',
            opportunity_id: opp.id,
          })
          .select('id')
          .maybeSingle();

        if (!leadErr && lead) {
          await supabase
            .from('opportunities')
            .update({ sales_lead_id: lead.id, sent_to_sales_at: new Date().toISOString(), status: 'sent_to_sales' })
            .eq('id', opp.id);
          opp.sales_lead_id = lead.id;
          opp.sent_to_sales_at = new Date().toISOString();
          opp.status = 'sent_to_sales';
        }
      } catch {
        // Non-fatal: the opportunity was created; the sales lead can be linked later
      }
    }

    return opp;
  },

  async update(id: string, patch: Partial<OpportunityInput>): Promise<Opportunity> {
    const { data, error } = await supabase
      .from('opportunities')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, creator:employees(*)')
      .maybeSingle();
    if (error) throw error;
    return data as Opportunity;
  },

  async updateStatus(id: string, status: string): Promise<Opportunity> {
    return this.update(id, { } as any).then(async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, creator:employees(*)')
        .maybeSingle();
      if (error) throw error;
      return data as Opportunity;
    });
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('opportunities').delete().eq('id', id);
    if (error) throw error;
  },

  async convert(
    id: string,
    clientData: { full_name: string; phone_number: string; address?: string; email?: string; service_area?: string },
    contractData: { package_id: string; start_date: string; end_date: string; price: number; final_amount: number },
  ): Promise<{ clientId: string; contractId: string }> {
    // 1. Create client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .insert({ company_id: ARKON_COMPANY_ID, ...clientData, status: 'active' })
      .select('*')
      .maybeSingle();
    if (clientErr) throw clientErr;
    const clientId = (client as any).id;

    // 2. Create contract
    const contractNumber = `CON-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { data: contract, error: contractErr } = await supabase
      .from('contracts')
      .insert({
        company_id: ARKON_COMPANY_ID,
        contract_number: contractNumber,
        client_id: clientId,
        package_id: contractData.package_id,
        start_date: contractData.start_date,
        end_date: contractData.end_date,
        status: 'active',
        price: contractData.price,
        discount: 0,
        tax: 0,
        final_amount: contractData.final_amount,
        payment_status: 'unpaid',
        remaining_balance: contractData.final_amount,
        activated_at: new Date().toISOString(),
      })
      .select('*')
      .maybeSingle();
    if (contractErr) throw contractErr;
    const contractId = (contract as any).id;

    // 3. Mark opportunity as converted
    await supabase
      .from('opportunities')
      .update({
        status: 'converted',
        converted_client_id: clientId,
        converted_contract_id: contractId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return { clientId, contractId };
  },
};
