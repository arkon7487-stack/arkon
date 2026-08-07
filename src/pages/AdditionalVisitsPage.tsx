import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, AlertTriangle, Filter, Plus } from 'lucide-react';
import { additionalVisitService } from '@/services/additionalVisitService';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { AdditionalVisitModal } from '@/components/AdditionalVisitModal';
import { useToast } from '@/components/Toast';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { VISIT_STATUS_LABELS, VISIT_TYPE_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/locale';
import type { VisitWithRelations } from '@/types';

export function AdditionalVisitsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVisits(await additionalVisitService.getAdditionalVisits());
    } catch {
      toast.push('error', 'تعذر تحميل الزيارات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = visits.filter((v) => {
    if (filterType !== 'all' && v.visit_type !== filterType) return false;
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">الزيارات الإضافية والطوارئ</h1>
          <p className="mt-1 text-sm text-slate-500">إدارة جميع الزيارات الإضافية والطارئة</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-600 text-white shadow-glow transition hover:bg-brand-600"
        >
          <Plus size={16} /> إضافة زيارة
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Filter size={16} />
          <span>تصفية:</span>
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input max-w-[160px]">
          <option value="all">كل الأنواع</option>
          <option value="additional">زيارة إضافية</option>
          <option value="emergency">زيارة طارئة</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input max-w-[160px]">
          <option value="all">كل الحالات</option>
          <option value="scheduled">مجدول</option>
          <option value="started">جاري التنفيذ</option>
          <option value="completed">مكتمل</option>
          <option value="cancelled">ملغي</option>
        </select>
      </div>

      {loading ? (
        <PageLoader label="جارٍ التحميل..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus size={32} className="text-slate-300" />}
          title="لا توجد زيارات إضافية"
          description="لم يتم إنشاء أي زيارات إضافية أو طارئة بعد"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-xs font-600 text-slate-500">
                <th className="px-4 py-3">العميل</th>
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">الوقت</th>
                <th className="px-4 py-3">العامل</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">السعر</th>
                <th className="px-4 py-3">حالة الدفع</th>
                <th className="px-4 py-3">تاريخ الإنشاء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const clientName = v.contract?.client?.full_name ?? '—';
                const employeeName = v.employee?.full_name ?? 'غير معين';
                return (
                  <tr
                    key={v.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50/50 cursor-pointer"
                    onClick={() => navigate(`/clients/${v.contract?.client_id}`)}
                  >
                    <td className="px-4 py-3 font-600 text-slate-900">{clientName}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-600',
                        v.visit_type === 'emergency' ? 'bg-danger-50 text-danger-700' : 'bg-brand-50 text-brand-700',
                      )}>
                        {v.visit_type === 'emergency' ? <AlertTriangle size={12} /> : <CalendarPlus size={12} />}
                        {VISIT_TYPE_LABELS[v.visit_type] ?? v.visit_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(v.scheduled_date)}</td>
                    <td className="px-4 py-3 text-slate-600">{v.scheduled_start_time ?? '—'} - {v.scheduled_end_time ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{employeeName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-600 text-slate-700">
                        {VISIT_STATUS_LABELS[v.status] ?? v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-600 text-slate-900">{formatCurrency(v.visit_charge_amount ?? 0)}</td>
                    <td className="px-4 py-3 text-slate-600">—</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDate(v.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdditionalVisitModal
        open={showModal}
        onClose={() => setShowModal(false)}
        clientId=""
        clientName=""
        onCreated={() => {
          setShowModal(false);
          load();
        }}
      />
    </div>
  );
}