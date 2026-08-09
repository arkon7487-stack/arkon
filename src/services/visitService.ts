import { supabase } from '@/lib/supabase';
import { computeVisitDates } from '@/lib/utils';
import { timelineService } from './timelineService';
import { qrService } from './qrService';
import type { Visit, QrCode, Employee } from '@/types';
import type { VisitWithRelations } from '@/types';

export interface GenerateVisitsInput {
  contractId: string;
  clientId: string;
  packageId: string;
  employeeId?: string;
  startDate: string;
  endDate: string;
  visitsPerWeek: number;
  totalVisits?: number;
  visitDurationMinutes?: number;
  defaultStartTime?: string;
  defaultEndTime?: string;
  visitDays?: number[];
}

export interface SchedulingConflict {
  type: 'overlap' | 'leave' | 'unavailable' | 'capacity' | 'area';
  message: string;
}

export interface EmployeeSuggestion {
  employee: Employee;
  score: number;
  conflicts: SchedulingConflict[];
  reason: string;
}

export const visitService = {
  async list(): Promise<VisitWithRelations[]> {
    const { data, error } = await supabase
      .from('visits')
      .select('*, employee:employees(*), contract:contracts(*, client:clients(*), package:packages(*))')
      .order('scheduled_date', { ascending: false });
    if (error) throw error;
    return (data as VisitWithRelations[]) ?? [];
  },

  async getByContract(contractId: string): Promise<VisitWithRelations[]> {
    const { data, error } = await supabase
      .from('visits')
      .select('*, employee:employees(*), contract:contracts(*, client:clients(*), package:packages(*))')
      .eq('contract_id', contractId)
      .order('scheduled_date', { ascending: true });
    if (error) throw error;
    return (data as VisitWithRelations[]) ?? [];
  },

  async getByEmployee(employeeId: string): Promise<VisitWithRelations[]> {
    const { data, error } = await supabase
      .from('visits')
      .select('*, employee:employees(*), contract:contracts(*, client:clients(*), package:packages(*))')
      .eq('employee_id', employeeId)
      .order('scheduled_date', { ascending: true });
    if (error) throw error;
    return (data as VisitWithRelations[]) ?? [];
  },

  async getByClient(): Promise<VisitWithRelations[]> {
    const { data, error } = await supabase
      .from('visits')
      .select('*, employee:employees(*), contract:contracts!inner(*, package:packages(*))')
      .order('scheduled_date', { ascending: true });
    if (error) throw error;
    return (data as VisitWithRelations[]) ?? [];
  },

  async generateVisits(input: GenerateVisitsInput): Promise<Visit[]> {
    const dates = computeVisitDates(input.startDate, input.endDate, input.visitsPerWeek, input.totalVisits, input.visitDays);
    const visits: Omit<Visit, 'id' | 'created_at' | 'updated_at'>[] = dates.map((d, i) => ({
      company_id: ARKON_COMPANY_ID,
      contract_id: input.contractId,
      employee_id: input.employeeId ?? null,
      scheduled_date: d.date,
      scheduled_start_time: input.defaultStartTime ?? '09:00',
      scheduled_end_time: input.defaultEndTime ?? '17:00',
      status: 'scheduled',
      visit_index: i + 1,
      visit_type: 'package',
      visit_duration_minutes: input.visitDurationMinutes ?? null,
    }));
    const { data, error } = await supabase.from('visits').insert(visits).select('*');
    if (error) throw error;
    return (data as Visit[]) ?? [];
  },

  async updateStatus(visitId: string, status: string): Promise<void> {
    const { error } = await supabase.from('visits').update({ status }).eq('id', visitId);
    if (error) throw error;
  },

  async assignEmployee(visitId: string, employeeId: string): Promise<void> {
    const { error } = await supabase.from('visits').update({ employee_id: employeeId }).eq('id', visitId);
    if (error) throw error;
  },

  async reschedule(visitId: string, newDate: string, newStartTime?: string, newEndTime?: string): Promise<void> {
    const update: Record<string, string> = { scheduled_date: newDate };
    if (newStartTime) update.scheduled_start_time = newStartTime;
    if (newEndTime) update.scheduled_end_time = newEndTime;
    const { error } = await supabase.from('visits').update(update).eq('id', visitId);
    if (error) throw error;
  },
};

const ARKON_COMPANY_ID = '11111111-1111-1111-1111-111111111111';
