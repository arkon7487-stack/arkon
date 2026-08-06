import { supabase } from '@/lib/supabase';

export interface Permission {
  key: string;
  label: string;
  category: string;
}

export const permissionService = {
  async getForRole(roleId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permissions!inner(key)')
      .eq('role_id', roleId);
    if (error) throw error;
    return (((data as unknown as Array<{ permissions: { key: string } }>) ?? [])
      .map((d) => d.permissions?.key)
      .filter(Boolean)) as string[];
  },

  async getAll(): Promise<Permission[]> {
    const { data, error } = await supabase
      .from('permissions')
      .select('key, label, category')
      .order('category', { ascending: true });
    if (error) throw error;
    return (data as Permission[]) ?? [];
  },
};
