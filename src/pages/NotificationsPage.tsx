import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck, AlertTriangle } from 'lucide-react';
import { notificationService } from '@/services/notificationService';
import { contractService } from '@/services/contractService';
import { useNotifications } from '@/lib/notifications/useNotifications';
import { computeReminders, type ContractReminder } from '@/lib/utils';
import type { NotificationItem } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { useToast } from '@/components/Toast';
import { formatDateTime, cn } from '@/lib/utils';

export function NotificationsPage() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reminders, setReminders] = useState<ContractReminder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, contracts] = await Promise.all([
        notificationService.list(),
        contractService.getReminders(),
      ]);
      setNotifications(n);
      setReminders(computeReminders(contracts));
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh when new notifications arrive
  useNotifications({
    onNewNotification: () => { load(); },
  });

  const markAll = async () => {
    try {
      await notificationService.markAllRead();
      await load();
      toast.push('success', 'تم وضع علامة مقروء على جميع الإشعارات.');
    } catch (err) {
      toast.push('error', (err as Error).message);
    }
  };

  if (loading) return <PageLoader label="جاري تحميل الإشعارات…" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">الإشعارات</h1>
          <p className="mt-1 text-sm text-slate-500">تذكيرات انتهاء العقود وإشعارات النظام.</p>
        </div>
        {notifications.some((n) => !n.read) && (
          <button onClick={markAll} className="btn-ghost"><CheckCheck size={16} /> تحديد الكل كمقروء</button>
        )}
      </div>

      {reminders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
            <AlertTriangle size={16} className="text-warning-400" />
            <p className="font-display text-sm font-600 text-slate-900">تذكيرات انتهاء العقود</p>
          </div>
          <div className="divide-y divide-slate-100">
            {reminders.map((r) => (
              <div key={r.contract.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', r.severity === 'danger' ? 'bg-danger-500' : r.severity === 'warning' ? 'bg-warning-500' : 'bg-brand-400')} />
                <div className="flex-1">
                  <p className="text-sm font-600 text-slate-800">{r.label}</p>
                  <p className="text-xs text-slate-9000">{r.contract.contract_number} · {r.contract.client?.full_name} · ينتهي {r.contract.end_date}</p>
                </div>
                <span className={cn('text-xs font-600', r.severity === 'danger' ? 'text-danger-400' : r.severity === 'warning' ? 'text-warning-400' : 'text-brand-600')}>
                  {r.daysLeft < 0 ? 'منتهي' : `${r.daysLeft} يوم`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
          <Bell size={16} className="text-brand-600" />
          <p className="font-display text-sm font-600 text-slate-900">إشعارات النظام</p>
        </div>
        {notifications.length === 0 ? (
          <EmptyState icon={<Bell size={28} />} title="لا توجد إشعارات" />
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div key={n.id} className={cn('flex items-start gap-3 px-5 py-3.5', !n.read && 'bg-brand-50')}>
                <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.read ? 'bg-slate-300' : 'bg-brand-500')} />
                <div className="flex-1">
                  <p className="text-sm font-600 text-slate-800">{n.title}</p>
                  {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
                  <p className="mt-0.5 text-[10px] text-slate-600">{formatDateTime(n.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
