import { useEffect, useState } from 'react';
import { Plus, Package as PackageIcon, Pencil, Trash2, Search, CalendarDays, Repeat, Tag, FileText, StickyNote } from 'lucide-react';
import { packageService, type PackageInput } from '@/services/packageService';
import type { Package as PackageType } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatCurrency } from '@/lib/utils';
import { NumberInput } from '@/components/ui';

const emptyForm: PackageInput = {
  name: '',
  code: '',
  description: '',
  price: 0,
  visits_per_week: undefined,
  contract_duration_weeks: undefined,
  notes: '',
};

export function PackagesPage() {
  const toast = useToast();
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PackageType | null>(null);
  const [form, setForm] = useState<PackageInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<PackageType | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setPackages(await packageService.list());
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, code: `PKG-${(packages.length + 1).toString().padStart(3, '0')}` });
    setModalOpen(true);
  };

  const openEdit = (p: PackageType) => {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code,
      description: p.description ?? '',
      price: Number(p.price),
      visits_per_week: p.visits_per_week ? Number(p.visits_per_week) : undefined,
      contract_duration_weeks: p.contract_duration_weeks ?? undefined,
      notes: p.notes ?? '',
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await packageService.update(editing.id, form);
        toast.push('success', 'تم تحديث الباقة بنجاح');
      } else {
        await packageService.create(form);
        toast.push('success', 'تم إنشاء الباقة بنجاح');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    try {
      await packageService.remove(confirmTarget.id);
      toast.push('success', 'تم حذف الباقة بنجاح');
      await load();
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setConfirmTarget(null);
    }
  };

  const filtered = packages.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.code.toLowerCase().includes(query.toLowerCase()),
  );

  if (loading) return <PageLoader label="جارٍ تحميل الباقات…" />;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">الباقات</h1>
          <p className="mt-1 text-sm text-slate-500">قوالب الخدمات التي يتم استخدامها لإنشاء العقود. لا تحتوي الباقات على مواعيد الزيارات — الجدولة تتم على مستوى العميل.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} />
          إضافة باقة
        </button>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-xl">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pr-9"
          placeholder="ابحث عن باقة بالاسم أو الرمز…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<PackageIcon size={32} />}
            title="لا توجد باقات بعد"
            description="أنشئ باقة لتعريف الخدمات والأسعار وعدد الزيارات الأسبوعية ومدة العقد."
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus size={16} />
                إضافة باقة
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className="card card-hover p-5">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
                    <PackageIcon size={20} />
                  </div>
                  <div>
                    <p className="font-display font-600 text-slate-900">{p.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Tag size={12} />
                      {p.code}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded-lg bg-slate-50 p-2 text-brand-600 transition hover:bg-brand-50"
                    title="تعديل"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setConfirmTarget(p)}
                    className="rounded-lg bg-slate-50 p-2 text-slate-500 transition hover:bg-danger-50 hover:text-danger-500"
                    title="حذف"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Description */}
              {p.description && (
                <p className="mt-3 line-clamp-2 text-sm text-slate-500">{p.description}</p>
              )}

              {/* Specs grid */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="flex items-center gap-1 text-slate-500">
                    <Repeat size={12} />
                    عدد الزيارات الأسبوعية
                  </p>
                  <p className="mt-0.5 font-600 text-slate-800">
                    {p.visits_per_week ? Number(p.visits_per_week) : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="flex items-center gap-1 text-slate-500">
                    <CalendarDays size={12} />
                    مدة العقد (أسابيع)
                  </p>
                  <p className="mt-0.5 font-600 text-slate-800">
                    {p.contract_duration_weeks ?? '—'}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {p.notes && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <StickyNote size={12} />
                    ملاحظات
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{p.notes}</p>
                </div>
              )}

              {/* Price footer */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                <div>
                  <p className="text-xs text-slate-500">السعر</p>
                  <p className="font-display text-lg font-700 text-brand-600">
                    {formatCurrency(p.price)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded-lg bg-slate-50 p-2 text-brand-600 transition hover:bg-brand-50"
                    title="تعديل"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setConfirmTarget(p)}
                    className="rounded-lg bg-slate-50 p-2 text-slate-500 transition hover:bg-danger-50 hover:text-danger-500"
                    title="حذف"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'تعديل الباقة' : 'إضافة باقة جديدة'}
        subtitle="الباقة قالب خدمة فقط — لا تحتوي على مواعيد أو ساعات الزيارات."
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-ghost">
              إلغاء
            </button>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'جارٍ الحفظ…' : 'حفظ الباقة'}
            </button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-5" dir="rtl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">اسم الباقة *</label>
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: باقة التنظيف الأسبوعي"
              />
            </div>
            <div>
              <label className="label">رمز الباقة *</label>
              <input
                className="input"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="PKG-001"
              />
            </div>
          </div>

          <div>
            <label className="label">الوصف</label>
            <textarea
              className="input min-h-20"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف مختصر للخدمات المشمولة في الباقة"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberInput
              label="السعر *"
              value={form.price || undefined}
              onChange={(v) => setForm({ ...form, price: v ?? 0 })}
              min={0}
              step={0.01}
              placeholder="0.00"
              required
              prefix="₪"
            />
            <NumberInput
              label="عدد الزيارات الأسبوعية"
              value={form.visits_per_week}
              onChange={(v) => setForm({ ...form, visits_per_week: v })}
              min={0}
              step={1}
              placeholder="مثال: 3"
            />
            <NumberInput
              label="مدة العقد (أسابيع)"
              value={form.contract_duration_weeks}
              onChange={(v) => setForm({ ...form, contract_duration_weeks: v })}
              min={0}
              step={1}
              placeholder="مثال: 12"
            />
          </div>

          <div>
            <label className="label">ملاحظات</label>
            <textarea
              className="input min-h-16"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="ملاحظات إضافية حول الباقة"
            />
          </div>

          <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-slate-600">
                <FileText size={14} />
                السعر المعروض
              </span>
              <span className="font-display text-lg font-700 text-brand-600">
                {formatCurrency(Number(form.price ?? 0))}
              </span>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={confirmDelete}
        title="حذف الباقة"
        message={`هل أنت متأكد من حذف الباقة "${confirmTarget?.name ?? ''}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        danger
      />
    </div>
  );
}
