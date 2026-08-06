import { supabase } from '@/lib/supabase';
import { ARKON_COMPANY_ID } from '@/lib/supabase';
import type { InventoryCategory, InventoryItem, InventoryMovement, InventoryAssignment } from '@/types';

export interface InventoryItemInput {
  category_id?: string | null;
  name: string;
  sku?: string;
  description?: string;
  unit?: string;
  quantity: number;
  min_quantity?: number;
  purchase_price: number;
  selling_price?: number;
  supplier?: string;
  storage_location?: string;
}

export const inventoryService = {
  async listCategories(): Promise<InventoryCategory[]> {
    const { data, error } = await supabase
      .from('inventory_categories')
      .select('*')
      .eq('company_id', ARKON_COMPANY_ID)
      .order('name');
    if (error) throw error;
    return (data as InventoryCategory[]) ?? [];
  },

  async createCategory(name: string, description?: string): Promise<InventoryCategory> {
    const { data, error } = await supabase
      .from('inventory_categories')
      .insert({ company_id: ARKON_COMPANY_ID, name, description: description ?? null })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as InventoryCategory;
  },

  async updateCategory(id: string, name: string, description?: string): Promise<InventoryCategory> {
    const { data, error } = await supabase
      .from('inventory_categories')
      .update({ name, description: description ?? null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as InventoryCategory;
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase.from('inventory_categories').delete().eq('id', id);
    if (error) throw error;
  },

  async listItems(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*, category:inventory_categories(*)')
      .eq('company_id', ARKON_COMPANY_ID)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as InventoryItem[]) ?? [];
  },

  async createItem(input: InventoryItemInput): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        company_id: ARKON_COMPANY_ID,
        ...input,
        status: input.quantity <= 0 ? 'out_of_stock' : (input.min_quantity && input.quantity <= input.min_quantity ? 'low_stock' : 'available'),
      })
      .select('*, category:inventory_categories(*)')
      .maybeSingle();
    if (error) throw error;
    return data as InventoryItem;
  },

  async updateItem(id: string, patch: Partial<InventoryItemInput>): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from('inventory_items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, category:inventory_categories(*)')
      .maybeSingle();
    if (error) throw error;
    return data as InventoryItem;
  },

  async deleteItem(id: string): Promise<void> {
    const { error } = await supabase.from('inventory_items').delete().eq('id', id);
    if (error) throw error;
  },

  async listMovements(limit = 50): Promise<InventoryMovement[]> {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*, item:inventory_items(*), employee:employees(*)')
      .eq('company_id', ARKON_COMPANY_ID)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as InventoryMovement[]) ?? [];
  },

  async addMovement(input: {
    item_id: string;
    movement_type: string;
    quantity: number;
    reason?: string;
    notes?: string;
    employee_id?: string;
  }): Promise<void> {
    const { error } = await supabase.from('inventory_movements').insert({
      company_id: ARKON_COMPANY_ID,
      ...input,
    });
    if (error) throw error;

    // Update item quantity
    const sign = ['purchase', 'manual_addition', 'returned_by_worker'].includes(input.movement_type) ? 1 : -1;
    const { data: item } = await supabase
      .from('inventory_items')
      .select('quantity, min_quantity')
      .eq('id', input.item_id)
      .maybeSingle();
    if (item) {
      const newQty = (item as any).quantity + sign * input.quantity;
      let status = 'available';
      if (newQty <= 0) status = 'out_of_stock';
      else if ((item as any).min_quantity && newQty <= (item as any).min_quantity) status = 'low_stock';
      await supabase.from('inventory_items')
        .update({ quantity: newQty, status, updated_at: new Date().toISOString() })
        .eq('id', input.item_id);
    }
  },

  async listAssignments(): Promise<InventoryAssignment[]> {
    const { data, error } = await supabase
      .from('inventory_assignments')
      .select('*, item:inventory_items(*), employee:employees(*)')
      .eq('company_id', ARKON_COMPANY_ID)
      .order('assigned_at', { ascending: false });
    if (error) throw error;
    return (data as InventoryAssignment[]) ?? [];
  },

  async assignItem(item_id: string, employee_id: string, quantity = 1, notes?: string): Promise<void> {
    const { error } = await supabase.from('inventory_assignments').insert({
      company_id: ARKON_COMPANY_ID,
      item_id,
      employee_id,
      quantity,
      status: 'assigned',
      notes: notes ?? null,
    });
    if (error) throw error;

    // Log movement
    await this.addMovement({ item_id, movement_type: 'assigned_to_worker', quantity, notes: `Assigned to employee ${employee_id}` });
  },

  async returnAssignment(assignmentId: string): Promise<void> {
    const { data: asgn } = await supabase
      .from('inventory_assignments')
      .select('*')
      .eq('id', assignmentId)
      .maybeSingle();
    if (!asgn) return;
    const a = asgn as any;
    const { error } = await supabase
      .from('inventory_assignments')
      .update({ status: 'returned', returned_at: new Date().toISOString() })
      .eq('id', assignmentId);
    if (error) throw error;
    await this.addMovement({ item_id: a.item_id, movement_type: 'returned_by_worker', quantity: a.quantity, notes: 'Returned by worker' });
  },
};
