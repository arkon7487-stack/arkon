import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  UserCog,
  Search,
  Phone,
  Briefcase,
  MapPin,
  Copy,
  Check,
  Pencil,
  Archive,
  Trash2,
  X,
  Sparkles,
} from 'lucide-react';
import { employeeService, type CreateEmployeeInput } from '@/services/employeeService';
import type { Employee } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { Modal } from '@/components/Modal';
import { ConfirmDialog, NumberInput } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatDate, initials } from '@/lib/utils';
import {
  EMPLOYMENT_STATUS_LABELS,
  JOB_TITLE_ROLE_MAP,
  ROLE_LABELS,
  ROLE_KEY_TO_NAME,
} from '@/lib/locale';

type FormMode = 'create' | 'edit';

const emptyForm: CreateEmployeeInput = {
  full_name: '',
  phone_number: '',
  national_id: '',
  age: undefined,
  gender: '',
  address: '',
  service_area: '',
  employment_date: '',
  department: '',
  position: '',
  working_hours: '',
  employment_status: 'active',
  photo_url: '',
  emergency_contact: '',
  username: '',
  auth_email: '',
  password: '',
  role_key: '',
  monthly_salary: undefined,
  salary_type: 'monthly',
  salary_effective_date: '',
  salary_notes: '',
};

const ROLE_OPTIONS = Object.keys(ROLE_LABELS);

