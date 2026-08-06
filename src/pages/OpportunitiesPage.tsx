import { useEffect, useState } from 'react';
import {
  Plus, Target, Pencil, Trash2, Search, Phone, MapPin,
  TrendingUp, UserCheck, CheckCircle2, XCircle, Filter, ArrowRight,
} from 'lucide-react';
import { opportunityService, type OpportunityInput } from '@/services/opportunityService';
import type { Opportunity, Package as PackageType } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { Modal } from '@/components/Modal';
import { ConfirmDialog, NumberInput } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { packageService } from '@/services/packageService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const STATUS_LABELS: Record<string, string> = {
  new: 'جديد', sent_to_sales: 'تم الإرسال للمبيعات', contacted: 'تم التواصل', qualified: 'مؤهل', converted: 'تم التحويل', rejected: 'مرفوض', closed: 'مغلق',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'منخفضة', medium: 'متوسطة', high: 'عالية',
};

const LEAD_SOURCE_LABELS: Record<string, string> = {
  website: 'الموقع الإلكتروني',
  field_worker: 'عامل ميداني',
  employee: 'موظف',
  phone_call: 'اتصال هاتفي',
  social_media: 'وسائل التواصل الاجتماعي',
  referral: 'توصية',
  walk_in: 'زيارة مباشرة',
  campaign: 'حملة إعلانية',
  other: 'أخرى',
};

function sourceBadge(source: string | null | undefined) {
  if (!source) return null;
  const label = LEAD_SOURCE_LABELS[source] ?? source;
  const isWebsite = source === 'website';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-600', isWebsite ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-500')}>
      {label}
    </span>
  );
}

