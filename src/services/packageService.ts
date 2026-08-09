import { supabase } from '@/lib/supabase';
import { ARKON_COMPANY_ID } from '@/lib/supabase';
import { computeFinalPrice } from '@/lib/utils';
import type { Package } from '@/types';

export interface PackageInput {
  name: string;
  code: string;
  category?: string;
  description?: string;
  contract_duration_weeks?: number;
  visits_per_week?: number;
  total_visits?: number;
  visit_duration_minutes?: number;
  default_visit_start_time?: string;
  default_visit_end_time?: string;
  included_services?: string;
  price?: number;
  discount?: number;
  tax?: number;
  final_price?: number;
  notes?: string;
  terms?: string;
  status?: string;
}

export const packageService = {
  async list(): Promise<Package[]> {
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Package[]) ?? [];
  },

  async get(id: string): Promise<Package | null> {
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as Package) ?? null;
  },

  async create(input: PackageInput): Promise<Package> {
    const { price = 0, discount = 0, tax = 0 } = input;
    const finalPrice = input.final_price ?? computeFinalPrice(price, discount, tax);
    const { data, error } = await supabase
      .from('packages')
      .insert({
        ...input,
        company_id: ARKON_COMPANY_ID,
        price,
        discount,
        tax,
        final_price: finalPrice,
        status: input.status ?? 'active',
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as Package;
  },

  async update(id: string, patch: Partial<PackageInput>): Promise<Package> {
    const finalPrice =
      patch.final_price ??
      (patch.price !== undefined || patch.discount !== undefined || patch.tax !== undefined
        ? computeFinalPrice(
            patch.price ?? 0,
            patch.discount ?? 0,
            patch.tax ?? 0,
          )
        : undefined);
    const { data, error } = await supabase
      .from('packages')
      .update({ ...patch, final_price: finalPrice, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as Package;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('packages').delete().eq('id', id);
    if (error) throw error;
  },
};
