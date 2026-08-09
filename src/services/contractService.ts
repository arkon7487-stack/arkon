import { supabase } from '@/lib/supabase';
import { ARKON_COMPANY_ID } from '@/lib/supabase';
import { computeFinalPrice } from '@/lib/utils';
import { visitService } from './visitService';
import { notificationService } from './notificationService';
import { auditService } from './auditService';
import { timelineService } from './timelineService';
import type { Contract, ContractStatus, ContractTimelineEntry, ContractWithRelations } from '@/types';

export interface ContractInput {
  client_id: string;
  package_id: string;
  employee_id?: string;
  start_date: string;
  end_date: string;
  contract_duration_weeks?: number;
  status?: ContractStatus;
  price?: number;
  discount?: number;
  tax?: number;
  notes?: string;
}

export const contractService = {
  async list(): Promise<ContractWithRelations[]> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*, client:clients(*), package:packages(*), employee:employees(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ContractWithRelations[]) ?? [];
  },

  async get(id: string): Promise<ContractWithRelations | null> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*, client:clients(*), package:packages(*), employee:employees(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as ContractWithRelations) ?? null;
  },

  async createFromPackage(input: ContractInput): Promise<Contract> {
    const { data: pkg, error: pkgError } = await supabase
      .from('packages')
      .select('*')
      .eq('id', input.package_id)
      .maybeSingle();
    if (pkgError) throw pkgError;
    if (!pkg) throw new Error('Package not found');

    const price = input.price ?? Number(pkg.price ?? 0);
    const discount = input.discount ?? Number(pkg.discount ?? 0);
    const tax = input.tax ?? Number(pkg.tax ?? 0);
    const finalAmount = computeFinalPrice(price, discount, tax);
    const durationWeeks = input.contract_duration_weeks ?? pkg.contract_duration_weeks ?? undefined;

    const { data, error } = await supabase
      .from('contracts')
      .insert({
        company_id: ARKON_COMPANY_ID,
        client_id: input.client_id,
        package_id: input.package_id,
        employee_id: input.employee_id ?? null,
        start_date: input.start_date,
        end_date: input.end_date,
        contract_duration_weeks: durationWeeks ?? null,
        status: input.status ?? 'draft',
        price, discount, tax,
        final_amount: finalAmount,
        remaining_balance: finalAmount,
        payment_status: 'unpaid',
        notes: input.notes ?? null,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    const contract = data as Contract;

    await this.addTimeline(contract.id, 'contract_created', 'Contract created from package.', { package_id: pkg.id, package_code: pkg.code });
    await timelineService.add('contract', contract.id, 'contract_created', 'Contract created.');

    return contract;
  },

  async activate(id: string, visitSchedule?: { visitDays?: number[]; startTime?: string; endTime?: string }): Promise<Contract> {
    const current = await this.get(id);
    if (!current) throw new Error('Contract not found');
    if (current.status === 'active') throw new Error('Contract is already active');
    if (current.status === 'archived' || current.status === 'cancelled')
      throw new Error(`Cannot activate a ${current.status} contract`);

    const { data, error } = await supabase
      .from('contracts')
      .update({ status: 'active', activated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    const contract = data as Contract;

    await this.addTimeline(id, 'contract_activated', 'Contract activated. Editing is now locked. Visits generated.', {});

    const pkg = current.package;
    if (pkg) {
      try {
        await visitService.generateFromContract({
          contractId: id,
          clientId: current.client_id,
          packageId: current.package_id,
          employeeId: current.employee_id ?? undefined,
          startDate: current.start_date,
          endDate: current.end_date,
          visitsPerWeek: pkg.visits_per_week ? Number(pkg.visits_per_week) : 1,
          totalVisits: pkg.total_visits ?? undefined,
          visitDurationMinutes: pkg.visit_duration_minutes ?? undefined,
          defaultStartTime: visitSchedule?.startTime ?? pkg.default_visit_start_time ?? undefined,
          defaultEndTime: visitSchedule?.endTime ?? pkg.default_visit_end_time ?? undefined,
          visitDays: visitSchedule?.visitDays,
        });
      } catch { /* visit generation failure should not block activation */ }
    }

    if (current.client_id) {
      try { await visitService.generateQrForClient(current.client_id); } catch { /* QR failure non-blocking */ }
    }

    await notificationService.create({
      category: 'contract',
      title: 'Contract activated',
      body: `${contract.contract_number} is now active. Visits have been generated.`,
      link: `/contracts/${id}`,
    });

    await auditService.log({ action: 'contract_activate', entityType: 'contract', entityId: id, newValue: { status: 'active' } });

    return contract;
  },

  async createFromQuotation(input: {
    client_id: string;
    employee_id?: string;
    start_date: string;
    end_date: string;
    custom_price: number;
    notes?: string;
  }): Promise<Contract> {
    const contractNumber = `QUO-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { data, error } = await supabase
      .from('contracts')
      .insert({
        company_id: ARKON_COMPANY_ID,
        contract_number: contractNumber,
        client_id: input.client_id,
        package_id: null,
        employee_id: input.employee_id ?? null,
        start_date: input.start_date,
        end_date: input.end_date,
        contract_type: 'quotation',
        status: 'draft',
        price: input.custom_price,
        discount: 0,
        tax: 0,
        final_amount: input.custom_price,
        remaining_balance: input.custom_price,
        payment_status: 'unpaid',
        notes: input.notes ?? null,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    const contract = data as Contract;

    await this.addTimeline(contract.id, 'contract_created', 'Custom quotation contract created.', { contract_type: 'quotation' });
    await timelineService.add('contract', contract.id, 'contract_created', 'Custom quotation contract created.');

    return contract;
  },

  async activateQuotation(id: string, customVisits: Array<{
    date: string;
    startTime: string;
    endTime: string;
    employeeId?: string;
  }>): Promise<Contract> {
    const current = await this.get(id);
    if (!current) throw new Error('Contract not found');
    if (current.status === 'active') throw new Error('Contract is already active');

    const { data, error } = await supabase
      .from('contracts')
      .update({ status: 'active', activated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    const contract = data as Contract;

    await this.addTimeline(id, 'contract_activated', 'Quotation contract activated. Custom visits generated.', {});

    try {
      await visitService.generateCustomVisits({
        contractId: id,
        clientId: current.client_id,
        visits: customVisits,
      });
    } catch (err) {
      throw new Error(`فشل توليد الزيارات: ${(err as Error).message}`);
    }

    if (current.client_id) {
      try { await visitService.generateQrForClient(current.client_id); } catch { /* */ }
    }

    await notificationService.create({
      category: 'contract',
      title: 'Quotation contract activated',
      body: `${contract.contract_number} is now active. ${customVisits.length} custom visits generated.`,
      link: `/contracts/${id}`,
    });

    await auditService.log({ action: 'contract_activate', entityType: 'contract', entityId: id, newValue: { status: 'active', contract_type: 'quotation' } });

    return contract;
  },

  async update(id: string, patch: Partial<ContractInput>): Promise<Contract> {
    const current = await this.get(id);
    if (!current) throw new Error('Contract not found');
    if (current.status === 'active' || current.status === 'archived') {
      const forbidden = ['package_id', 'client_id', 'price', 'discount', 'tax', 'final_amount', 'start_date', 'end_date'];
      const blocked = Object.keys(patch).filter((k) => forbidden.includes(k));
      if (blocked.length > 0) throw new Error(`Contract is ${current.status} and cannot be edited. Changing package or terms is not allowed.`);
    }
    const { data, error } = await supabase
      .from('contracts')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as Contract;
  },

  async archive(id: string): Promise<Contract> {
    const { data, error } = await supabase
      .from('contracts')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    await this.addTimeline(id, 'contract_archived', 'Contract archived.', {});
    return data as Contract;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('contracts').delete().eq('id', id);
    if (error) throw error;
  },

  async getTimeline(id: string): Promise<ContractTimelineEntry[]> {
    const { data, error } = await supabase
      .from('contract_timeline')
      .select('*')
      .eq('contract_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ContractTimelineEntry[]) ?? [];
  },

  async addTimeline(contractId: string, eventType: string, message: string, meta: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from('contract_timeline').insert({ contract_id: contractId, event_type: eventType, message, meta });
    if (error) throw error;
  },

  async getReminders(): Promise<ContractWithRelations[]> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*, client:clients(*), package:packages(*), employee:employees(*)')
      .in('status', ['active', 'draft'])
      .order('end_date', { ascending: true });
    if (error) throw error;
    return (data as ContractWithRelations[]) ?? [];
  },
};
