import { supabase } from '@/lib/supabase';
import { ARKON_COMPANY_ID } from '@/lib/supabase';
import { employeeService } from '@/services/employeeService';
import { expenseService } from '@/services/expenseService';
import type { Payroll } from '@/types';

export interface PayrollInput {
  employee_id: string;
  salary_amount: number;
  salary_month: string;
  due_date: string;
  payment_notes?: string;
}

export const payrollService = {
  async list(): Promise<Payroll[]> {
    const { data, error } = await supabase
      .from('payroll')
      .select('*, employee:employees!payroll_employee_id_fkey(*)')
      .eq('company_id', ARKON_COMPANY_ID)
      .order('salary_month', { ascending: false });
    if (error) throw error;
    return (data as Payroll[]) ?? [];
  },

  async getByMonth(month: string): Promise<Payroll[]> {
    const { data, error } = await supabase
      .from('payroll')
      .select('*, employee:employees!payroll_employee_id_fkey(*)')
      .eq('company_id', ARKON_COMPANY_ID)
      .eq('salary_month', month)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Payroll[]) ?? [];
  },

  async getPending(): Promise<Payroll[]> {
    const { data, error } = await supabase
      .from('payroll')
      .select('*, employee:employees!payroll_employee_id_fkey(*)')
      .eq('company_id', ARKON_COMPANY_ID)
      .eq('status', 'pending')
      .order('due_date', { ascending: true });
    if (error) throw error;
    return (data as Payroll[]) ?? [];
  },

  async generateForMonth(month: string): Promise<{ generated: number; skipped: number }> {
    const employees = await employeeService.list();
    const activeEmployees = employees.filter(
      (e) => e.employment_status === 'active' && e.monthly_salary && Number(e.monthly_salary) > 0,
    );

    const existing = await this.getByMonth(month);
    const existingIds = new Set(existing.map((p) => p.employee_id));

    const toInsert: PayrollInput[] = [];
    let skipped = 0;

    for (const emp of activeEmployees) {
      if (existingIds.has(emp.id)) {
        skipped++;
        continue;
      }
      const salary = Number(emp.monthly_salary);
      let amount = salary;
      if (emp.salary_type === 'weekly') amount = salary * 4;
      else if (emp.salary_type === 'daily') amount = salary * 30;

      const [year, mon] = month.split('-').map(Number);
      const dueDate = new Date(year, mon - 1, 5);

      toInsert.push({
        employee_id: emp.id,
        salary_amount: amount,
        salary_month: month,
        due_date: dueDate.toISOString().slice(0, 10),
      });
    }

    if (toInsert.length === 0) return { generated: 0, skipped };

    const { error } = await supabase.from('payroll').insert(
      toInsert.map((p) => ({ ...p, company_id: ARKON_COMPANY_ID })),
    );
    if (error) throw error;

    return { generated: toInsert.length, skipped };
  },

  async markAsPaid(id: string, paidBy: string, notes?: string): Promise<void> {
    const { data: payroll, error: fetchErr } = await supabase
      .from('payroll')
      .select('*, employee:employees!payroll_employee_id_fkey(*)')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!payroll) throw new Error('Payroll record not found');

    const emp = payroll.employee as { full_name: string; job_title: string | null } | null;

    const expense = await expenseService.create({
      title: `راتب ${emp?.full_name ?? 'موظف'} - ${payroll.salary_month}`,
      category: 'الرواتب',
      amount: Number(payroll.salary_amount),
      payment_method: 'تحويل بنكي',
      vendor: emp?.full_name ?? 'موظف',
      description: `راتب شهر ${payroll.salary_month}${notes ? ` - ${notes}` : ''}`,
      employee_id: payroll.employee_id,
    });

    const { error } = await supabase
      .from('payroll')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: paidBy,
        payment_notes: notes ?? null,
        expense_id: expense.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async updateOverdue(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from('payroll')
      .update({ status: 'overdue', updated_at: new Date().toISOString() })
      .eq('status', 'pending')
      .lt('due_date', today);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('payroll').delete().eq('id', id);
    if (error) throw error;
  },
};
