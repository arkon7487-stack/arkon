import { supabase } from '@/lib/supabase';
import type { VisitRating } from '@/types';

export const ratingService = {
  async getByVisit(visitId: string): Promise<VisitRating | null> {
    const { data, error } = await supabase
      .from('visit_ratings')
      .select('*')
      .eq('visit_id', visitId)
      .maybeSingle();
    if (error) throw error;
    return (data as VisitRating) ?? null;
  },

  async listByClient(clientId: string): Promise<VisitRating[]> {
    const { data, error } = await supabase
      .from('visit_ratings')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as VisitRating[]) ?? [];
  },

  async create(input: {
    companyId: string;
    visitId: string;
    clientId: string;
    employeeId?: string | null;
    rating: number;
    comment?: string;
  }): Promise<VisitRating> {
    const { data, error } = await supabase
      .from('visit_ratings')
      .insert({
        company_id: input.companyId,
        visit_id: input.visitId,
        client_id: input.clientId,
        employee_id: input.employeeId ?? null,
        rating: input.rating,
        comment: input.comment?.trim() || null,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as VisitRating;
  },
};
