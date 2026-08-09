import { supabase } from '@/lib/supabase';
import { ARKON_COMPANY_ID } from '@/lib/supabase';
import type { Expense } from '@/types';

export interface ExpenseInput {
  title: string;
  category: string;
  amount: number;
  payment_method?: string;
  expense_date?: string;
  vendor?: string;
  description?: string;
  receipt_url?: string;
  entered_by?: string | null;
  employee_id?: string;
}

export const expenseService = {
  async list(): Promise<Expense[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*, employee:employees!expenses_employee_id_fkey(*)')
      .eq('company_id', ARKON_COMPANY_ID)
      .order('expense_date', { ascending: false });
    if (error) throw error;
    return (data as Expense[]) ?? [];
  },

  async create(input: ExpenseInput): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        company_id: ARKON_COMPANY_ID,
        ...input,
        expense_date: input.expense_date ?? new Date().toISOString().slice(0, 10),
      })
      .select('*, employee:employees!expenses_employee_id_fkey(*)')
      .maybeSingle();
    if (error) throw error;
    return data as Expense;
  },

  async update(id: string, patch: Partial<ExpenseInput>): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, employee:employees!expenses_employee_id_fkey(*)')
      .maybeSingle();
    if (error) throw error;
    return data as Expense;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  },

  async getSummary(): Promise<{ totalExpenses: number; byCategory: Record<string, number> }> {
    const expenses = await this.list();
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    }
    return { totalExpenses, byCategory };
  },
};
