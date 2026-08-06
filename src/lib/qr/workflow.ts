/**
 * QR Workflow Layer — platform-agnostic business logic.
 *
 * This is the shared brain of the QR system. Given a decoded QR string,
 * it:
 *   1. Validates the QR code against the database (qrService).
 *   2. Finds the matching visit for the authenticated worker.
 *   3. Determines the correct action: start_visit or finish_visit.
 *   4. Updates the visit status in the database (visitService).
 *
 * This layer is used identically by:
 *   - The Web Platform (React + getUserMedia)
 *   - The future React Native Worker App
 *
 * It has no camera code, no browser APIs, no UI — pure business logic.
 */

import { qrService } from '@/services/qrService';
import { visitService } from '@/services/visitService';
import type { VisitWithRelations } from '@/types';
import type { QrWorkflowResult, ScanAction } from './types';

export class QrWorkflow {
  /**
   * Process a scanned QR code for a specific worker.
   *
   * @param code      The raw QR string decoded from the camera.
   * @param visits    The worker's assigned visits (preloaded to avoid extra queries).
   * @returns         Workflow result with success/failure, action taken, and message.
   */
  static async processScan(
    code: string,
    visits: VisitWithRelations[],
  ): Promise<QrWorkflowResult> {
    // 1. Validate the QR code against the database
    const validation = await qrService.validate(code);
    if (!validation.valid || !validation.clientId) {
      return {
        success: false,
        action: 'none',
        message: 'رمز QR غير صالح',
      };
    }

    // 2. Find the matching visit for this worker + client
    const visit = visits.find((v) => {
      const cid = v.contract?.client?.id ?? v.client?.id;
      return cid === validation.clientId;
    });

    if (!visit) {
      return {
        success: false,
        action: 'none',
        message: 'هذا الرمز لا ينتمي لأي زيارة معينة لك',
      };
    }

    // 3. Determine the action based on current visit status
    const action = this.determineAction(visit.status);

    if (action === 'none') {
      return {
        success: false,
        action: 'none',
        visitId: visit.id,
        message: 'لا يمكن إجراء عملية على هذه الزيارة',
      };
    }

    // 4. Execute the visit status transition
    try {
      if (action === 'start_visit') {
        await visitService.startVisit(visit.id);
        return {
          success: true,
          action: 'start_visit',
          visitId: visit.id,
          message: 'تم بدء الزيارة بنجاح',
        };
      } else {
        await visitService.finishVisit(visit.id);
        return {
          success: true,
          action: 'finish_visit',
          visitId: visit.id,
          message: 'تم إنهاء الزيارة بنجاح',
        };
      }
    } catch (err) {
      return {
        success: false,
        action: 'none',
        visitId: visit.id,
        message: (err as Error).message,
      };
    }
  }

  /**
   * Determine the correct action based on visit status.
   * Scheduled → start_visit
   * Started  → finish_visit
   * Anything else → none
   */
  static determineAction(status: string): ScanAction {
    if (status === 'scheduled') return 'start_visit';
    if (status === 'started') return 'finish_visit';
    return 'none';
  }

  /**
   * Process a scanned QR code when a specific visit is already selected.
   * Used in the visit detail modal where the worker scans to start/finish
   * a known visit (not a free-standing scan).
   */
  static async processScanForVisit(
    code: string,
    visit: VisitWithRelations,
  ): Promise<QrWorkflowResult> {
    const validation = await qrService.validate(code);
    if (!validation.valid || !validation.clientId) {
      return { success: false, action: 'none', message: 'رمز QR غير صالح' };
    }

    const clientId = visit.contract?.client?.id ?? visit.client?.id;
    if (validation.clientId !== clientId) {
      return { success: false, action: 'none', message: 'هذا الرمز لا ينتمي لزيارة هذا العميل' };
    }

    const action = this.determineAction(visit.status);
    if (action === 'none') {
      return { success: false, action: 'none', visitId: visit.id, message: 'لا يمكن إجراء عملية على هذه الزيارة' };
    }

    try {
      if (action === 'start_visit') {
        await visitService.startVisit(visit.id);
        return { success: true, action: 'start_visit', visitId: visit.id, message: 'تم بدء الزيارة بنجاح' };
      } else {
        await visitService.finishVisit(visit.id);
        return { success: true, action: 'finish_visit', visitId: visit.id, message: 'تم إنهاء الزيارة بنجاح' };
      }
    } catch (err) {
      return { success: false, action: 'none', visitId: visit.id, message: (err as Error).message };
    }
  }
}
