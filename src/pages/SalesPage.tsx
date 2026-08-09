import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Plus, Search, LayoutGrid, List, Phone, MapPin,
  Calendar, DollarSign, User, ChevronDown, X, Check, Star,
  AlertTriangle, MessageSquare, Clock, Target, BarChart3,
  Pencil, Trash2, ArrowRight, UserPlus, Activity, ChevronRight,
} from 'lucide-react';
import { leadService, type CreateLeadInput } from '@/services/leadService';
import type { Lead, LeadActivity, LeadStage, Employee } from '@/types';
import { employeeService } from '@/services/employeeService';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { Modal } from '@/components/Modal';
import { ConfirmDialog, NumberInput } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

// ─── Stage config ────────────────────────────────────────────────────────────

const STAGES: { key: LeadStage; label: string; color: string; bg: string; border: string }[] = [
  { key: 'new_lead',       label: 'ليد جديد',       color: 'text-slate-600',   bg: 'bg-slate-100',      border: 'border-slate-200' },
  { key: 'contacted',      label: 'تم التواصل',      color: 'text-blue-600',    bg: 'bg-blue-50',        border: 'border-blue-200' },
  { key: 'follow_up',      label: 'متابعة',          color: 'text-amber-600',   bg: 'bg-amber-50',       border: 'border-amber-200' },
  { key: 'quotation_sent', label: 'تم إرسال عرض',    color: 'text-purple-600',  bg: 'bg-purple-50',      border: 'border-purple-200' },
  { key: 'negotiation',    label: 'تفاوض',           color: 'text-orange-600',  bg: 'bg-orange-50',      border: 'border-orange-200' },
  { key: 'won',            label: 'رابح',            color: 'text-success-600', bg: 'bg-success-50',     border: 'border-success-200' },
  { key: 'lost',           label: 'خسارة',           color: 'text-danger-600',  bg: 'bg-danger-50',      border: 'border-danger-200' },
];

const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.key, s]));

const LEAD_SOURCES = ['موقع إلكتروني', 'توصية', 'مكالمة باردة', 'وسائل التواصل', 'إعلانات', 'معرض', 'أخرى'];

const SERVICES = ['تنظيف منزلي', 'تنظيف تجاري', 'رعاية مسنين', 'خدمات طبية', 'تنظيف صناعي', 'أخرى'];

