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

  async getByClient(clientId: string): Promise<VisitWithRelations[]> {
    const { data, error } = await supabase
      .from('visits')
      .select('*, employee:employees(*), contract:contracts!inner(*, client:clients!inner(*), package:packages(*))')
      .eq('contract.client_id', clientId)
      .order('scheduled_date', { ascending: true });
    if (error) throw error;
    return (data as VisitWithRelations[]) ?? [];
  },

  async getByDateRange(start: string, end: string): Promise<VisitWithRelations[]> {
    const { data, error } = await supabase
      .from('visits')
      .select('*, employee:employees(*), contract:contracts(*, client:clients(*), package:packages(*))')
      .gte('scheduled_date', start)
      .lte('scheduled_date', end)
      .order('scheduled_date', { ascending: true });
    if (error) throw error;
    return (data as VisitWithRelations[]) ?? [];
  },

  async get(id: string): Promise<VisitWithRelations | null> {
    const { data, error } = await supabase
      .from('visits')
      .select('*, employee:employees(*), contract:contracts(*, client:clients(*), package:packages(*))')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as VisitWithRelations) ?? null;
  },

  async generateFromContract(input: GenerateVisitsInput): Promise<Visit[]> {
    const dates = computeVisitDates(
      input.startDate, input.endDate, input.visitsPerWeek, input.totalVisits, input.visitDays,
    );

    const visits = dates.map((d, i) => ({
      contract_id: input.contractId,
      employee_id: input.employeeId ?? null,
      scheduled_date: d.date,
      scheduled_start_time: input.defaultStartTime ?? null,
      scheduled_end_time: input.defaultEndTime ?? null,
      status: 'scheduled',
      visit_duration_minutes: input.visitDurationMinutes ?? null,
      visit_index: i + 1,
      assigned_at: input.employeeId ? new Date().toISOString() : null,
    }));

    const { data, error } = await supabase.from('visits').insert(visits).select('*');
    if (error) throw error;

    await timelineService.add('contract', input.contractId, 'visits_generated', `${visits.length} visits generated from contract.`, { count: visits.length });

    return (data as Visit[]) ?? [];
  },

  async generateCustomVisits(input: {
    contractId: string;
    clientId: string;
    visits: Array<{ date: string; startTime: string; endTime: string; employeeId?: string }>;
  }): Promise<Visit[]> {
    const visits = input.visits.map((v, i) => ({
      contract_id: input.contractId,
      employee_id: v.employeeId ?? null,
      scheduled_date: v.date,
      scheduled_start_time: v.startTime ?? null,
      scheduled_end_time: v.endTime ?? null,
      status: 'scheduled',
      visit_index: i + 1,
      assigned_at: v.employeeId ? new Date().toISOString() : null,
    }));

    const { data, error } = await supabase.from('visits').insert(visits).select('*');
    if (error) throw error;

    await timelineService.add('contract', input.contractId, 'visits_generated', `${visits.length} custom visits generated from quotation.`, { count: visits.length, contract_type: 'quotation' });

    return (data as Visit[]) ?? [];
  },

  async assignEmployee(visitId: string, employeeId: string, reason?: string): Promise<Visit> {
    const { data, error } = await supabase
      .from('visits')
      .update({ employee_id: employeeId, assigned_at: new Date().toISOString(), status: 'scheduled', updated_at: new Date().toISOString() })
      .eq('id', visitId)
      .select('*')
      .maybeSingle();
    if (error) throw error;

    await timelineService.add('visit', visitId, 'employee_assigned', `Employee assigned to visit.${reason ? ` Reason: ${reason}` : ''}`, { employee_id: employeeId, reason });

    return data as Visit;
  },

  async startVisit(visitId: string, lat?: number, lng?: number): Promise<Visit> {
    const current = await this.get(visitId);
    if (!current) throw new Error('Visit not found');
    if (current.status === 'completed' || current.status === 'archived') throw new Error(`Visit is already ${current.status}. No further scans allowed.`);
    if (current.status === 'started') throw new Error('Visit already started. Scan again to finish.');

    const { data, error } = await supabase
      .from('visits')
      .update({ status: 'started', started_at: new Date().toISOString(), start_gps_lat: lat ?? null, start_gps_lng: lng ?? null, updated_at: new Date().toISOString() })
      .eq('id', visitId)
      .select('*')
      .maybeSingle();
    if (error) throw error;

    await timelineService.add('visit', visitId, 'visit_started', 'Visit started via QR scan.', { lat, lng });

    return data as Visit;
  },

  async finishVisit(visitId: string, lat?: number, lng?: number): Promise<Visit> {
    const current = await this.get(visitId);
    if (!current) throw new Error('Visit not found');
    if (current.status !== 'started') throw new Error('Visit must be started before it can be finished.');

    const finishedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('visits')
      .update({ status: 'completed', finished_at: finishedAt, completed_at: finishedAt, end_gps_lat: lat ?? null, end_gps_lng: lng ?? null, updated_at: finishedAt })
      .eq('id', visitId)
      .select('*')
      .maybeSingle();
    if (error) throw error;

    await timelineService.add('visit', visitId, 'visit_completed', 'Visit completed and locked via QR scan.', { lat, lng });

    return data as Visit;
  },

  async archiveVisit(visitId: string): Promise<Visit> {
    const { data, error } = await supabase
      .from('visits')
      .update({ status: 'archived', archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', visitId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as Visit;
  },

  async cancelVisit(visitId: string): Promise<Visit> {
    const { data, error } = await supabase
      .from('visits')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', visitId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as Visit;
  },

  async saveNotes(visitId: string, notes: string): Promise<Visit> {
    const { data, error } = await supabase
      .from('visits')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', visitId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as Visit;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('visits').delete().eq('id', id);
    if (error) throw error;
  },

  async removeByContract(contractId: string): Promise<void> {
    const { error } = await supabase.from('visits').delete().eq('contract_id', contractId);
    if (error) throw error;
  },

  async getQrForClient(clientId: string): Promise<QrCode | null> {
    return qrService.getByClient(clientId);
  },

  async generateQrForClient(clientId: string): Promise<QrCode> {
    return qrService.generateForClient(clientId);
  },

  async validateQr(codeValue: string): Promise<{ valid: boolean; clientId?: string }> {
    return qrService.validate(codeValue);
  },
};
