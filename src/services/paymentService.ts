import { supabase } from '@/lib/supabase';
import type { Payment, PaymentWithRelations } from '@/types';
import { auditService } from './auditService';
import { notificationService } from './notificationService';

export interface PaymentInput {
  invoice_id: string;
  amount: number;
  method?: string;
  reference?: string;
  notes?: string;
}

export const paymentService = {
  async list(): Promise<PaymentWithRelations[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*, invoice:invoices(*, contract:contracts(*, client:clients(*))')
      .order('paid_at', { ascending: false });
    if (error) throw error;
    return (data as PaymentWithRelations[]) ?? [];
  },

  async getByInvoice(invoiceId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: false });
    if (error) throw error;
    return (data as Payment[]) ?? [];
  },

  async record(input: PaymentInput): Promise<Payment> {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        invoice_id: input.invoice_id,
        amount: input.amount,
        method: input.method ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    const payment = data as Payment;

    await auditService.log({ action: 'payment_record', entityType: 'payment', entityId: payment.id, newValue: { amount: input.amount, method: input.method } });

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, contract:contracts(*, client:clients(*))')
      .eq('id', input.invoice_id)
      .maybeSingle();

    if (invoice) {
      const clientName = (invoice as any)?.contract?.client?.full_name ?? 'client';
      await notificationService.create({
        category: 'payment',
        title: 'Payment received',
        body: `${input.amount} from ${clientName}`,
      });
    }

    return payment;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) throw error;
  },
};
