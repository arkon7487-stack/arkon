import { supabase } from '@/lib/supabase';
import type { QrCode } from '@/types';
import { auditService } from './auditService';

export const qrService = {
  async getByClient(clientId: string): Promise<QrCode | null> {
    const { data, error } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();
    if (error) throw error;
    return (data as QrCode) ?? null;
  },

  async generateForClient(clientId: string): Promise<QrCode> {
    const existing = await this.getByClient(clientId);
    if (existing) return existing;

    const { data: seqNum, error: seqError } = await supabase.rpc('get_next_qr_sequence');
    if (seqError) throw seqError;

    const seq = seqNum as number;
    const codeValue = `ARKON-C${String(seq).padStart(6, '0')}`;

    const { data, error } = await supabase
      .from('qr_codes')
      .insert({
        client_id: clientId,
        code_value: codeValue,
        sequence_number: seq,
        payload: { client_id: clientId, generated_at: new Date().toISOString() },
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    const qr = data as QrCode;

    await auditService.log({ action: 'qr_generate', entityType: 'client', entityId: clientId, newValue: { code_value: codeValue } });

    return qr;
  },

  async validate(codeValue: string): Promise<{ valid: boolean; clientId?: string }> {
    const { data, error } = await supabase
      .from('qr_codes')
      .select('client_id')
      .eq('code_value', codeValue)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { valid: false };
    return { valid: true, clientId: (data as any).client_id ?? undefined };
  },
};
