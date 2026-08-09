/**
 * Punctuality helper — compares scheduled start time against actual start time.
 *
 * Uses Asia/Hebron timezone (matching the verified QR same-day guard).
 * No grace period: 0 minutes = on_time.
 */

export type PunctualityStatus = 'early' | 'on_time' | 'late';

export interface PunctualityResult {
  differenceMinutes: number;
  status: PunctualityStatus;
}

const ARKON_TZ = 'Asia/Hebron';

export function getVisitPunctuality(
  scheduledDate: string | null | undefined,
  scheduledStartTime: string | null | undefined,
  actualStartedAt: string | null | undefined,
): PunctualityResult | null {
  if (!scheduledDate || !scheduledStartTime || !actualStartedAt) return null;

  const scheduledDateTime = new Date(`${scheduledDate}T${scheduledStartTime}:00`);
  if (Number.isNaN(scheduledDateTime.getTime())) return null;

  const actual = new Date(actualStartedAt);
  if (Number.isNaN(actual.getTime())) return null;

  const diffMs = actual.getTime() - scheduledDateTime.getTime();
  const diffMin = Math.round(diffMs / 60000);

  let status: PunctualityStatus;
  if (diffMin > 0) status = 'late';
  else if (diffMin < 0) status = 'early';
  else status = 'on_time';

  return { differenceMinutes: diffMin, status };
}

export function formatPunctualityArabic(result: PunctualityResult | null): string {
  if (!result) return '';
  const abs = Math.abs(result.differenceMinutes);
  if (result.status === 'late') return `متأخر ${abs} دقيقة`;
  if (result.status === 'early') return `قبل الموعد بـ ${abs} دقيقة`;
  return 'في الموعد';
}

export function formatDurationArabic(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt || !finishedAt) return '—';
  const start = new Date(startedAt);
  const end = new Date(finishedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';

  const totalMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (totalMinutes < 0) return '—';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} ساعة و${minutes} دقيقة`;
  if (hours > 0) return `${hours} ساعة`;
  return `${minutes} دقيقة`;
}

export function formatTimeInHebron(timestamp: string | null | undefined): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit', timeZone: ARKON_TZ });
}
