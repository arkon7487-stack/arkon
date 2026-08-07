import {
  LayoutDashboard, Package, FileText, Users, UserCog, CalendarClock,
  Bell, Settings, type LucideIcon,
  CalendarDays, BarChart3, ScrollText, ClipboardCheck, Receipt,
  Home, QrCode, UserCircle, CreditCard, Heart,
  Boxes, Target, Wallet, TrendingUp, CalendarPlus,
  Inbox,
} from 'lucide-react';

export interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: string;
}

export interface NavGroup {
  section: string;
  items: NavEntry[];
}

export const STAFF_NAV: NavGroup[] = [
  {
    section: 'العمليات',
    items: [
      { to: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, permission: 'dashboard' },
      { to: '/clients', label: 'العملاء', icon: Users, permission: 'clients' },
      { to: '/employees', label: 'الموظفون', icon: UserCog, permission: 'employees' },
      { to: '/contracts', label: 'العقود', icon: FileText, permission: 'contracts' },
      { to: '/packages', label: 'الباقات', icon: Package, permission: 'packages' },
      { to: '/visits', label: 'الزيارات', icon: ClipboardCheck, permission: 'visits' },
      { to: '/additional-visits', label: 'زيارات إضافية', icon: CalendarPlus, permission: 'visits' },
      { to: '/invoices', label: 'الفواتير', icon: Receipt, permission: 'invoices' },
      { to: '/schedule', label: 'الجدولة', icon: CalendarClock, permission: 'schedule' },
      { to: '/calendar', label: 'التقويم', icon: CalendarDays, permission: 'calendar' },
    ],
  },
  {
    section: 'الأعمال',
    items: [
      { to: '/sales', label: 'المبيعات', icon: TrendingUp, permission: 'sales' },
      { to: '/inventory', label: 'المخزون', icon: Boxes, permission: 'inventory' },
      { to: '/opportunities', label: 'الفرص', icon: Target, permission: 'opportunities' },
      { to: '/finance', label: 'الإدارة المالية', icon: Wallet, permission: 'finance' },
    ],
  },
  {
    section: 'التقارير',
    items: [
      { to: '/reports', label: 'التقارير', icon: BarChart3, permission: 'reports' },
      { to: '/audit', label: 'سجل النشاط', icon: ScrollText, permission: 'audit' },
    ],
  },
  {
    section: 'النظام',
    items: [
      { to: '/support', label: 'الدعم', icon: Inbox, permission: 'notifications' },
      { to: '/notifications', label: 'الإشعارات', icon: Bell, permission: 'notifications' },
      { to: '/settings', label: 'الإعدادات', icon: Settings, permission: 'settings' },
    ],
  },
];

export const WORKER_NAV: NavGroup[] = [
  {
    section: 'تطبيق الموظف',
    items: [
      { to: '/worker', label: 'الرئيسية', icon: Home, permission: 'worker_home' },
      { to: '/worker/visits', label: 'زيارات اليوم', icon: ClipboardCheck, permission: 'worker_visits' },
      { to: '/worker/qr', label: 'مسح QR', icon: QrCode, permission: 'worker_qr' },
      { to: '/worker/profile', label: 'الملف الشخصي', icon: UserCircle, permission: 'worker_profile' },
    ],
  },
];

export const CLIENT_NAV: NavGroup[] = [
  {
    section: 'تطبيق العميل',
    items: [
      { to: '/client', label: 'الرئيسية', icon: Home, permission: 'client_home' },
      { to: '/client/visits', label: 'الزيارات', icon: ClipboardCheck, permission: 'client_visits' },
      { to: '/client/invoices', label: 'الفواتير', icon: CreditCard, permission: 'client_invoices' },
      { to: '/client/support', label: 'الدعم', icon: Heart, permission: 'client_support' },
      { to: '/client/profile', label: 'الملف الشخصي', icon: UserCircle, permission: 'client_profile' },
    ],
  },
];

export function getDefaultRoute(permissions: string[], kind: 'staff' | 'client', roleKey?: string): string {
  if (kind === 'client') return '/client';
  if (permissions.includes('worker_home') || roleKey === 'field_employee') return '/worker';
  if (permissions.includes('dashboard')) return '/dashboard';
  for (const group of STAFF_NAV) {
    for (const item of group.items) {
      if (permissions.includes(item.permission)) return item.to;
    }
  }
  return '/login';
}
