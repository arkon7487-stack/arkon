import { supabase } from '@/lib/supabase';
import { qrService } from '@/services/qrService';
import type { VisitWithRelations } from '@/types';
import type { QrWorkflowResult, ScanAction } from './types';

function mapRpcError(message: string): string {
  if (message.includes('WRONG_QR')) return 'هذا الرمز لا يخص هذه الزيارة';
  if (message.includes('NOT_AUTHORIZED')) return 'هذه الزيارة غير مسندة إلى حسابك';
  if (message.includes('VISIT_NOT_SCHEDULED_TODAY')) return 'لا يمكن بدء هذه الزيارة اليوم\nيمكن مسح رمز QR فقط في تاريخ الزيارة المحدد.';
  if (message.includes('VISIT_DATE_PASSED')) return 'انتهى تاريخ هذه الزيارة ولا يمكن بدء الزيارة اليوم.';
  if (message.includes('INVALID_STATE')) return 'لا يمكن إجراء عملية على هذه الزيارة';
  return 'تعذر تحديث الزيارة، تحقق من الاتصال وحاول مرة أخرى';
}

async function processTransition(code: string, visitId: string): Promise<QrWorkflowResult> {
  try {
    const { data, error } = await supabase.rpc('process_visit_qr_scan', {
      p_visit_id: visitId,
      p_qr_code: code,
    });
    if (error) return { success: false, action: 'none', visitId, message: mapRpcError(error.message) };
    const result = data as { new_status?: string } | null;
    if (result?.new_status === 'started') return { success: true, action: 'start_visit', visitId, message: 'تم بدء الزيارة بنجاح' };
    if (result?.new_status === 'completed') return { success: true, action: 'finish_visit', visitId, message: 'تم إنهاء الزيارة بنجاح' };
    return { success: false, action: 'none', visitId, message: 'استجابة غير متوقعة من الخادم' };
  } catch {
    return { success: false, action: 'none', visitId, message: 'تعذر تحديث الزيارة، تحقق من الاتصال وحاول مرة أخرى' };
  }
}

export class QrWorkflow {
  static async processScan(code: string, visits: VisitWithRelations[]): Promise<QrWorkflowResult> {
    const validation = await qrService.validate(code);
    if (!validation.valid || !validation.clientId) return { success: false, action: 'none', message: 'رمز QR غير صالح' };
    const visit = visits.find((v) => (v.contract?.client?.id ?? v.client?.id) === validation.clientId);
    if (!visit) return { success: false, action: 'none', message: 'هذا الرمز لا ينتمي لأي زيارة معينة لك' };
    const action = this.determineAction(visit.status);
    if (action === 'none') return { success: false, action: 'none', visitId: visit.id, message: 'لا يمكن إجراء عملية على هذه الزيارة' };
    return processTransition(code, visit.id);
  }

  static determineAction(status: string): ScanAction {
    if (status === 'scheduled') return 'start_visit';
    if (status === 'started') return 'finish_visit';
    return 'none';
  }

  static async processScanForVisit(code: string, visit: VisitWithRelations, _employeeId?: string): Promise<QrWorkflowResult> {
    const validation = await qrService.validate(code);
    if (!validation.valid || !validation.clientId) return { success: false, action: 'none', message: 'رمز QR غير صالح' };
    const clientId = visit.contract?.client?.id ?? visit.client?.id;
    if (validation.clientId !== clientId) return { success: false, action: 'none', visitId: visit.id, message: 'هذا الرمز لا يخص هذه الزيارة' };
    const action = this.determineAction(visit.status);
    if (action === 'none') return { success: false, action: 'none', visitId: visit.id, message: 'لا يمكن إجراء عملية على هذه الزيارة' };
    return processTransition(code, visit.id);
  }
}
