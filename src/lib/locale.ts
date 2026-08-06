export const LOCALE = {
  country: 'Palestine',
  city: 'Nablus',
  phonePrefix: '+972',
  currency: 'ILS',
  currencySymbol: '₪',
  timezone: 'Asia/Hebron',
  language: 'ar',
  address: 'نابلس، فلسطين',
} as const;

export const DEFAULT_PHONE_PLACEHOLDER = '+972 59 000 0000';

export function formatPhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('0')) return `${LOCALE.phonePrefix} ${trimmed.slice(1)}`;
  return `${LOCALE.phonePrefix} ${trimmed}`;
}

export const ARABIC_DAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

export const ARABIC_DAYS_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  lead: 'عميل محتمل',
  contacted: 'تم التواصل',
  won: 'تم الفوز',
  active: 'نشط',
  archived: 'مؤرشف',
};

export const VISIT_STATUS_LABELS: Record<string, string> = {
  pending: 'في الانتظار',
  scheduled: 'مجدول',
  started: 'جاري التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  archived: 'مؤرشف',
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  active: 'نشط',
  expired: 'منتهي',
  archived: 'مؤرشف',
  cancelled: 'ملغي',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'غير مدفوع',
  partial: 'مدفوع جزئياً',
  paid: 'مدفوع',
  overdue: 'متأخر',
};

export const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  on_leave: 'في إجازة',
  suspended: 'موقوف',
  terminated: 'منتهي',
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'مدير النظام',
  administrator: 'مدير',
  operations_manager: 'مدير العمليات',
  sales: 'موظف مبيعات',
  customer_service: 'خدمة العملاء',
  accountant: 'محاسب',
  field_employee: 'عامل ميداني',
  supervisor: 'مشرف',
  dispatcher: 'منسق',
  hr: 'موارد بشرية',
  operations: 'عمليات',
  finance: 'مالية',
  admin: 'مدير',
};

export const JOB_TITLE_ROLE_MAP: Record<string, string> = {
  'مدير النظام': 'super_admin',
  'مدير عام': 'super_admin',
  'مدير': 'administrator',
  'مدير العمليات': 'operations_manager',
  'مسؤول العمليات': 'operations_manager',
  'موظف مبيعات': 'sales',
  'مدير المبيعات': 'sales',
  'مسؤول المبيعات': 'sales',
  'خدمة العملاء': 'customer_service',
  'موظف خدمة العملاء': 'customer_service',
  'محاسب': 'accountant',
  'مسؤول مالي': 'accountant',
  'عامل ميداني': 'field_employee',
  'مشرف ميداني': 'supervisor',
  'مشرف': 'supervisor',
  'منسق': 'dispatcher',
  'موارد بشرية': 'hr',
  'مسؤول الموارد البشرية': 'hr',
};

export const ROLE_KEY_TO_NAME: Record<string, string> = {
  super_admin: 'مدير النظام',
  administrator: 'مدير',
  operations_manager: 'مدير العمليات',
  sales: 'موظف مبيعات',
  customer_service: 'خدمة العملاء',
  accountant: 'محاسب',
  field_employee: 'عامل ميداني',
  supervisor: 'مشرف',
  dispatcher: 'منسق',
  hr: 'موارد بشرية',
  operations: 'عمليات',
  finance: 'مالية',
  admin: 'مدير',
};
