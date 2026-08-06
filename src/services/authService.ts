import { supabase } from '@/lib/supabase';
import type { Profile, Role, Employee } from '@/types';

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, role:roles(*), employee:employees(*)')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export interface StaffLoginResult {
  profile: Profile | null;
  role: Role | null;
  employee: Employee | null;
}

export const authService = {
  async signInWithPassword(email: string, password: string): Promise<StaffLoginResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error('No session returned');
    const profile = await fetchProfile(userId);
    return {
      profile,
      role: profile?.role ?? null,
      employee: profile?.employee ?? null,
    };
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  async getCurrentProfile(): Promise<Profile | null> {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return null;
    return fetchProfile(userId);
  },

  async ensureProfile(userId: string, roleId: string, employeeId?: string): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        { user_id: userId, role_id: roleId, employee_id: employeeId ?? null },
        { onConflict: 'user_id' },
      )
      .select('*, role:roles(*), employee:employees(*)')
      .maybeSingle();
    if (error) throw error;
    return data as Profile;
  },
};