const EVENT_ICONS: Record<string, React.ReactNode> = {
  lead_created:    <Star size={12} className="text-brand-500" />,
  call_made:       <Phone size={12} className="text-blue-500" />,
  follow_up_added: <Clock size={12} className="text-amber-500" />,
  note_added:      <MessageSquare size={12} className="text-slate-500" />,
  quotation_sent:  <ArrowRight size={12} className="text-purple-500" />,
  stage_changed:   <Activity size={12} className="text-slate-500" />,
  deal_won:        <Check size={12} className="text-success-500" />,
  deal_lost:       <X size={12} className="text-danger-500" />,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptyForm: CreateLeadInput = {
  full_name: '', phone_number: '', alternate_phone: '', address: '', area: '',
  lead_source: '', interested_service: '', notes: '',
  stage: 'new_lead', assigned_employee_id: '', expected_value: undefined, follow_up_date: '',
};

type ViewMode = 'kanban' | 'table';
type PageTab  = 'pipeline' | 'dashboard';

// ─── Component ────────────────────────────────────────────────────────────────

export function SalesPage() {
  const toast   = useToast();
  const navigate = useNavigate();

  const [leads,     setLeads]     = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState('');
  const [pageTab,   setPageTab]   = useState<PageTab>('pipeline');
  const [viewMode,  setViewMode]  = useState<ViewMode>('kanban');

  // Create / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<Lead | null>(null);
  const [form,      setForm]      = useState<CreateLeadInput>(emptyForm);
  const [saving,    setSaving]    = useState(false);

  // Detail panel
  const [detail,     setDetail]     = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [actLoading, setActLoading] = useState(false);

  // Stage change
  const [stageTarget, setStageTarget] = useState<Lead | null>(null);
  const [newStage,    setNewStage]    = useState<LeadStage>('new_lead');
  const [lostReason,  setLostReason]  = useState('');
  const [stageSaving, setStageSaving] = useState(false);

  // Quick-note modal
  const [noteTarget, setNoteTarget] = useState<Lead | null>(null);
  const [noteText,   setNoteText]   = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      const [l, e] = await Promise.all([leadService.list(), employeeService.list()]);
      setLeads(l); setEmployees(e);
    } catch (err) { toast.push('error', (err as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const loadActivities = async (leadId: string) => {
    setActLoading(true);
    try { setActivities(await leadService.getActivities(leadId)); }
    catch (err) { toast.push('error', (err as Error).message); }
    finally { setActLoading(false); }
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!query.trim()) return leads;
    const q = query.trim().toLowerCase();
    return leads.filter((l) =>
      l.full_name.toLowerCase().includes(q) ||
      l.phone_number.includes(q) ||
      (l.area ?? '').toLowerCase().includes(q) ||
      (l.interested_service ?? '').toLowerCase().includes(q),
    );
  }, [leads, query]);

  const byStage = useMemo(() => {
    const m: Record<LeadStage, Lead[]> = {
      new_lead: [], contacted: [], follow_up: [], quotation_sent: [],
      negotiation: [], won: [], lost: [],
    };
    for (const l of filtered) m[l.stage]?.push(l);
    return m;
  }, [filtered]);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = leads.length;
    const won   = leads.filter((l) => l.stage === 'won').length;
    const lost  = leads.filter((l) => l.stage === 'lost').length;
    const byStageCount: Record<string, number> = {};
    for (const l of leads) byStageCount[l.stage] = (byStageCount[l.stage] ?? 0) + 1;
    const conversionRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
    const totalValue = leads.filter((l) => l.stage === 'won').reduce((s, l) => s + Number(l.expected_value ?? 0), 0);
    const bySource: Record<string, number> = {};
    for (const l of leads) {
      const src = l.lead_source ?? 'غير محدد';
      bySource[src] = (bySource[src] ?? 0) + 1;
    }
    const byEmployee: Record<string, { name: string; won: number; lost: number; total: number }> = {};
    for (const l of leads) {
      const empId = l.assigned_employee_id ?? 'unassigned';
      const empName = (l.assigned_employee as Employee | null)?.full_name ?? 'غير محدد';
      if (!byEmployee[empId]) byEmployee[empId] = { name: empName, won: 0, lost: 0, total: 0 };
      byEmployee[empId].total += 1;
      if (l.stage === 'won')  byEmployee[empId].won  += 1;
      if (l.stage === 'lost') byEmployee[empId].lost += 1;
    }
    return { total, won, lost, byStageCount, conversionRate, totalValue, bySource, byEmployee };
  }, [leads]);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setForm({
      full_name: lead.full_name,
      phone_number: lead.phone_number,
      alternate_phone: lead.alternate_phone ?? '',
      address: lead.address ?? '',
      area: lead.area ?? '',
      lead_source: lead.lead_source ?? '',
      interested_service: lead.interested_service ?? '',
      notes: lead.notes ?? '',
      stage: lead.stage,
      assigned_employee_id: lead.assigned_employee_id ?? '',
      expected_value: lead.expected_value ?? undefined,
      follow_up_date: lead.follow_up_date ?? '',
    });
    setDetail(null);
    setModalOpen(true);
  };

  const saveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.push('error', 'الاسم مطلوب'); return; }
    if (!form.phone_number.trim()) { toast.push('error', 'رقم الهاتف مطلوب'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        assigned_employee_id: form.assigned_employee_id || undefined,
        expected_value: form.expected_value ?? undefined,
        follow_up_date: form.follow_up_date || undefined,
      };
      if (editing) {
        await leadService.update(editing.id, payload);
        toast.push('success', 'تم تحديث الليد');
      } else {
        await leadService.create(payload);
        toast.push('success', 'تم إنشاء الليد بنجاح');
      }
      setModalOpen(false);
      await load();
    } catch (err) { toast.push('error', (err as Error).message); }
    finally { setSaving(false); }
  };

  const openDetail = async (lead: Lead) => {
    setDetail(lead);
    await loadActivities(lead.id);
  };

  const changeStage = async () => {
    if (!stageTarget) return;
    setStageSaving(true);
    try {
      await leadService.changeStage(stageTarget.id, newStage, newStage === 'lost' ? { lost_reason: lostReason } : undefined);
      toast.push('success', 'تم تغيير المرحلة');
      setStageTarget(null);
      setLostReason('');
      if (detail?.id === stageTarget.id) {
        const updated = await leadService.get(stageTarget.id);
        setDetail(updated);
        await loadActivities(stageTarget.id);
      }
      await load();
    } catch (err) { toast.push('error', (err as Error).message); }
    finally { setStageSaving(false); }
  };

  const addNote = async () => {
    if (!noteTarget || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      await leadService.addActivity(noteTarget.id, 'note_added', noteText.trim(), 'المستخدم');
      toast.push('success', 'تمت إضافة الملاحظة');
      setNoteTarget(null); setNoteText('');
      if (detail?.id === noteTarget.id) await loadActivities(noteTarget.id);
    } catch (err) { toast.push('error', (err as Error).message); }
    finally { setNoteSaving(false); }
  };

  const deleteLead = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await leadService.remove(deleteTarget.id);
      toast.push('success', 'تم حذف الليد');
      setDeleteTarget(null);
      setDetail(null);
      await load();
    } catch (err) { toast.push('error', (err as Error).message); }
    finally { setDeleting(false); }
  };

  const convertToCustomer = (lead: Lead) => {
    const params = new URLSearchParams({
      from_lead: lead.id,
      name: lead.full_name,
      phone: lead.phone_number,
      address: lead.address ?? '',
      area: lead.area ?? '',
      notes: lead.notes ?? '',
      service: lead.interested_service ?? '',
    });
    if (lead.opportunity_id) params.set('from_opportunity', lead.opportunity_id);
    navigate(`/clients/new?${params.toString()}`);
  };

  if (loading) return <PageLoader label="جارٍ تحميل قسم المبيعات…" />;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">المبيعات</h1>
          <p className="mt-1 text-sm text-slate-500">إدارة خط مبيعات كامل — من أول تواصل حتى إتمام الصفقة</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> إضافة ليد</button>
      </div>

      {/* Page tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 max-w-xs">
        {([['pipeline', 'خط المبيعات'], ['dashboard', 'لوحة المبيعات']] as [PageTab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setPageTab(key)} className={cn('flex-1 rounded-lg py-2 text-sm font-600 transition', pageTab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>{label}</button>
        ))}
      </div>

      {/* ── Dashboard ────────────────────────────────────────────────────────── */}
      {pageTab === 'dashboard' && <SalesDashboard stats={stats} leads={leads} />}

      {/* ── Pipeline ─────────────────────────────────────────────────────────── */}
      {pageTab === 'pipeline' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pr-9" placeholder="ابحث عن ليد…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden">
              <button onClick={() => setViewMode('kanban')} className={cn('flex items-center gap-1.5 px-3 py-2 text-sm transition', viewMode === 'kanban' ? 'bg-brand-50 text-brand-700 font-600' : 'text-slate-500 hover:bg-slate-50')}>
                <LayoutGrid size={15} /> كانبان
              </button>
              <button onClick={() => setViewMode('table')} className={cn('flex items-center gap-1.5 px-3 py-2 text-sm transition border-r border-slate-200', viewMode === 'table' ? 'bg-brand-50 text-brand-700 font-600' : 'text-slate-500 hover:bg-slate-50')}>
                <List size={15} /> جدول
              </button>
            </div>
          </div>

          {viewMode === 'kanban' && (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STAGES.map((stage) => (
                <KanbanColumn
                  key={stage.key}
                  stage={stage}
                  leads={byStage[stage.key] ?? []}
                  onOpen={openDetail}
                  onStageChange={(lead) => { setStageTarget(lead); setNewStage(lead.stage); }}
                />
              ))}
            </div>
          )}

          {viewMode === 'table' && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="px-4 py-3 text-right font-600">الاسم</th>
                    <th className="px-4 py-3 text-right font-600">الهاتف</th>
                    <th className="px-4 py-3 text-right font-600">المنطقة</th>
                    <th className="px-4 py-3 text-right font-600">الخدمة</th>
                    <th className="px-4 py-3 text-right font-600">المرحلة</th>
                    <th className="px-4 py-3 text-right font-600">المسؤول</th>
                    <th className="px-4 py-3 text-right font-600">القيمة</th>
                    <th className="px-4 py-3 text-right font-600">المتابعة</th>
                    <th className="px-4 py-3 text-right font-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">لا توجد نتائج</td></tr>
                  ) : filtered.map((lead) => {
                    const stg = STAGE_MAP[lead.stage];
                    return (
                      <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(lead)}>
                        <td className="px-4 py-3 font-600 text-slate-900">{lead.full_name}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">{lead.phone_number}</td>
                        <td className="px-4 py-3 text-slate-600">{lead.area ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{lead.interested_service ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-600 border', stg.color, stg.bg, stg.border)}>
                            {stg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{(lead.assigned_employee as Employee | null)?.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700 font-600">{lead.expected_value ? formatCurrency(Number(lead.expected_value)) : '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{lead.follow_up_date ? formatDate(lead.follow_up_date) : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => openEdit(lead)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil size={13} /></button>
                            <button onClick={() => setDeleteTarget(lead)} className="rounded p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-600"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Create / Edit Modal ────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'تعديل الليد' : 'إضافة ليد جديد'}
        size="xl"
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn-ghost">إلغاء</button>
          <button onClick={saveLead} disabled={saving} className="btn-primary">{saving ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديلات' : 'إنشاء الليد'}</button>
        </>}
      >
        <form onSubmit={saveLead} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="الاسم الكامل" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} required />
            <F label="رقم الهاتف" value={form.phone_number} onChange={(v) => setForm({ ...form, phone_number: v })} required />
            <F label="هاتف بديل" value={form.alternate_phone ?? ''} onChange={(v) => setForm({ ...form, alternate_phone: v })} />
            <F label="العنوان" value={form.address ?? ''} onChange={(v) => setForm({ ...form, address: v })} />
            <F label="المنطقة" value={form.area ?? ''} onChange={(v) => setForm({ ...form, area: v })} />
            <div>
              <label className="label">مصدر الليد</label>
              <select className="input" value={form.lead_source ?? ''} onChange={(e) => setForm({ ...form, lead_source: e.target.value })}>
                <option value="">— اختر —</option>
                {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الخدمة المطلوبة</label>
              <select className="input" value={form.interested_service ?? ''} onChange={(e) => setForm({ ...form, interested_service: e.target.value })}>
                <option value="">— اختر —</option>
                {SERVICES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">المرحلة الحالية</label>
              <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as LeadStage })}>
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الموظف المسؤول</label>
              <select className="input" value={form.assigned_employee_id ?? ''} onChange={(e) => setForm({ ...form, assigned_employee_id: e.target.value })}>
                <option value="">— غير محدد —</option>
                {employees.filter((e) => e.employment_status === 'active').map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">القيمة المتوقعة (₪)</label>
              <NumberInput value={form.expected_value ?? undefined} onChange={(v) => setForm({ ...form, expected_value: v })} min={0} step={0.01} placeholder="0.00" prefix="₪" />
            </div>
            <F label="تاريخ المتابعة" type="date" value={form.follow_up_date ?? ''} onChange={(v) => setForm({ ...form, follow_up_date: v })} />
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <textarea className="input min-h-[80px] resize-none" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </form>
      </Modal>

      {/* ── Detail Drawer Modal ──────────────────────────────────────────────── */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="تفاصيل الليد" size="xl"
        footer={detail && (
          <div className="flex w-full flex-wrap gap-2 justify-end">
            {detail.stage === 'won' && (
              <button onClick={() => convertToCustomer(detail)} className="btn-primary">
                <UserPlus size={15} /> إنشاء عميل
              </button>
            )}
            <button onClick={() => { setStageTarget(detail); setNewStage(detail.stage); }} className="btn-ghost">
              <ChevronRight size={15} /> تغيير المرحلة
            </button>
            <button onClick={() => { setNoteTarget(detail); setNoteText(''); }} className="btn-ghost">
              <MessageSquare size={15} /> إضافة ملاحظة
            </button>
            <button onClick={() => openEdit(detail)} className="btn-ghost"><Pencil size={15} /> تعديل</button>
            <button onClick={() => setDeleteTarget(detail)} className="btn-ghost text-danger-600"><Trash2 size={15} /> حذف</button>
          </div>
        )}
      >
        {detail && (
          <div className="space-y-5">
            {/* Stage badge */}
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-600', STAGE_MAP[detail.stage].color, STAGE_MAP[detail.stage].bg, STAGE_MAP[detail.stage].border)}>
                {STAGE_MAP[detail.stage].label}
              </span>
              {detail.follow_up_date && (
                <span className="flex items-center gap-1.5 text-sm text-amber-600">
                  <Calendar size={14} /> متابعة: {formatDate(detail.follow_up_date)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DItem icon={<User size={14} />} label="الاسم" value={detail.full_name} />
              <DItem icon={<Phone size={14} />} label="الهاتف" value={detail.phone_number} />
              {detail.alternate_phone && <DItem icon={<Phone size={14} />} label="هاتف بديل" value={detail.alternate_phone} />}
              {detail.area && <DItem icon={<MapPin size={14} />} label="المنطقة" value={detail.area} />}
              {detail.address && <DItem icon={<MapPin size={14} />} label="العنوان" value={detail.address} />}
              {detail.lead_source && <DItem icon={<Target size={14} />} label="المصدر" value={detail.lead_source} />}
              {detail.interested_service && <DItem icon={<Star size={14} />} label="الخدمة" value={detail.interested_service} />}
              {detail.expected_value != null && <DItem icon={<DollarSign size={14} />} label="القيمة المتوقعة" value={formatCurrency(Number(detail.expected_value))} />}
              {(detail.assigned_employee as Employee | null)?.full_name && <DItem icon={<User size={14} />} label="المسؤول" value={(detail.assigned_employee as Employee).full_name} />}
            </div>

            {detail.notes && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs font-600 text-slate-500 mb-1">ملاحظات</p>
                <p className="text-sm text-slate-700">{detail.notes}</p>
              </div>
            )}

            {detail.lost_reason && (
              <div className="rounded-lg bg-danger-50 border border-danger-200 p-4 flex gap-3">
                <AlertTriangle size={16} className="text-danger-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-600 text-danger-600 mb-0.5">سبب الخسارة</p>
                  <p className="text-sm text-danger-700">{detail.lost_reason}</p>
                </div>
              </div>
            )}

            {/* Activity timeline */}
            <div>
              <p className="mb-3 text-sm font-600 text-slate-700">سجل النشاط</p>
              {actLoading ? (
                <p className="text-sm text-slate-400">جارٍ التحميل…</p>
              ) : activities.length === 0 ? (
                <p className="text-sm text-slate-400">لا يوجد نشاط مسجل</p>
              ) : (
                <div className="relative border-r-2 border-slate-100 pr-4 space-y-4">
                  {activities.map((act) => (
                    <div key={act.id} className="relative">
                      <span className="absolute -right-[21px] flex h-4 w-4 items-center justify-center rounded-full bg-white border border-slate-200">
                        {EVENT_ICONS[act.event_type] ?? <Activity size={10} className="text-slate-400" />}
                      </span>
                      <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
                        <p className="text-sm text-slate-800">{act.message}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                          {act.user_name && <span>{act.user_name}</span>}
                          <span>·</span>
                          <span>{new Date(act.created_at).toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Stage Change Modal ───────────────────────────────────────────────── */}
      <Modal open={!!stageTarget} onClose={() => setStageTarget(null)} title="تغيير مرحلة الليد" size="sm"
        footer={<>
          <button onClick={() => setStageTarget(null)} className="btn-ghost">إلغاء</button>
          <button onClick={changeStage} disabled={stageSaving} className="btn-primary">{stageSaving ? 'جارٍ الحفظ…' : 'تأكيد التغيير'}</button>
        </>}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">اختر المرحلة الجديدة للليد: <strong>{stageTarget?.full_name}</strong></p>
          <div className="grid grid-cols-1 gap-2">
            {STAGES.map((s) => (
              <button key={s.key} onClick={() => setNewStage(s.key)} className={cn('flex items-center gap-3 rounded-lg border px-4 py-3 text-right transition', newStage === s.key ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300')}>
                <span className={cn('h-2.5 w-2.5 rounded-full', s.bg, 'border', s.border)} />
                <span className={cn('text-sm font-600', newStage === s.key ? 'text-brand-700' : 'text-slate-700')}>{s.label}</span>
                {newStage === s.key && <Check size={14} className="mr-auto text-brand-600" />}
              </button>
            ))}
          </div>
          {newStage === 'lost' && (
            <div>
              <label className="label">سبب الخسارة</label>
              <input className="input" value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="اختياري — وصف سبب الخسارة" />
            </div>
          )}
        </div>
      </Modal>

      {/* ── Note Modal ───────────────────────────────────────────────────────── */}
      <Modal open={!!noteTarget} onClose={() => setNoteTarget(null)} title="إضافة ملاحظة" size="sm"
        footer={<>
          <button onClick={() => setNoteTarget(null)} className="btn-ghost">إلغاء</button>
          <button onClick={addNote} disabled={noteSaving || !noteText.trim()} className="btn-primary">{noteSaving ? 'جارٍ الحفظ…' : 'إضافة'}</button>
        </>}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">الليد: <strong>{noteTarget?.full_name}</strong></p>
          <textarea className="input min-h-[100px] resize-none" placeholder="اكتب الملاحظة…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
        </div>
      </Modal>

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteLead}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف الليد "${deleteTarget?.full_name ?? ''}"؟`}
        confirmLabel={deleting ? 'جارٍ الحذف…' : 'حذف'}
        cancelLabel="إلغاء"
        danger
      />
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({ stage, leads, onOpen, onStageChange }: {
  stage: typeof STAGES[0];
  leads: Lead[];
  onOpen: (l: Lead) => void;
  onStageChange: (l: Lead) => void;
}) {
  const total = leads.reduce((s, l) => s + Number(l.expected_value ?? 0), 0);
  return (
    <div className="flex min-w-[260px] max-w-[320px] flex-1 flex-col gap-3">
      <div className={cn('flex items-center justify-between rounded-lg border px-3 py-2', stage.bg, stage.border)}>
        <span className={cn('text-sm font-700', stage.color)}>{stage.label}</span>
        <div className="flex items-center gap-2">
          {total > 0 && <span className="text-xs text-slate-500">{formatCurrency(total)}</span>}
          <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-xs font-700', stage.color, 'bg-white border', stage.border)}>
            {leads.length}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 min-h-[120px]">
        {leads.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-200">
            <span className="text-xs text-slate-300">لا يوجد</span>
          </div>
        ) : leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onOpen={onOpen} onStageChange={onStageChange} />
        ))}
      </div>
    </div>
  );
}

// ─── LeadCard ─────────────────────────────────────────────────────────────────

function LeadCard({ lead, onOpen, onStageChange }: {
  lead: Lead;
  onOpen: (l: Lead) => void;
  onStageChange: (l: Lead) => void;
}) {
  return (
    <div className="group card rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onOpen(lead)}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-600 text-slate-900 text-sm leading-snug">{lead.full_name}</p>
        <button
          onClick={(e) => { e.stopPropagation(); onStageChange(lead); }}
          className="opacity-0 group-hover:opacity-100 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-600 transition"
        >
          <ChevronDown size={13} />
        </button>
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Phone size={11} /> <span className="font-mono">{lead.phone_number}</span>
        </div>
        {lead.area && <div className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={11} /> {lead.area}</div>}
        {lead.interested_service && <div className="flex items-center gap-1.5 text-xs text-slate-500"><Star size={11} /> {lead.interested_service}</div>}
        {lead.expected_value != null && (
          <div className="flex items-center gap-1.5 text-xs font-600 text-success-600">
            <DollarSign size={11} /> {formatCurrency(Number(lead.expected_value))}
          </div>
        )}
        {lead.follow_up_date && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <Calendar size={11} /> {formatDate(lead.follow_up_date)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sales Dashboard ──────────────────────────────────────────────────────────

interface StatsShape {
  total: number; won: number; lost: number;
  byStageCount: Record<string, number>;
  conversionRate: number; totalValue: number;
  bySource: Record<string, number>;
  byEmployee: Record<string, { name: string; won: number; lost: number; total: number }>;
}

function SalesDashboard({ stats, leads }: { stats: StatsShape; leads: Lead[] }) {
  const followUps = leads.filter((l) => l.follow_up_date && new Date(l.follow_up_date) <= new Date()).length;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPI label="إجمالي الليدات" value={stats.total} color="text-slate-900" />
        <KPI label="ليدات جديدة" value={stats.byStageCount.new_lead ?? 0} color="text-blue-600" />
        <KPI label="متابعات متأخرة" value={followUps} color="text-amber-600" />
        <KPI label="عروض مُرسلة" value={stats.byStageCount.quotation_sent ?? 0} color="text-purple-600" />
        <KPI label="صفقات رابحة" value={stats.won} color="text-success-600" />
        <KPI label="صفقات خاسرة" value={stats.lost} color="text-danger-600" />
        <KPI label="معدل التحويل" value={`${stats.conversionRate}%`} color="text-brand-600" />
        <div className="card p-4">
          <p className="text-xs text-slate-500">قيمة الصفقات الرابحة</p>
          <p className="mt-2 font-display text-xl font-700 text-success-600 leading-tight">{formatCurrency(stats.totalValue)}</p>
        </div>
      </div>

      {/* Pipeline stages breakdown */}
      <div className="card p-5">
        <h3 className="mb-4 font-600 text-slate-900">توزيع المراحل</h3>
        <div className="space-y-3">
          {STAGES.map((s) => {
            const count = stats.byStageCount[s.key] ?? 0;
            const pct   = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <span className="w-28 text-sm text-slate-600 shrink-0">{s.label}</span>
                <div className="flex-1 rounded-full bg-slate-100 h-2">
                  <div className={cn('h-2 rounded-full transition-all', s.bg === 'bg-success-50' ? 'bg-success-400' : s.bg === 'bg-danger-50' ? 'bg-danger-400' : s.bg === 'bg-amber-50' ? 'bg-amber-400' : s.bg === 'bg-purple-50' ? 'bg-purple-400' : s.bg === 'bg-blue-50' ? 'bg-blue-400' : s.bg === 'bg-orange-50' ? 'bg-orange-400' : 'bg-slate-400')} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-left text-sm font-600 text-slate-700">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* By employee */}
        <div className="card p-5">
          <h3 className="mb-4 font-600 text-slate-900 flex items-center gap-2"><BarChart3 size={16} /> أداء موظفي المبيعات</h3>
          {Object.keys(stats.byEmployee).length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد بيانات</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.byEmployee).map(([id, emp]) => (
                <div key={id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-600 text-slate-900">{emp.name}</p>
                    <p className="text-xs text-slate-500">إجمالي: {emp.total}</p>
                  </div>
                  <div className="flex gap-4 text-center">
                    <div><p className="text-xs text-slate-400">رابح</p><p className="font-700 text-success-600">{emp.won}</p></div>
                    <div><p className="text-xs text-slate-400">خاسر</p><p className="font-700 text-danger-600">{emp.lost}</p></div>
                    <div><p className="text-xs text-slate-400">تحويل</p><p className="font-700 text-brand-600">{emp.won + emp.lost > 0 ? `${Math.round((emp.won / (emp.won + emp.lost)) * 100)}%` : '—'}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By source */}
        <div className="card p-5">
          <h3 className="mb-4 font-600 text-slate-900">مصادر الليدات</h3>
          {Object.keys(stats.bySource).length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد بيانات</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.bySource).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                <div key={src} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{src}</span>
                  <span className="text-sm font-700 text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function KPI({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn('mt-2 font-display text-2xl font-700', color)}>{value}</p>
    </div>
  );
}

function F({ label, value, onChange, type = 'text', required, placeholder }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}{required && <span className="text-danger-500"> *</span>}</label>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} />
    </div>
  );
}

function DItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="rounded-lg bg-slate-100 p-2 text-slate-500">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-500 text-slate-800">{value}</p>
      </div>
    </div>
  );
}
