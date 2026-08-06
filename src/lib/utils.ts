export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(' ');
}

const ARABIC_DIGIT_MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

export function toEnglishDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => ARABIC_DIGIT_MAP[ch] ?? ch);
}

/**
 * Converts a raw input string (possibly containing Arabic digits) into a number.
 * Returns `null` for empty or non-numeric input so callers can distinguish
 * "user cleared the field" from "user typed 0".
 */
export function parseNumericInput(raw: string): number | null {
  const englished = toEnglishDigits(raw).replace(/[^0-9.]/g, '');
  if (englished === '' || englished === '.') return null;
  const num = Number(englished);
  return Number.isNaN(num) ? null : num;
}

export function formatCurrency(value: number | null | undefined, currency = 'ILS'): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ar-EG-u-nu-latn', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  return value;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeFinalPrice(price: number, discount: number, tax: number): number {
  const afterDiscount = Math.max(0, price - discount);
  return Math.round((afterDiscount + (afterDiscount * tax) / 100) * 100) / 100;
}

export function computeEndDate(startDate: string, durationWeeks: number): string {
  const end = new Date(startDate);
  end.setDate(end.getDate() + durationWeeks * 7);
  return end.toISOString().slice(0, 10);
}

export function computeEndDateFromMonths(startDate: string, durationMonths: number): string {
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + durationMonths);
  return end.toISOString().slice(0, 10);
}

export const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const DAY_NAMES_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export interface VisitDate {
  date: string;
  dayOfWeek: number;
}

export function computeVisitDates(
  startDate: string,
  endDate: string,
  visitsPerWeek: number,
  totalVisits?: number,
  visitDays?: number[],
): VisitDate[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates: VisitDate[] = [];

  const allowedDays = visitDays && visitDays.length > 0 ? visitDays : [1, 2, 3, 4, 5, 6, 0];

  const perWeek = Math.max(1, visitsPerWeek);
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const weeks = Math.ceil(totalDays / 7);
  const targetTotal = totalVisits && totalVisits > 0 ? totalVisits : Math.min(perWeek * weeks, totalDays);

  let count = 0;
  const cursor = new Date(start);
  let visitsThisWeek = 0;

  while (cursor <= end && count < targetTotal) {
    const dow = cursor.getDay();
    if (allowedDays.includes(dow) && visitsThisWeek < perWeek) {
      dates.push({ date: cursor.toISOString().slice(0, 10), dayOfWeek: dow });
      count += 1;
      visitsThisWeek += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() === 1) visitsThisWeek = 0;
  }

  return dates;
}

export interface ContractReminder {
  contract: import('@/types').ContractWithRelations;
  daysLeft: number;
  label: string;
  severity: 'info' | 'warning' | 'danger';
}

export function computeReminders(contracts: import('@/types').ContractWithRelations[]): ContractReminder[] {
  const reminders: ContractReminder[] = [];
  const thresholds: Record<number, string> = {
    30: '30 يوماً قبل الانتهاء',
    14: '14 يوماً قبل الانتهاء',
    7: '7 أيام قبل الانتهاء',
    1: 'يوم واحد قبل الانتهاء',
    0: 'يوم الانتهاء',
    [-1]: 'منتهي بدون تجديد',
  };
  for (const c of contracts) {
    const d = daysUntil(c.end_date);
    const matched = Object.keys(thresholds)
      .map(Number)
      .filter((t) => (t === -1 ? d < 0 : d === t));
    for (const t of matched) {
      reminders.push({
        contract: c,
        daysLeft: d,
        label: thresholds[t],
        severity: d < 0 ? 'danger' : d <= 7 ? 'warning' : 'info',
      });
    }
  }
  return reminders.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function filterByQuery<T>(items: T[], query: string, fields: Array<(item: T) => string>): T[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter((item) => fields.some((fn) => fn(item).toLowerCase().includes(q)));
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return timeToMinutes(start1) < timeToMinutes(end2) && timeToMinutes(end1) > timeToMinutes(start2);
}
