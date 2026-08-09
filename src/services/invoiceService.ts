import { supabase } from '@/lib/supabase';
import { ARKON_COMPANY_ID } from '@/lib/supabase';
import { computeFinalPrice } from '@/lib/utils';
import type { Invoice, InvoiceWithRelations } from '@/types';
import { auditService } from './auditService';

export interface InvoiceInput {
  contract_id: string;
  issue_date?: string;
  due_date?: string;
  amount: number;
  tax?: number;
  notes?: string;
}

export const invoiceService = {
  async list(): Promise<InvoiceWithRelations[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, contract:contracts(*, client:clients(*), package:packages(*))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as InvoiceWithRelations[]) ?? [];
  },

  async getByContract(contractId: string): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Invoice[]) ?? [];
  },

  async get(id: string): Promise<InvoiceWithRelations | null> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, contract:contracts(*, client:clients(*), package:packages(*))')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as InvoiceWithRelations) ?? null;
  },

  async create(input: InvoiceInput): Promise<Invoice> {
    const tax = input.tax ?? 0;
    const total = computeFinalPrice(input.amount, 0, tax);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        contract_id: input.contract_id,
        invoice_number: invoiceNumber,
        issue_date: input.issue_date ?? new Date().toISOString().slice(0, 10),
        due_date: input.due_date ?? null,
        amount: input.amount,
        tax,
        total,
        status: 'issued',
        notes: input.notes ?? null,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    const invoice = data as Invoice;

    await auditService.log({ action: 'invoice_create', entityType: 'invoice', entityId: invoice.id, newValue: { invoice_number: invoiceNumber, total } });

    return invoice;
  },

  async updateStatus(id: string, status: string): Promise<Invoice> {
    const { data, error } = await supabase
      .from('invoices')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as Invoice;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
  },
};
