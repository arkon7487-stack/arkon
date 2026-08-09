import { supabase } from '@/lib/supabase';
import { auditService } from './auditService';
import { notificationService } from './notificationService';
import type { ContractPayment } from '@/types';

export interface ContractPaymentInput {
  contract_id: string;
  amount: number;
  payment_method?: string;
  payment_date?: string;
  notes?: string;
}

export const contractPaymentService = {
  async list(): Promise<ContractPayment[]> {
    const { data, error } = await supabase
      .from('contract_payments')
      .select('*, contract:contracts(*, client:clients(*))')
      .order('payment_date', { ascending: false });
    if (error) throw error;
    return (data as ContractPayment[]) ?? [];
  },

  async record(input: ContractPaymentInput): Promise<ContractPayment> {
    if (input.amount <= 0) throw new Error('قيمة الدفعة يجب أن تكون أكبر من الصفر');

    const { data, error } = await supabase.rpc('record_contract_payment', {
      p_contract_id: input.contract_id,
      p_amount: input.amount,
      p_payment_method: input.payment_method ?? null,
      p_payment_date: input.payment_date ?? null,
      p_notes: input.notes ?? null,
    });

    if (error) {
      const raw = `${error.message ?? ''}`;
      if (raw.includes('already_paid')) throw new Error('هذا العقد مدفوع بالكامل');
      if (raw.includes('amount_exceeds_remaining')) throw new Error('قيمة الدفعة أكبر من المبلغ المتبقي على العقد');
      if (raw.includes('invalid_amount')) throw new Error('قيمة الدفعة يجب أن تكون أكبر من الصفر');
      if (raw.includes('contract_not_found')) throw new Error('العقد غير موجود');
      if (raw.includes('not_authorized')) throw new Error('لا تملك صلاحية تسجيل الدفعات');
      throw new Error('تعذر تسجيل الدفعة. يرجى المحاولة مرة أخرى.');
    }

    const payment = data as ContractPayment;
    await auditService.log({
      action: 'contract_payment_record',
      entityType: 'contract',
      entityId: input.contract_id,
      newValue: { amount: input.amount, method: input.payment_method },
    });

    const { data: contract } = await supabase
      .from('contracts')
      .select('*, client:clients(*)')
      .eq('id', input.contract_id)
      .maybeSingle();

    if (contract) {
      const clientName = (contract as any)?.client?.full_name ?? 'client';
      await notificationService.create({
        category: 'payment',
        title: 'Payment received',
        body: `${input.amount} from ${clientName}`,
      });
    }

    return payment;
  },
};
