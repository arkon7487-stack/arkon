import { supabase } from '@/lib/supabase';
import type { Employee, EmployeeLeave, EmployeeAvailability, Visit } from '@/types';
import { timesOverlap, timeToMinutes, DAY_NAMES_SHORT } from '@/lib/utils';

export interface ConflictReason {
  type: 'leave' | 'unavailable' | 'capacity' | 'overlap' | 'area';
  message: string;
  detail?: string;
}

export interface EmployeeAssignmentStatus {
  employee: Employee;
  available: boolean;
  reasons: string[];
  conflicts: ConflictReason[];
}

export interface SchedulingResult {
  suggestions: EmployeeAssignmentStatus[];
  hasAvailable: boolean;
}

export interface SchedulingContext {
  date: string;
  startTime?: string;
  endTime?: string;
  serviceArea?: string;
  clientId?: string;
}

export interface VisitSlot {
  date: string;
  startTime: string;
  endTime: string;
}

export interface ConflictDetail {
  dayName: string;
  date: string;
  timeRange: string;
  clientName?: string;
  existingTimeRange?: string;
  reason: string;
}

export interface WorkerAvailabilityInfo {
  employee: Employee;
  available: boolean;
  reasons: string[];
  conflicts: ConflictReason[];
  conflictDetails: ConflictDetail[];
  availabilityInfo: {
    workingHours: string;
    visitsToday: number;
    maxDailyVisits: number;
    remainingTime: string;
    serviceArea: string;
    nextVisit?: string;
    lastVisit?: string;
  };
}

export interface MultiDateSchedulingResult {
  suggestions: WorkerAvailabilityInfo[];
  hasAvailable: boolean;
  totalConflicts: number;
}