function statusTone(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-success-500/15 text-success-600 border-success-500/30';
    case 'on_leave':
      return 'bg-warning-500/15 text-warning-600 border-warning-500/30';
    case 'suspended':
      return 'bg-danger-500/15 text-danger-600 border-danger-500/30';
    case 'terminated':
      return 'bg-slate-200 text-slate-600 border-slate-300';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function statusLabel(status: string): string {
  return EMPLOYMENT_STATUS_LABELS[status] ?? status;
}

export function EmployeesPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // Create / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateEmployeeInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Created credentials banner
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Detail modal
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setEmployees(await employeeService.list());
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Suggested role derived from the typed job title (position).
  const suggestedRole = useMemo(() => {
    const title = (form.position ?? '').trim();
    if (!title) return '';
    return JOB_TITLE_ROLE_MAP[title] ?? '';
  }, [form.position]);

  const openCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setForm({ ...emptyForm, role_key: '' });
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setFormMode('edit');
    setEditingId(emp.id);
    setForm({
      full_name: emp.full_name,
      phone_number: emp.phone_number,
      national_id: emp.national_id ?? '',
      age: emp.age ?? undefined,
      gender: emp.gender ?? '',
      address: emp.address ?? '',
      service_area: emp.service_area ?? '',
      employment_date: emp.employment_date ?? '',
      department: emp.department ?? '',
      position: emp.job_title ?? '',
      working_hours: emp.working_hours ?? '',
      employment_status: emp.employment_status,
      photo_url: emp.photo_url ?? '',
      emergency_contact: emp.emergency_contact ?? '',
      username: emp.username ?? '',
      auth_email: emp.auth_email ?? '',
      password: '',
      role_key: '',
      monthly_salary: emp.monthly_salary ? Number(emp.monthly_salary) : undefined,
      salary_type: emp.salary_type ?? 'monthly',
      salary_effective_date: emp.salary_effective_date ?? '',
      salary_notes: emp.salary_notes ?? '',
    });
    setDetailEmployee(null);
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(form.position ?? '').trim()) {
      toast.push('error', 'المسمى الوظيفي مطلوب ولا يمكن أن يكون فارغاً.');
      return;
    }
    setSaving(true);
    try {
      if (formMode === 'create') {
        const payload: CreateEmployeeInput = {
          ...form,
          role_key: suggestedRole || form.role_key || undefined,
        };
        const result = await employeeService.create(payload);
        setCreated({
          email: result.auth_email ?? form.auth_email ?? '',
          password: result.temp_password ?? '',
        });
        toast.push('success', 'تم إنشاء الموظف وربطه بحساب الدخول بنجاح.');
      } else if (formMode === 'edit' && editingId) {
        await employeeService.update(editingId, form);
        toast.push('success', 'تم تحديث بيانات الموظف بنجاح.');
      }
      setModalOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const archiveEmployee = async (emp: Employee) => {
    try {
      await employeeService.update(emp.id, { employment_status: 'terminated' });
      toast.push('success', 'تمت أرشفة الموظف.');
      setDetailEmployee(null);
      await load();
    } catch (err) {
      toast.push('error', (err as Error).message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await employeeService.remove(deleteTarget.id);
      toast.push('success', 'تم حذف الموظف.');
      setDetailEmployee(null);
      await load();
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const copyCreds = () => {
    if (!created) return;
    navigator.clipboard.writeText(
      `البريد: ${created.email}\nكلمة المرور: ${created.password}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = employees.filter((e) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      e.full_name.toLowerCase().includes(q) ||
      e.phone_number.includes(q) ||
      (e.job_title ?? '').toLowerCase().includes(q) ||
      (e.department ?? '').toLowerCase().includes(q) ||
      (e.service_area ?? '').toLowerCase().includes(q)
    );
  });

  if (loading) return <PageLoader label="جارٍ تحميل الموظفين…" />;

  return (
    <div dir="rtl" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">الموظفون</h1>
          <p className="mt-1 text-sm text-slate-500">
            إنشاء موظف جديد يؤدي تلقائياً إلى إنشاء حساب دخول خاص به.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> إضافة موظف
        </button>
      </div>

      {/* Created credentials banner */}
      {created && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-brand-500/40 p-4">
          <div>
            <p className="text-sm font-600 text-slate-900">بيانات دخول الموظف</p>
            <p className="mt-1 text-xs text-slate-500">
              يرجى مشاركتها بشكل آمن. يمكن للموظف تسجيل الدخول فوراً.
            </p>
            <div className="mt-2 space-y-1 font-mono text-sm text-slate-800">
              <p>
                البريد: <span className="text-brand-600">{created.email}</span>
              </p>
              <p>
                كلمة المرور: <span className="text-brand-600">{created.password}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={copyCreds} className="btn-ghost">
              {copied ? (
                <>
                  <Check size={16} /> تم النسخ
                </>
              ) : (
                <>
                  <Copy size={16} /> نسخ
                </>
              )}
            </button>
            <button
              onClick={() => setCreated(null)}
              className="text-slate-500 hover:text-slate-700"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative w-full max-w-xl">
        <Search
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          className="input pr-9"
          placeholder="ابحث عن موظف…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<UserCog size={32} />}
            title="لا يوجد موظفون بعد"
            description="أنشئ موظفاً لتجهيز حساب دخول وإسناده إلى العقود."
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus size={16} /> إضافة موظف
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => setDetailEmployee(e)}
              className="card card-hover p-5 text-right"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-700 text-white">
                  {initials(e.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-600 text-slate-900">
                    {e.full_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {e.job_title ?? 'غير محدد'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-500 ${statusTone(
                    e.employment_status,
                  )}`}
                >
                  {statusLabel(e.employment_status)}
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                <p className="flex items-center gap-1.5">
                  <Phone size={12} /> {e.phone_number}
                </p>
                {e.service_area && (
                  <p className="flex items-center gap-1.5">
                    <MapPin size={12} /> {e.service_area}
                  </p>
                )}
                {e.department && (
                  <p className="flex items-center gap-1.5">
                    <Briefcase size={12} /> {e.department}
                  </p>
                )}
                {e.employment_date && (
                  <p className="text-slate-600">
                    يعمل منذ {formatDate(e.employment_date)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={formMode === 'create' ? 'إضافة موظف جديد' : 'تعديل بيانات الموظف'}
        subtitle={
          formMode === 'create'
            ? 'يتم إنشاء حساب مصادقة تلقائياً. يمكن للموظف تسجيل الدخول فوراً.'
            : 'تعديل بيانات الموظف الأساسية.'
        }
        size="xl"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-ghost">
              إلغاء
            </button>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving
                ? formMode === 'create'
                  ? 'جارٍ الإنشاء…'
                  : 'جارٍ الحفظ…'
                : formMode === 'create'
                  ? 'إنشاء الموظف'
                  : 'حفظ التعديلات'}
            </button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="الاسم الكامل"
              value={form.full_name}
              onChange={(v) => setForm({ ...form, full_name: v })}
              required
            />
            <Field
              label="رقم الهاتف"
              value={form.phone_number}
              onChange={(v) => setForm({ ...form, phone_number: v })}
              required
            />

            {/* Job Title — mandatory, with suggested role */}
            <div className="sm:col-span-2">
              <label className="label">
                المسمى الوظيفي<span className="text-danger-500"> *</span>
              </label>
              <input
                className="input"
                list="job-title-options"
                value={form.position ?? ''}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="اختر أو اكتب المسمى الوظيفي"
                required
              />
              <datalist id="job-title-options">
                {Object.keys(JOB_TITLE_ROLE_MAP).map((title) => (
                  <option key={title} value={title} />
                ))}
              </datalist>

              {/* Suggested role */}
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/60 p-3">
                <Sparkles size={16} className="text-brand-600" />
                <span className="text-sm font-500 text-slate-700">
                  الدور المقترح:
                </span>
                {suggestedRole ? (
                  <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-600 text-brand-700">
                    {ROLE_KEY_TO_NAME[suggestedRole] ?? suggestedRole}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">
                    لا يوجد دور مطابق — يرجى اختيار الدور يدوياً.
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">تعديل الدور:</label>
                  <select
                    className="input max-w-[180px] py-1 text-sm"
                    value={form.role_key ?? suggestedRole ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, role_key: e.target.value })
                    }
                  >
                    <option value="">— اختر دوراً —</option>
                    {ROLE_OPTIONS.map((key) => (
                      <option key={key} value={key}>
                        {ROLE_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <Field
              label="رقم الهوية"
              value={form.national_id ?? ''}
              onChange={(v) => setForm({ ...form, national_id: v })}
            />
            <NumberInput
              label="العمر"
              value={form.age}
              onChange={(v) => setForm({ ...form, age: v })}
              min={0}
              step={1}
              placeholder="مثال: 30"
            />
            <div>
              <label className="label">الجنس</label>
              <select
                className="input"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">—</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <Field
              label="منطقة الخدمة"
              value={form.service_area ?? ''}
              onChange={(v) => setForm({ ...form, service_area: v })}
            />
            <Field
              label="تاريخ التوظيف"
              type="date"
              value={form.employment_date ?? ''}
              onChange={(v) => setForm({ ...form, employment_date: v })}
            />
            <Field
              label="القسم"
              value={form.department ?? ''}
              onChange={(v) => setForm({ ...form, department: v })}
            />
            <Field
              label="ساعات العمل"
              value={form.working_hours ?? ''}
              onChange={(v) => setForm({ ...form, working_hours: v })}
              placeholder="مثال: 08:00-17:00"
            />
            <Field
              label="العنوان"
              value={form.address ?? ''}
              onChange={(v) => setForm({ ...form, address: v })}
            />

            <div>
              <label className="label">حالة التوظيف</label>
              <select
                className="input"
                value={form.employment_status ?? 'active'}
                onChange={(e) =>
                  setForm({ ...form, employment_status: e.target.value })
                }
              >
                {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Salary Information */}
          <div className="rounded-lg border border-brand-200 bg-brand-50/30 p-4">
            <p className="mb-3 text-xs font-600 uppercase tracking-wide text-brand-600">معلومات الراتب</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberInput
                label="الراتب الشهري"
                value={form.monthly_salary}
                onChange={(v) => setForm({ ...form, monthly_salary: v })}
                min={0}
                step={0.01}
                placeholder="0.00"
                prefix="₪"
              />
              <div>
                <label className="label">نوع الراتب</label>
                <select
                  className="input"
                  value={form.salary_type ?? 'monthly'}
                  onChange={(e) => setForm({ ...form, salary_type: e.target.value })}
                >
                  <option value="monthly">شهري</option>
                  <option value="weekly">أسبوعي</option>
                  <option value="daily">يومي</option>
                </select>
              </div>
              <Field
                label="تاريخ سريان الراتب"
                type="date"
                value={form.salary_effective_date ?? ''}
                onChange={(v) => setForm({ ...form, salary_effective_date: v })}
              />
              <Field
                label="ملاحظات الراتب"
                value={form.salary_notes ?? ''}
                onChange={(v) => setForm({ ...form, salary_notes: v })}
              />
            </div>
          </div>

          {/* Login credentials */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-600 uppercase tracking-wide text-slate-500">
              بيانات الدخول (تُولّد تلقائياً إذا تُركت فارغة)
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field
                label="اسم المستخدم"
                value={form.username ?? ''}
                onChange={(v) => setForm({ ...form, username: v })}
              />
              <Field
                label="البريد الإلكتروني"
                type="email"
                value={form.auth_email ?? ''}
                onChange={(v) => setForm({ ...form, auth_email: v })}
                placeholder="تلقائي"
              />
              <Field
                label="كلمة المرور"
                value={form.password ?? ''}
                onChange={(v) => setForm({ ...form, password: v })}
                placeholder="تلقائي"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={!!detailEmployee}
        onClose={() => setDetailEmployee(null)}
        title="تفاصيل الموظف"
        size="lg"
        footer={
          detailEmployee && (
            <div className="flex w-full flex-wrap justify-end gap-2">
              <button
                onClick={() => openEdit(detailEmployee)}
                className="btn-ghost"
              >
                <Pencil size={16} /> تعديل
              </button>
              <button
                onClick={() => archiveEmployee(detailEmployee)}
                className="btn-ghost"
              >
                <Archive size={16} /> أرشفة
              </button>
              <button
                onClick={() => setDeleteTarget(detailEmployee)}
                className="btn-danger"
              >
                <Trash2 size={16} /> حذف
              </button>
              <button
                onClick={() => setDetailEmployee(null)}
                className="btn-ghost"
              >
                <X size={16} /> إغلاق
              </button>
            </div>
          )
        }
      >
        {detailEmployee && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-base font-700 text-white">
                {initials(detailEmployee.full_name)}
              </span>
              <div className="flex-1">
                <h3 className="font-display text-lg font-700 text-slate-900">
                  {detailEmployee.full_name}
                </h3>
                <p className="text-sm text-slate-500">
                  {detailEmployee.job_title ?? 'غير محدد'}
                </p>
                <span
                  className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-500 ${statusTone(
                    detailEmployee.employment_status,
                  )}`}
                >
                  {statusLabel(detailEmployee.employment_status)}
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem
                icon={<Phone size={14} />}
                label="رقم الهاتف"
                value={detailEmployee.phone_number}
              />
              <DetailItem
                icon={<Briefcase size={14} />}
                label="المسمى الوظيفي"
                value={detailEmployee.job_title ?? '—'}
              />
              <DetailItem
                icon={<MapPin size={14} />}
                label="منطقة الخدمة"
                value={detailEmployee.service_area ?? '—'}
              />
              <DetailItem
                icon={<Briefcase size={14} />}
                label="القسم"
                value={detailEmployee.department ?? '—'}
              />
              <DetailItem
                icon={<UserCog size={14} />}
                label="رقم الهوية"
                value={detailEmployee.national_id ?? '—'}
              />
              <DetailItem
                icon={<UserCog size={14} />}
                label="العمر"
                value={
                  detailEmployee.age != null
                    ? String(detailEmployee.age)
                    : '—'
                }
              />
              <DetailItem
                icon={<UserCog size={14} />}
                label="الجنس"
                value={
                  detailEmployee.gender === 'male'
                    ? 'ذكر'
                    : detailEmployee.gender === 'female'
                      ? 'أنثى'
                      : detailEmployee.gender === 'other'
                        ? 'أخرى'
                        : '—'
                }
              />
              <DetailItem
                icon={<UserCog size={14} />}
                label="ساعات العمل"
                value={detailEmployee.working_hours ?? '—'}
              />
              <DetailItem
                icon={<MapPin size={14} />}
                label="العنوان"
                value={detailEmployee.address ?? '—'}
              />
              <DetailItem
                icon={<UserCog size={14} />}
                label="تاريخ التوظيف"
                value={
                  detailEmployee.employment_date
                    ? formatDate(detailEmployee.employment_date)
                    : '—'
                }
              />
              <DetailItem
                icon={<UserCog size={14} />}
                label="الراتب"
                value={
                  detailEmployee.monthly_salary
                    ? `${Number(detailEmployee.monthly_salary).toLocaleString('en-US')} ₪ / ${
                        detailEmployee.salary_type === 'weekly' ? 'أسبوعي' :
                        detailEmployee.salary_type === 'daily' ? 'يومي' : 'شهري'
                      }`
                    : '—'
                }
              />
            </dl>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف الموظف "${deleteTarget?.full_name ?? ''}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel={deleting ? 'جارٍ الحذف…' : 'حذف'}
        cancelLabel="إلغاء"
        danger
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-danger-500"> *</span>}
      </label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
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