function statusBadge(status: string) {
  switch (status) {
    case 'new': return 'bg-brand-50 text-brand-700';
    case 'contacted': return 'bg-warning-50 text-warning-700';
    case 'qualified': return 'bg-accent-50 text-accent-700';
    case 'converted': return 'bg-success-50 text-success-700';
    case 'rejected': return 'bg-danger-50 text-danger-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

const emptyForm: OpportunityInput = {
  customer_name: '', phone_number: '', alt_phone: '', address: '', city: '',
  location_link: '', interested_service: '', expected_budget: 0, lead_source: '', notes: '', priority: 'medium',
};

export function OpportunitiesPage() {
  const toast = useToast();
  const { session } = useAuth();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [form, setForm] = useState<OpportunityInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Opportunity | null>(null);
  const [convertTarget, setConvertTarget] = useState<Opportunity | null>(null);
  const [convertPkgId, setConvertPkgId] = useState('');
  const [convertStartDate, setConvertStartDate] = useState('');
  const [convertEndDate, setConvertEndDate] = useState('');
  const [convertPrice, setConvertPrice] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [o, p] = await Promise.all([opportunityService.list(), packageService.list()]);
      setOpps(o); setPackages(p);
    } catch (err) { toast.push('error', (err as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, created_by: session?.profile?.employee_id ?? null });
    setModalOpen(true);
  };

  const openEdit = (o: Opportunity) => {
    setEditing(o);
    setForm({
      customer_name: o.customer_name, phone_number: o.phone_number, alt_phone: o.alt_phone ?? '',
      address: o.address ?? '', city: o.city ?? '', location_link: o.location_link ?? '',
      interested_service: o.interested_service ?? '', expected_budget: o.expected_budget ?? 0,
      lead_source: o.lead_source ?? '', notes: o.notes ?? '', priority: o.priority,
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) { await opportunityService.update(editing.id, form); toast.push('success', 'تم تحديث الفرصة'); }
      else { await opportunityService.create(form); toast.push('success', 'تم إنشاء الفرصة'); }
      setModalOpen(false); await load();
    } catch (err) { toast.push('error', (err as Error).message); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    try { await opportunityService.remove(confirmTarget.id); toast.push('success', 'تم حذف الفرصة'); await load(); }
    catch (err) { toast.push('error', (err as Error).message); }
    finally { setConfirmTarget(null); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('opportunities').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.push('success', 'تم تحديث الحالة');
      await load();
    } catch (err) { toast.push('error', (err as Error).message); }
  };

  const openConvert = (o: Opportunity) => {
    // Navigate to Sales module — the opportunity is already linked to a sales lead
    if (o.sales_lead_id) {
      toast.push('info', 'تم إرسال هذه الفرصة إلى المبيعات. استكمل دورة البيع هناك ثم استورد العميل من المبيعات.');
      return;
    }
    toast.push('info', 'سيتم إنشاء سجل مبيعات لهذه الفرصة تلقائياً. انتقل إلى المبيعات لإكمال دورة البيع.');
  };

  const doConvert = async () => {
    // No longer used — conversion happens through Sales → Customer Creation
    setConvertTarget(null);
  };

  const filtered = opps.filter((o) => {
    const matchQ = !query || o.customer_name.toLowerCase().includes(query.toLowerCase()) || o.phone_number.includes(query);
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchQ && matchStatus;
  });

  const total = opps.length;
  const newLeads = opps.filter((o) => o.status === 'new').length;
  const qualified = opps.filter((o) => o.status === 'qualified').length;
  const converted = opps.filter((o) => o.status === 'converted').length;
  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  if (loading) return <PageLoader label="جارٍ تحميل الفرص…" />;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">الفرص</h1>
          <p className="mt-1 text-sm text-slate-500">إدارة العملاء المحتملين وخطة المبيعات</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> إضافة فرصة</button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><Target size={16} /><span className="text-xs">إجمالي</span></div><p className="mt-2 font-display text-2xl font-700 text-slate-900">{total}</p></div>
        <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><TrendingUp size={16} /><span className="text-xs">جديد</span></div><p className="mt-2 font-display text-2xl font-700 text-brand-600">{newLeads}</p></div>
        <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><UserCheck size={16} /><span className="text-xs">مؤهل</span></div><p className="mt-2 font-display text-2xl font-700 text-warning-600">{qualified}</p></div>
        <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><CheckCircle2 size={16} /><span className="text-xs">محول</span></div><p className="mt-2 font-display text-2xl font-700 text-success-600">{converted}</p></div>
        <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><XCircle size={16} /><span className="text-xs">معدل التحويل</span></div><p className="mt-2 font-display text-2xl font-700 text-slate-900">{conversionRate}%</p></div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pr-9" placeholder="ابحث بالاسم أو الهاتف…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input max-w-[160px]" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Target size={32} />} title="لا توجد فرص" description="سجل عميلاً محتملاً للبدء." action={<button onClick={openCreate} className="btn-primary"><Plus size={16} /> إضافة فرصة</button>} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((o) => (
            <div key={o.id} className="card card-hover p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display font-600 text-slate-900">{o.customer_name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Phone size={12} /> {o.phone_number}</p>
                  {o.city && <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {o.city}</p>}
                </div>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-600', statusBadge(o.status))}>{STATUS_LABELS[o.status] ?? o.status}</span>
              </div>

              {o.lead_source && (
                <div className="mt-2">{sourceBadge(o.lead_source)}</div>
              )}

              {o.interested_service && <p className="mt-3 text-sm text-slate-600">الخدمة: {o.interested_service}</p>}
              {o.expected_budget ? <p className="mt-1 text-sm text-slate-600">الميزانية: {formatCurrency(o.expected_budget)}</p> : null}
              {o.creator && <p className="mt-1 text-xs text-slate-400">بواسطة: {o.creator.full_name}</p>}
              {o.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{o.notes}</p>}

              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
                <div className="flex gap-1">
                  <button onClick={() => openEdit(o)} className="rounded-lg bg-slate-50 p-2 text-brand-600 hover:bg-brand-50"><Pencil size={14} /></button>
                  <button onClick={() => setConfirmTarget(o)} className="rounded-lg bg-slate-50 p-2 text-slate-500 hover:bg-danger-50 hover:text-danger-500"><Trash2 size={14} /></button>
                </div>
                <div className="flex items-center gap-2">
                  {o.status !== 'converted' && (
                    <select
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
                      value={o.status}
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  )}
                  {o.status === 'qualified' && (
                    <button onClick={() => openConvert(o)} className="btn-primary text-xs">إرسال للمبيعات <ArrowRight size={12} /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل الفرصة' : 'إضافة فرصة جديدة'} size="lg"
        footer={<><button onClick={() => setModalOpen(false)} className="btn-ghost">إلغاء</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'جارٍ الحفظ…' : 'حفظ'}</button></>}>
        <form onSubmit={save} className="space-y-4" dir="rtl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="label">اسم العميل *</label><input className="input" required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div><label className="label">رقم الهاتف *</label><input className="input" required value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} dir="ltr" /></div>
            <div><label className="label">هاتف بديل</label><input className="input" value={form.alt_phone} onChange={(e) => setForm({ ...form, alt_phone: e.target.value })} dir="ltr" /></div>
            <div><label className="label">المدينة</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label">العنوان</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><label className="label">رابط الموقع</label><input className="input" value={form.location_link} onChange={(e) => setForm({ ...form, location_link: e.target.value })} dir="ltr" /></div>
            <div><label className="label">الخدمة المطلوبة</label><input className="input" value={form.interested_service} onChange={(e) => setForm({ ...form, interested_service: e.target.value })} /></div>
            <NumberInput label="الميزانية المتوقعة" value={form.expected_budget || undefined} onChange={(v) => setForm({ ...form, expected_budget: v ?? 0 })} min={0} step={0.01} placeholder="0.00" prefix="₪" />
            <div><label className="label">مصدر العميل</label>
              <select className="input" value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value })}>
                <option value="">اختر المصدر</option>
                {Object.entries(LEAD_SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="label">الأولوية</label><select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div><label className="label">ملاحظات</label><textarea className="input min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </form>
      </Modal>

      <Modal open={!!convertTarget} onClose={() => setConvertTarget(null)} title="تحويل الفرصة" subtitle="تم إرسال الفرصة إلى المبيعات" size="md"
        footer={<><button onClick={() => setConvertTarget(null)} className="btn-ghost">إغلاق</button></>}>
        <div className="space-y-4" dir="rtl">
          <p className="text-sm text-slate-600">تم إنشاء سجل مبيعات لهذه الفرصة. انتقل إلى قسم المبيعات لإدارة دورة البيع، ثم استورد العميل من هناك عند إتمام الصفقة.</p>
          {convertTarget?.sales_lead_id && (
            <button onClick={() => navigate('/sales')} className="btn-primary w-full">الانتقال للمبيعات <ArrowRight size={14} /></button>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmTarget} onClose={() => setConfirmTarget(null)} onConfirm={confirmDelete} title="حذف الفرصة" message="هل أنت متأكد من حذف هذه الفرصة؟" confirmLabel="حذف" danger />
    </div>
  );
}
