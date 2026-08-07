import { useEffect, useState, useCallback } from 'react';
import { Inbox, Phone, MapPin, Clock, User, Globe, Search, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { Modal } from '@/components/Modal';
import { formatDate, formatDateTime, cn } from '@/lib/utils';
import type { ServiceRequest, Client } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوح',
  in_progress: 'قيد المعالجة',
  resolved: 'تم الحل',
  closed: 'مغلق',
};

function statusBadge(status: string): string {
  switch (status) {
    case 'open': return 'bg-brand-50 text-brand-700';
    case 'in_progress': return 'bg-warning-50 text-warning-700';
    case 'resolved': return 'bg-success-50 text-success-700';
    case 'closed': return 'bg-slate-100 text-slate-600';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function sourceBadge(source: string) {
  const isCustomer = source === 'customer_portal';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-600',
      isCustomer ? 'bg-brand-50 text-brand-700' : 'bg-accent-50 text-accent-700')}>
      {isCustomer ? 'عميل حالي' : 'طلب من الموقع'}
    </span>
  );
}

export function SupportPage() {
  const { push } = useToast();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState<ServiceRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*, client:clients(*)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setRequests((data as ServiceRequest[]) ?? []);
    } catch (err) {
      push('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('service_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      push('success', 'تم تحديث الحالة');
      load();
      setSelected((prev) => prev ? { ...prev, status } : null);
    } catch (err) {
      push('error', (err as Error).message);
    }
  };

  const filtered = requests.filter((r) => {
    const matchQ = !query ||
      (r.subject ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (r.requester_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (r.client?.full_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (r.requester_phone ?? '').includes(query);
    const matchSource = filterSource === 'all' || r.source === filterSource;
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchQ && matchSource && matchStatus;
  });

  const openCount = requests.filter((r) => r.status === 'open').length;
  const inProgressCount = requests.filter((r) => r.status === 'in_progress').length;
  const resolvedCount = requests.filter((r) => r.status === 'resolved').length;

  if (loading) return <PageLoader label="جارٍ تحميل الطلبات…" />;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">الدعم</h1>
          <p className="mt-1 text-sm text-slate-500">طلبات الدعم والخدمة من العملاء والموقع</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-slate-500"><Inbox size={16} /><span className="text-xs">الإجمالي</span></div>
          <p className="mt-2 font-display text-2xl font-700 text-slate-900">{requests.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-slate-500"><Clock size={16} /><span className="text-xs">مفتوح</span></div>
          <p className="mt-2 font-display text-2xl font-700 text-brand-600">{openCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-slate-500"><Clock size={16} /><span className="text-xs">قيد المعالجة</span></div>
          <p className="mt-2 font-display text-2xl font-700 text-warning-600">{inProgressCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-slate-500"><Clock size={16} /><span className="text-xs">تم الحل</span></div>
          <p className="mt-2 font-display text-2xl font-700 text-success-600">{resolvedCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pr-9" placeholder="ابحث بالاسم، الهاتف، أو الموضوع…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input max-w-[160px]" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
          <option value="all">كل المصادر</option>
          <option value="customer_portal">عملاء حاليون</option>
          <option value="website">طلبات الموقع</option>
        </select>
        <select className="input max-w-[160px]" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Inbox size={32} />} title="لا توجد طلبات" description="لا توجد طلبات دعم مطابقة للبحث." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <div key={r.id} className="card card-hover p-5 cursor-pointer" onClick={() => setSelected(r)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display font-600 text-slate-900 truncate">
                    {r.source === 'customer_portal' ? (r.client?.full_name ?? 'عميل') : (r.requester_name ?? 'زائر')}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <Phone size={12} />
                    {r.source === 'customer_portal' ? (r.client?.phone_number ?? '—') : (r.requester_phone ?? '—')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {sourceBadge(r.source)}
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-600', statusBadge(r.status))}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm font-600 text-slate-700 truncate">{r.subject}</p>
              {r.requested_service && <p className="mt-1 text-xs text-slate-500">الخدمة: {r.requested_service}</p>}
              <p className="mt-1 text-xs text-slate-400">{formatDate(r.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="تفاصيل الطلب"
        size="md"
        footer={
          <>
            <select
              className="input max-w-[180px]"
              value={selected?.status ?? 'open'}
              onChange={(e) => selected && updateStatus(selected.id, e.target.value)}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={() => setSelected(null)} className="btn-ghost">إغلاق</button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4" dir="rtl">
            <div className="flex items-center gap-2">
              {sourceBadge(selected.source)}
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-600', statusBadge(selected.status))}>
                {STATUS_LABELS[selected.status] ?? selected.status}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">نوع مقدم الطلب</span>
                <span className="font-600 text-slate-900">
                  {selected.source === 'customer_portal' ? 'عميل حالي' : 'طلب من الموقع'}
                </span>
              </div>

              {selected.source === 'customer_portal' && selected.client && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">العميل</span>
                    <span className="font-600 text-slate-900">{selected.client.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">الهاتف</span>
                    <span className="font-600 text-slate-900" dir="ltr">{selected.client.phone_number ?? '—'}</span>
                  </div>
                  {selected.client.address && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">العنوان</span>
                      <span className="font-600 text-slate-900">{selected.client.address}</span>
                    </div>
                  )}
                </>
              )}

              {selected.source === 'website' && (
                <>
                  {selected.requester_name && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">الاسم الكامل</span>
                      <span className="font-600 text-slate-900">{selected.requester_name}</span>
                    </div>
                  )}
                  {selected.requester_phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">رقم الهاتف</span>
                      <span className="font-600 text-slate-900" dir="ltr">{selected.requester_phone}</span>
                    </div>
                  )}
                  {selected.requester_address && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">العنوان</span>
                      <span className="font-600 text-slate-900">{selected.requester_address}</span>
                    </div>
                  )}
                  {selected.requested_service && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">نوع الخدمة</span>
                      <span className="font-600 text-slate-900">{selected.requested_service}</span>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-between">
                <span className="text-slate-500">الموضوع</span>
                <span className="font-600 text-slate-900">{selected.subject}</span>
              </div>

              {selected.message && (
                <div>
                  <span className="text-slate-500">تفاصيل الطلب</span>
                  <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{selected.message}</p>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-slate-500">تاريخ الطلب</span>
                <span className="font-600 text-slate-900">{formatDateTime(selected.created_at)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