export const schedulingEngine = {
  async suggestEmployees(ctx: SchedulingContext): Promise<SchedulingResult> {
    const [employees, existingVisits, leaveRecords, availability] = await Promise.all([
      this.fetchEmployees(),
      this.fetchVisitsOnDate(ctx.date),
      this.fetchLeaveOnDate(ctx.date),
      this.fetchAllAvailability(),
    ]);

    const suggestions: EmployeeAssignmentStatus[] = [];

    for (const emp of employees) {
      if (emp.employment_status !== 'active' || emp.availability_status !== 'available') {
        suggestions.push({
          employee: emp,
          available: false,
          reasons: ['الموظف غير نشط أو غير متاح'],
          conflicts: [{ type: 'unavailable', message: 'الموظف غير نشط أو غير متاح' }],
        });
        continue;
      }

      const conflicts: ConflictReason[] = [];
      const reasons: string[] = [];

      const onLeave = leaveRecords.find(
        (l) => l.employee_id === emp.id && new Date(ctx.date) >= new Date(l.start_date) && new Date(ctx.date) <= new Date(l.end_date),
      );
      if (onLeave) {
        conflicts.push({ type: 'leave', message: `في إجازة: ${onLeave.leave_type}`, detail: `حتى ${onLeave.end_date}` });
      }

      const empAvail = availability.filter((a) => a.employee_id === emp.id);
      if (empAvail.length > 0 && ctx.startTime) {
        const dow = new Date(ctx.date).getDay();
        const dayAvail = empAvail.filter((a) => a.day_of_week === dow);
        if (dayAvail.length === 0) {
          conflicts.push({ type: 'unavailable', message: `غير متاح في يوم ${DAY_NAMES_SHORT[dow]}` });
        } else if (ctx.startTime && ctx.endTime) {
          const available = dayAvail.some((a) =>
            timeToMinutes(ctx.startTime!) >= timeToMinutes(a.start_time) &&
            timeToMinutes(ctx.endTime!) <= timeToMinutes(a.end_time),
          );
          if (!available) {
            conflicts.push({
              type: 'unavailable',
              message: `خارج ساعات العمل (${dayAvail.map((a) => `${a.start_time}-${a.end_time}`).join(', ')})`,
            });
          }
        }
      }

      const empVisits = existingVisits.filter((v) => v.employee_id === emp.id);

      if (empVisits.length >= emp.max_daily_visits) {
        conflicts.push({ type: 'capacity', message: `وصل للحد الأقصى اليومي (${emp.max_daily_visits} زيارة)` });
      }

      const weekStart = new Date(ctx.date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekVisits = empVisits.filter((v) => {
        const d = new Date(v.scheduled_date);
        return d >= weekStart && d <= weekEnd;
      });
      if (weekVisits.length >= emp.max_weekly_visits) {
        conflicts.push({ type: 'capacity', message: `وصل للحد الأقصى الأسبوعي (${emp.max_weekly_visits} زيارة)` });
      }

      if (ctx.startTime && ctx.endTime) {
        for (const v of empVisits) {
          if (!v.scheduled_start_time || !v.scheduled_end_time) continue;
          if (timesOverlap(ctx.startTime, ctx.endTime, v.scheduled_start_time, v.scheduled_end_time)) {
            const dow = new Date(v.scheduled_date).getDay();
            conflicts.push({
              type: 'overlap',
              message: `تعارض في الوقت — ${DAY_NAMES_SHORT[dow]} ${v.scheduled_start_time} → ${v.scheduled_end_time}`,
              detail: `زيارة موجودة: ${v.contract?.client?.full_name ?? 'عميل'}`,
            });
          }
        }
      }

      const areaMatch = !ctx.serviceArea || !emp.service_area || emp.service_area === ctx.serviceArea;
      if (ctx.serviceArea && emp.service_area && emp.service_area !== ctx.serviceArea) {
        conflicts.push({ type: 'area', message: `منطقة خدمة مختلفة (${emp.service_area})` });
      }

      const available = conflicts.length === 0;

      if (available) {
        reasons.push('لا يوجد تعارض في الوقت');
        if (ctx.serviceArea && emp.service_area === ctx.serviceArea) {
          reasons.push('يعمل في نفس منطقة الخدمة');
        }
        reasons.push(`العبء الحالي: ${empVisits.length} زيارة اليوم`);
      } else {
        reasons.push(...conflicts.map((c) => c.detail ? `${c.message} (${c.detail})` : c.message));
      }

      suggestions.push({ employee: emp, available, reasons, conflicts });
    }

    suggestions.sort((a, b) => Number(b.available) - Number(a.available));

    return {
      suggestions,
      hasAvailable: suggestions.some((s) => s.available),
    };
  },

  async suggestEmployeesForAllDates(slots: VisitSlot[], serviceArea?: string): Promise<MultiDateSchedulingResult> {
    if (slots.length === 0) {
      return { suggestions: [], hasAvailable: false, totalConflicts: 0 };
    }

    const [employees, allVisits, leave, availability] = await Promise.all([
      this.fetchEmployees(),
      this.fetchVisitsByDateRange(slots[0].date, slots[slots.length - 1].date),
      this.fetchLeaveInRange(slots[0].date, slots[slots.length - 1].date),
      this.fetchAllAvailability(),
    ]);

    const fieldWorkers = employees.filter((e) => e.employment_status === 'active');
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    let totalConflicts = 0;

    const suggestions: WorkerAvailabilityInfo[] = fieldWorkers.map((emp) => {
      const conflicts: ConflictReason[] = [];
      const conflictDetails: ConflictDetail[] = [];
      const reasons: string[] = [];

      const empVisits = allVisits.filter((v) => v.employee_id === emp.id);
      const empLeave = leave.filter((l) => l.employee_id === emp.id);
      const empAvailAll = availability.filter((a) => a.employee_id === emp.id);

      for (const slot of slots) {
        const slotDate = slot.date;
        const slotDay = new Date(slotDate + 'T00:00:00').getDay();
        const dayName = dayNames[slotDay];

        const onLeave = empLeave.some((l) => l.start_date <= slotDate && l.end_date >= slotDate);
        if (onLeave) {
          conflicts.push({ type: 'leave', message: `${dayName}: في إجازة` });
          conflictDetails.push({ dayName, date: slotDate, timeRange: `${slot.startTime}–${slot.endTime}`, reason: 'في إجازة' });
          reasons.push(`${dayName}: في إجازة`);
          continue;
        }

        if (empAvailAll.length > 0) {
          const dow = slotDay;
          const dayAvailRecords = empAvailAll.filter((a) => a.day_of_week === dow);
          if (dayAvailRecords.length > 0) {
            const withinHours = dayAvailRecords.some((a) =>
              timeToMinutes(slot.startTime) >= timeToMinutes(a.start_time) &&
              timeToMinutes(slot.endTime) <= timeToMinutes(a.end_time),
            );
            if (!withinHours) {
              conflicts.push({ type: 'unavailable', message: `${dayName}: خارج ساعات العمل` });
              conflictDetails.push({ dayName, date: slotDate, timeRange: `${slot.startTime}–${slot.endTime}`, reason: 'خارج ساعات العمل' });
              reasons.push(`${dayName}: خارج ساعات العمل`);
              continue;
            }
          }
        }

        const dayVisits = empVisits.filter((v) => v.scheduled_date === slotDate);
        const overlapping = dayVisits.filter((v) =>
          v.scheduled_start_time && v.scheduled_end_time &&
          timesOverlap(slot.startTime, slot.endTime, v.scheduled_start_time, v.scheduled_end_time),
        );

        if (overlapping.length > 0) {
          const ov = overlapping[0];
          const clientName = (ov as any)?.contract?.client?.full_name;
          conflicts.push({ type: 'overlap', message: `${dayName}: تعارض في الوقت` });
          conflictDetails.push({
            dayName,
            date: slotDate,
            timeRange: `${slot.startTime}–${slot.endTime}`,
            clientName,
            existingTimeRange: `${ov.scheduled_start_time}–${ov.scheduled_end_time}`,
            reason: 'تعارض في الوقت',
          });
          reasons.push(`${dayName} ${slot.startTime}–${slot.endTime}: تعارض${clientName ? ` مع ${clientName}` : ''}`);
        }

        const activeDayVisits = dayVisits.filter((v) => ['pending', 'scheduled', 'started'].includes(v.status));
        if (emp.max_daily_visits > 0 && activeDayVisits.length >= emp.max_daily_visits && !overlapping.length) {
          conflicts.push({ type: 'capacity', message: `${dayName}: تجاوز الحد الأقصى للزيارات اليومية` });
          conflictDetails.push({ dayName, date: slotDate, timeRange: `${slot.startTime}–${slot.endTime}`, reason: 'تجاوز الحد الأقصى للزيارات اليومية' });
          reasons.push(`${dayName}: تجاوز الحد الأقصى للزيارات اليومية`);
        }
      }

      if (serviceArea && emp.service_area && emp.service_area !== serviceArea) {
        reasons.push(`منطقة مختلفة: ${emp.service_area}`);
      }

      const available = conflicts.length === 0;
      if (!available) totalConflicts += conflictDetails.length;

      const firstSlotDate = slots[0].date;
      const firstDayVisits = empVisits.filter((v) => v.scheduled_date === firstSlotDate && ['pending', 'scheduled', 'started'].includes(v.status));
      const sortedDayVisits = firstDayVisits
        .filter((v) => v.scheduled_start_time)
        .sort((a, b) => (a.scheduled_start_time!).localeCompare(b.scheduled_start_time!));

      return {
        employee: emp,
        available,
        reasons: available ? ['متاح خلال جميع مواعيد الزيارات المحددة'] : reasons,
        conflicts,
        conflictDetails,
        availabilityInfo: {
          workingHours: emp.working_hours || 'غير محدد',
          visitsToday: firstDayVisits.length,
          maxDailyVisits: emp.max_daily_visits,
          remainingTime: emp.max_daily_visits > 0
            ? `${Math.max(0, emp.max_daily_visits - firstDayVisits.length)} زيارة متبقية`
            : 'غير محدود',
          serviceArea: emp.service_area || 'غير محدد',
          nextVisit: sortedDayVisits[0] ? `${sortedDayVisits[0].scheduled_start_time}–${sortedDayVisits[0].scheduled_end_time}` : undefined,
          lastVisit: sortedDayVisits[sortedDayVisits.length - 1]
            ? `${sortedDayVisits[sortedDayVisits.length - 1].scheduled_start_time}–${sortedDayVisits[sortedDayVisits.length - 1].scheduled_end_time}`
            : undefined,
        },
      };
    });

    suggestions.sort((a, b) => Number(b.available) - Number(a.available));

    return {
      suggestions,
      hasAvailable: suggestions.some((s) => s.available),
      totalConflicts,
    };
  },

  async fetchEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) throw error;
    return (data as Employee[]) ?? [];
  },

  async fetchVisitsOnDate(date: string): Promise<Visit[]> {
    const { data, error } = await supabase
      .from('visits')
      .select('*, contract:contracts(client:clients(full_name))')
      .eq('scheduled_date', date)
      .in('status', ['pending', 'scheduled', 'started']);
    if (error) throw error;
    return (data as Visit[]) ?? [];
  },

  async fetchVisitsByDateRange(startDate: string, endDate: string): Promise<Visit[]> {
    const { data, error } = await supabase
      .from('visits')
      .select('*, contract:contracts(client:clients(full_name))')
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .in('status', ['pending', 'scheduled', 'started'])
      .order('scheduled_date', { ascending: true });
    if (error) throw error;
    return (data as Visit[]) ?? [];
  },

  async fetchLeaveOnDate(date: string): Promise<EmployeeLeave[]> {
    const { data, error } = await supabase
      .from('employee_leave')
      .select('*')
      .lte('start_date', date)
      .gte('end_date', date);
    if (error) throw error;
    return (data as EmployeeLeave[]) ?? [];
  },

  async fetchLeaveInRange(startDate: string, endDate: string): Promise<EmployeeLeave[]> {
    const { data, error } = await supabase
      .from('employee_leave')
      .select('*')
      .lte('start_date', endDate)
      .gte('end_date', startDate);
    if (error) throw error;
    return (data as EmployeeLeave[]) ?? [];
  },

  async fetchAllAvailability(): Promise<EmployeeAvailability[]> {
    const { data, error } = await supabase
      .from('employee_availability')
      .select('*');
    if (error) throw error;
    return (data as EmployeeAvailability[]) ?? [];
  },
};
