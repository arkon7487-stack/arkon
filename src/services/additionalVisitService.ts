import { supabase } from '@/lib/supabase';
import { ARKON_COMPANY_ID } from '@/lib/supabase';
import { schedulingEngine } from './schedulingEngine';
import { invoiceService } from './invoiceService';
import { notificationService } from './notificationService';
import { timelineService } from './timelineService';
import { auditService } from './auditService';
import type { VisitType, VisitWithRelations, Employee, Contract, Invoice } from '@/types';

export interface AdditionalVisitInput {
  clientId: string;
  contractId: string;
  employeeId: string;
  visitType: VisitType;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  chargeAmount: number;
  notes?: string;
  specialInstructions?: string;
}

export interface AvailableWorkerResult {
  employee: Employee;
  available: boolean;
  reasons: string[];
}

export const additionalVisitService = {
  async getAvailableWorkers(
    date: string,
    startTime: string,
    endTime: string,
    serviceArea?: string,
  ): Promise<AvailableWorkerResult[]> {
    const result = await schedulingEngine.suggestEmployees({
      date,
      startTime,
      endTime,
      serviceArea,
    });
    return result.suggestions.map((s) => ({
      employee: s.employee,
      available: s.available,
      reasons: s.reasons,
    }));
  },

  async getActiveContractsForClient(clientId: string): Promise<Contract[]> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*, package:packages(*), client:clients(*)')
      .eq('client_id', clientId)
      .in('status', ['active', 'draft'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Contract[]) ?? [];
  },

  async create(input: AdditionalVisitInput): Promise<{ visit: VisitWithRelations; invoice: Invoice }> {
    const [visitResult, invoiceResult] = await Promise.all([
      supabase
        .from('visits')
        .insert({
          contract_id: input.contractId,
          employee_id: input.employeeId,
          scheduled_date: input.scheduledDate,
          scheduled_start_time: input.startTime,
          scheduled_end_time: input.endTime,
          status: 'scheduled',
          visit_type: input.visitType,
          visit_charge_amount: input.chargeAmount,
          notes: input.notes ?? null,
          special_instructions: input.specialInstructions ?? null,
          assigned_at: new Date().toISOString(),
        })
        .select('*, employee:employees(*), contract:contracts(*, client:clients(*), package:packages(*))')
        .maybeSingle(),
      supabase
        .from('invoices')
        .insert({
          contract_id: input.contractId,
          invoice_number: `AV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
          issue_date: new Date().toISOString().slice(0, 10),
          amount: input.chargeAmount,
          tax: 0,
          total: input.chargeAmount,
          status: 'issued',
          charge_type: input.visitType === 'emergency' ? 'emergency_visit' : 'additional_visit',
          amount_paid: 0,
          remaining_balance: input.chargeAmount,
          payment_status: 'unpaid',
          visit_id: null,
          notes: input.visitType === 'emergency' ? 'زيارة طارئة' : 'زيارة إضافية',
        })
        .select('*')
        .maybeSingle(),
    ]);

    if (visitResult.error) throw visitResult.error;
    if (invoiceResult.error) throw invoiceResult.error;

    const visit = visitResult.data as VisitWithRelations;
    const invoice = invoiceResult.data as Invoice;

    // Link invoice to visit
    await supabase
      .from('invoices')
      .update({ visit_id: visit.id })
      .eq('id', invoice.id);

    // Timeline
    try {
      await timelineService.add('contract', input.contractId, 'additional_visit_created',
        input.visitType === 'emergency' ? 'تم إنشاء زيارة طارئة' : 'تم إنشاء زيارة إضافية');
    } catch { /* non-blocking */ }

    // Notifications
    try {
      const visitTypeLabel = input.visitType === 'emergency' ? 'زيارة طارئة' : 'زيارة إضافية';
      await notificationService.create({
        category: 'visit',
        title: `${visitTypeLabel} جديدة`,
        body: `${visitTypeLabel} في ${input.scheduledDate} من ${input.startTime} إلى ${input.endTime}`,
        link: `/visits`,
      });
    } catch { /* non-blocking */ }

    // Audit
    try {
      await auditService.log({
        action: 'additional_visit_create',
        entityType: 'visit',
        entityId: visit.id,
        newValue: { visit_type: input.visitType, charge: input.chargeAmount, employee_id: input.employeeId },
      });
    } catch { /* non-blocking */ }

    return { visit, invoice };
  },

  async getAdditionalVisits(): Promise<VisitWithRelations[]> {
    const { data, error } = await supabase
      .from('visits')
      .select('*, employee:employees(*), contract:contracts(*, client:clients(*), package:packages(*))')
      .neq('visit_type', 'normal')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as VisitWithRelations[]) ?? [];
  },

  async getVisitInvoices(visitId: string): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('visit_id', visitId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Invoice[]) ?? [];
  },

  async getCustomerVisitCharges(clientId: string): Promise<Array<{
    visit: VisitWithRelations;
    invoice: Invoice | null;
  }>> {
    const { data: visits, error } = await supabase
      .from('visits')
      .select('*, employee:employees(*), contract:contracts!inner(*, client:clients(*), package:packages(*))')
      .eq('contract.client_id', clientId)
      .neq('visit_type', 'normal')
      .order('scheduled_date', { ascending: false });
    if (error) throw error;

    const result: Array<{ visit: VisitWithRelations; invoice: Invoice | null }> = [];
    for (const v of (visits ?? []) as VisitWithRelations[]) {
      const invoices = await this.getVisitInvoices(v.id);
      result.push({ visit: v, invoice: invoices[0] ?? null });
    }
    return result;
  },

  async recordPayment(
    invoiceId: string,
    amount: number,
    method?: string,
    notes?: string,
  ): Promise<unknown> {
    const { data, error } = await supabase.rpc('record_visit_invoice_payment', {
      p_invoice_id: invoiceId,
      p_amount: amount,
      p_payment_method: method ?? null,
      p_notes: notes ?? null,
    });
    if (error) {
      const raw = `${error.message ?? ''}`;
      if (raw.includes('amount_exceeds_remaining')) throw new Error('قيمة الدفعة أكبر من المبلغ المتبقي');
      if (raw.includes('invalid_amount')) throw new Error('قيمة الدفعة يجب أن تكون أكبر من الصفر');
      if (raw.includes('not_authorized')) throw new Error('لا تملك صلاحية تسجيل الدفعات');
      throw new Error('تعذر تسجيل الدفعة');
    }
    return data;
  },
};
