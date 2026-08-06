import { supabase } from '@/lib/supabase';
import type { ContractPayment } from '@/types';

export interface RecordPaymentInput {
  contract_id: string;
  amount: number;
  payment_method?: string;
  payment_date?: string;
  notes?: string;
  recorded_by?: string;
}

export const contractPaymentService = {
  async record(input: RecordPaymentInput): Promise<ContractPayment> {
    if (input.amount <= 0) throw new Error('قيمة الدفعة يجب أن تكون أكبر من الصفر');

    const { data, error } = await supabase.rpc('record_contract_payment', {
      p_contract_id: input.contract_id,
      p_amount: input.amount,
      p_payment_method: input.payment_method || null,
      p_payment_date: input.payment_date ?? new Date().toISOString().slice(0, 10),
      p_notes: input.notes ?? null,
    });
    if (error) {
      const raw = `${error.message ?? ''}`;
      if (raw.includes('amount_exceeds_remaining')) throw new Error('قيمة الدفعة أكبر من المبلغ المتبقي على العقد');
      if (raw.includes('invalid_amount')) throw new Error('قيمة الدفعة يجب أن تكون أكبر من الصفر');
      if (raw.includes('contract_not_found')) throw new Error('العقد غير موجود');
      if (raw.includes('not_authorized')) throw new Error('لا تملك صلاحية تسجيل الدفعات');
      throw new Error('تعذر تسجيل الدفعة. يرجى المحاولة مرة أخرى.');
    }
    return data as ContractPayment;
  },

  async getForContract(contractId: string): Promise<ContractPayment[]> {
    const { data, error } = await supabase
      .from('contract_payments')
      .select('*')
      .eq('contract_id', contractId)
      .order('payment_date', { ascending: true });
    if (error) throw error;
    return (data as ContractPayment[]) ?? [];
  },

  async getReceivables(): Promise<Array<{
    contract_id: string;
    contract_number: string;
    client_name: string;
    final_amount: number;
    amount_paid: number;
    remaining_balance: number;
    payment_status: string;
    end_date: string;
  }>> {
    const { data, error } = await supabase
      .from('contracts')
      .select('id, contract_number, final_amount, amount_paid, remaining_balance, payment_status, end_date, client:clients(full_name)')
      .neq('payment_status', 'fully_paid')
      .in('status', ['active', 'draft'])
      .order('end_date', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      contract_id: r.id as string,
      contract_number: r.contract_number as string,
      client_name: ((r.client as Record<string, unknown>)?.full_name as string) ?? '—',
      final_amount: Number(r.final_amount ?? 0),
      amount_paid: Number(r.amount_paid ?? 0),
      remaining_balance: Number(r.remaining_balance ?? 0),
      payment_status: r.payment_status as string,
      end_date: r.end_date as string,
    }));
  },

  async getRevenueSummary(): Promise<{ collected: number; outstanding: number }> {
    const { data, error } = await supabase
      .from('contracts')
      .select('final_amount, amount_paid, remaining_balance, status')
      .in('status', ['active', 'draft', 'archived']);
    if (error) throw error;
    let collected = 0;
    let outstanding = 0;
    for (const c of (data ?? []) as Array<Record<string, unknown>>) {
      collected += Number(c.amount_paid ?? 0);
      outstanding += Number(c.remaining_balance ?? 0);
    }
    return { collected, outstanding };
  },
};
