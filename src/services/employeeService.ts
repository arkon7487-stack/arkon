import { supabase } from '@/lib/supabase';
import { ARKON_COMPANY_ID } from '@/lib/supabase';
import type { Employee } from '@/types';

export interface CreateEmployeeInput {
  full_name: string;
  phone_number: string;
  national_id?: string;
  age?: number;
  gender?: string;
  address?: string;
  service_area?: string;
  employment_date?: string;
  department?: string;
  position?: string;
  working_hours?: string;
  employment_status?: string;
  photo_url?: string;
  emergency_contact?: string;
  username?: string;
  auth_email?: string;
  password?: string;
  role_key?: string;
  monthly_salary?: number;
  salary_type?: string;
  salary_effective_date?: string;
  salary_notes?: string;
}

export interface EmployeeWithAuth extends Omit<Employee, 'auth_email'> {
  temp_password?: string;
  auth_email?: string | null;
}

export const employeeService = {
  async list(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Employee[]) ?? [];
  },

  async get(id: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as Employee) ?? null;
  },

  async create(input: CreateEmployeeInput): Promise<EmployeeWithAuth> {
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arkon-employee-create`;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('يجب تسجيل الدخول أولاً لإنشاء موظف جديد');

    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(input),
    });

    let json: Record<string, unknown> = {};
    try {
      json = await res.json();
    } catch {
      throw new Error(`فشل الاتصال بالخادم (HTTP ${res.status})`);
    }

    if (!res.ok) {
      const msg = (json.error ?? json.message ?? json.msg ?? `فشل إنشاء الموظف (HTTP ${res.status})`) as string;
      throw new Error(msg);
    }

    return json as unknown as EmployeeWithAuth;
  },

  async update(id: string, patch: Partial<CreateEmployeeInput>): Promise<Employee> {
    const { password, auth_email, role_key, ...employeeFields } = patch;
    void password;
    void auth_email;
    void role_key;
    // Keep job_title in sync with position (DB stores both; queries read job_title)
    const updatePayload: Record<string, unknown> = { ...employeeFields, updated_at: new Date().toISOString() };
    if (employeeFields.position !== undefined) {
      updatePayload.job_title = employeeFields.position;
    }
    const { data, error } = await supabase
      .from('employees')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as Employee;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
  },
};

void ARKON_COMPANY_ID;
