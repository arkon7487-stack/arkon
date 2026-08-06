import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, FileText, Package as PackageIcon, CalendarClock, TrendingUp, AlertTriangle,
  ArrowUpRight, Activity, ClipboardCheck, CheckCircle2, Clock, DollarSign, Bell,
  BarChart3,
} from 'lucide-react';
import { clientService } from '@/services/clientService';
import { contractService } from '@/services/contractService';
import { computeReminders, daysUntil, type ContractReminder } from '@/lib/utils';
import { packageService } from '@/services/packageService';
import { employeeService } from '@/services/employeeService';
import { visitService } from '@/services/visitService';
import type { VisitWithRelations } from '@/types';
import type { Client, Package, Employee, Contract } from '@/types';
import { PageLoader } from '@/components/Feedback';
import { StatusBadge } from '@/components/Badge';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { VISIT_STATUS_LABELS, CONTRACT_STATUS_LABELS } from '@/lib/locale';
import { useVisitRealtime } from '@/lib/qr/useQrScanner';
import { useNotifications } from '@/lib/notifications/useNotifications';
import { requestBrowserNotificationPermission } from '@/lib/notifications/manager';

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [reminders, setReminders] = useState<ContractReminder[]>([]);

  const load = useCallback(async () => {
    try {
      const [c, p, e, ct, v] = await Promise.all([
        clientService.list(),
        packageService.list(),
        employeeService.list(),
        contractService.list(),
        visitService.list(),
      ]);
      setClients(c);
      setPackages(p);
      setEmployees(e);
      setContracts(ct);
      setVisits(v);
      setReminders(computeReminders(ct));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useVisitRealtime(() => { load(); });

  // Realtime notifications: admin receives visit status change notifications
  useNotifications({
    onNewNotification: () => { load(); },
  });

  // Request browser notification permission on mount
  useEffect(() => {
    requestBrowserNotificationPermission().catch(() => {});
  }, []);

  if (loading) return <PageLoader label="جارٍ تحميل لوحة التحكم…" />;

  const activeContracts = contracts.filter((c) => c.status === 'active');
  const revenue = activeContracts.reduce((sum, c) => sum + Number(c.final_amount ?? 0), 0);
  const outstanding = contracts.reduce((sum, c) => sum + Number(c.remaining_balance ?? 0), 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayVisits = visits.filter((v) => v.scheduled_date === todayStr);
  const upcomingVisits = visits.filter((v) => v.scheduled_date > todayStr && (v.status === 'pending' || v.status === 'scheduled'));
  const completedVisits = visits.filter((v) => v.status === 'completed');
  const pendingVisits = visits.filter((v) => v.status === 'pending');
  const activeEmployees = employees.filter((e) => e.employment_status === 'active');

  const stats = [
    { label: 'إجمالي العملاء', value: clients.length, icon: Users, tone: 'brand', to: '/clients' },
    { label: 'الموظفون النشطون', value: activeEmployees.length, icon: CalendarClock, tone: 'accent', to: '/employees' },
    { label: 'زيارات اليوم', value: todayVisits.length, icon: CalendarClock, tone: 'brand', to: '/visits' },
    { label: 'الزيارات القادمة', value: upcomingVisits.length, icon: Clock, tone: 'accent', to: '/calendar' },
    { label: 'الزيارات المكتملة', value: completedVisits.length, icon: CheckCircle2, tone: 'success', to: '/visits' },
    { label: 'الزيارات في الانتظار', value: pendingVisits.length, icon: ClipboardCheck, tone: 'warning', to: '/visits' },
    { label: 'العقود النشطة', value: activeContracts.length, icon: FileText, tone: 'accent', to: '/contracts' },
    { label: 'باقات الخدمة', value: packages.length, icon: PackageIcon, tone: 'brand', to: '/packages' },
    { label: 'العقود المنتهية قريباً', value: reminders.length, icon: AlertTriangle, tone: 'warning', to: '/contracts' },
    { label: 'المبالغ المستحقة', value: formatCurrency(outstanding), icon: DollarSign, tone: 'warning', to: '/reports' },
    { label: 'الإشعارات', value: reminders.length, icon: Bell, tone: 'accent', to: '/notifications' },
    { label: 'التقارير', value: '', icon: BarChart3, tone: 'brand', to: '/reports' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-700 text-slate-900">لوحة التحكم</h1>
        <p className="mt-1 text-sm text-slate-9000">مركز التحكم التشغيلي المركزي. انقر على أي مؤشر أداء للتنقل.</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="card card-hover group p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-500 uppercase tracking-wide text-slate-9000">{s.label}</p>
                <p className="mt-1.5 font-display text-xl font-700 text-slate-900">{s.value}</p>
              </div>
              <div className={cn('rounded-lg p-2', s.tone === 'brand' ? 'bg-brand-50 text-brand-600' : s.tone === 'accent' ? 'bg-brand-50 text-brand-500' : s.tone === 'success' ? 'bg-success-500/15 text-success-500' : 'bg-warning-500/15 text-warning-400')}>
                <s.icon size={18} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-9000 transition group-hover:text-brand-600">
              <ArrowUpRight size={12} /> عرض
            </div>
          </Link>
        ))}
      </div>

      {/* Revenue + Outstanding */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-500 uppercase tracking-wide text-slate-9000">قيمة العقود النشطة</p>
              <p className="mt-2 font-display text-3xl font-700 text-slate-900">{formatCurrency(revenue)}</p>
            </div>
            <div className="rounded-xl bg-success-500/15 p-2.5 text-success-500">
              <TrendingUp size={22} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3 border-t border-slate-200/80 pt-4">
            <div>
              <p className="text-xs text-slate-9000">المبالغ المستحقة</p>
              <p className="mt-0.5 text-lg font-600 text-warning-400">{formatCurrency(outstanding)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-9000">مسودة</p>
              <p className="mt-0.5 text-lg font-600 text-slate-600">{contracts.filter((c) => c.status === 'draft').length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-9000">منتهي</p>
              <p className="mt-0.5 text-lg font-600 text-danger-400">{contracts.filter((c) => c.status === 'expired').length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-9000">مؤرشف</p>
              <p className="mt-0.5 text-lg font-600 text-slate-9000">{contracts.filter((c) => c.status === 'archived').length}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning-400" />
            <p className="font-display text-sm font-600 text-slate-900">تذكيرات العقود</p>
          </div>
          <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
            {reminders.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-9000">لا توجد انتهاءات قريبة.</p>
            ) : (
              reminders.slice(0, 6).map((r) => (
                <Link key={r.contract.id} to={`/contracts/${r.contract.id}`} className="block rounded-lg border border-slate-200/80 px-3 py-2 transition hover:border-brand-300 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-600 text-slate-800">{r.contract.contract_number}</span>
                    <span className={cn('text-[10px] font-600', r.severity === 'danger' ? 'text-danger-400' : r.severity === 'warning' ? 'text-warning-400' : 'text-brand-600')}>
                      {r.daysLeft < 0 ? 'منتهي' : `${r.daysLeft} يوم متبقي`}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-slate-9000">{r.contract.client?.full_name}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Today's visits + Recent contracts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
            <div className="flex items-center gap-2">
              <CalendarClock size={18} className="text-brand-600" />
              <p className="font-display text-sm font-600 text-slate-900">زيارات اليوم</p>
            </div>
            <Link to="/visits" className="text-xs font-500 text-brand-600 hover:text-brand-800">عرض الكل</Link>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {todayVisits.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-9000">لا توجد زيارات مجدولة اليوم.</p>
            ) : (
              todayVisits.slice(0, 8).map((v) => (
                <Link key={v.id} to={`/clients/${v.contract?.client_id}`} className="flex items-center gap-3 border-b border-slate-200 px-5 py-3 transition hover:bg-slate-50">
                  <span className={cn('h-2.5 w-2.5 rounded-full', v.status === 'completed' ? 'bg-success-500' : v.status === 'started' ? 'bg-warning-500' : 'bg-brand-500')} />
                  <div className="flex-1">
                    <p className="text-sm font-600 text-slate-800">{v.contract?.client?.full_name}</p>
                    <p className="text-xs text-slate-9000">{v.scheduled_start_time ?? '—'} · {v.contract?.package?.name}</p>
                  </div>
                  <StatusBadge status={v.status} label={VISIT_STATUS_LABELS[v.status] ?? v.status} />
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-brand-600" />
              <p className="font-display text-sm font-600 text-slate-900">أحدث العقود</p>
            </div>
            <Link to="/contracts" className="text-xs font-500 text-brand-600 hover:text-brand-800">عرض الكل</Link>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {contracts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-9000">لا توجد عقود بعد.</p>
            ) : (
              contracts.slice(0, 8).map((c) => (
                <Link key={c.id} to={`/contracts/${c.id}`} className="flex items-center gap-3 border-b border-slate-200 px-5 py-3 transition hover:bg-slate-50">
                  <FileText size={16} className="text-slate-9000" />
                  <div className="flex-1">
                    <p className="text-sm font-600 text-brand-600">{c.contract_number}</p>
                    <p className="text-xs text-slate-9000">{c.client?.full_name} · {formatDate(c.end_date)}</p>
                  </div>
                  <StatusBadge status={c.status} label={CONTRACT_STATUS_LABELS[c.status] ?? c.status} />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
