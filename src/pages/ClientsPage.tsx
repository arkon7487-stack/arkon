import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Search, Phone, MapPin, Trash2 } from 'lucide-react';
import { clientService, type ClientInput } from '@/services/clientService';
import type { Client } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { Modal } from '@/components/Modal';
import { StatusBadge } from '@/components/Badge';
import { ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatDate, initials } from '@/lib/utils';

const emptyForm: ClientInput = {
  full_name: '', phone_number: '', email: '', address: '', service_area: '',
  date_of_birth: '', gender: '', notes: '', status: 'active',
};

export function ClientsPage() {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ClientInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setClients(await clientService.list());
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await clientService.create(form);
      toast.push('success', 'تم إنشاء العميل. يمكنه الآن تسجيل الدخول باستخدام رقم هاتفه.');
      setModalOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = clients.filter((c) =>
    c.full_name.toLowerCase().includes(query.toLowerCase()) ||
    c.phone_number.includes(query) ||
    (c.service_area ?? '').toLowerCase().includes(query.toLowerCase()),
  );

  if (loading) return <PageLoader label="جاري تحميل العملاء…" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">العملاء</h1>
          <p className="mt-1 text-sm text-slate-9000">العملاء المسجلون. فقط أرقام الهواتف هذه يمكنها تسجيل الدخول إلى بوابة العميل.</p>
        </div>
        <Link to="/clients/new" className="btn-primary"><Plus size={16} /> عميل جديد</Link>
      </div>

      <div className="relative w-full max-w-xl">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-9000" />
        <input className="input pl-9" placeholder="بحث بالاسم أو الهاتف أو المنطقة…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Users size={32} />} title="لا يوجد عملاء بعد" description="أنشئ عميلاً لتمكين تسجيل الدخول عبر الهاتف." action={<Link to="/clients/new" className="btn-primary"><Plus size={16} /> إنشاء عميل</Link>} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} className="card card-hover p-5">
              <Link to={`/clients/${c.id}`} className="block">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-700 text-white">
                    {initials(c.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-600 text-slate-900">{c.full_name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-9000"><Phone size={12} /> {c.phone_number}</p>
                    {c.service_area && <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-9000"><MapPin size={12} /> {c.service_area}</p>}
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-3 text-[11px] text-slate-600">أضيف في {formatDate(c.created_at)}</p>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); setConfirmTarget(c); }}
                className="mt-3 inline-flex items-center gap-1 rounded-lg bg-danger-50 px-2.5 py-1 text-xs font-600 text-danger-600 transition hover:bg-danger-100"
              >
                <Trash2 size={12} /> حذف
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="عميل جديد"
        subtitle="يسجل العملاء الدخول برقم الهاتف عبر OTP — بدون الحاجة لكلمة مرور."
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-ghost">إلغاء</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'جاري الحفظ…' : 'إنشاء عميل'}</button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">الاسم الكامل *</label>
              <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="label">رقم الهاتف *</label>
              <input className="input" required type="tel" placeholder="+972 59 000 0000" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            </div>
            <div>
              <label className="label">البريد الإلكتروني</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">منطقة الخدمة</label>
              <input className="input" value={form.service_area} onChange={(e) => setForm({ ...form, service_area: e.target.value })} />
            </div>
            <div>
              <label className="label">تاريخ الميلاد</label>
              <input className="input" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div>
              <label className="label">الجنس</label>
              <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
                <option value="other">آخر</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">العنوان</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <textarea className="input min-h-16" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={async () => {
          if (!confirmTarget) return;
          setDeleting(true);
          try {
            await clientService.remove(confirmTarget.id);
            toast.push('success', 'تم حذف العميل. الفواتير والمدفوعات محفوظة كأرشيف.');
            await load();
          } catch (err) {
            toast.push('error', (err as Error).message);
          } finally {
            setDeleting(false);
            setConfirmTarget(null);
          }
        }}
        title="حذف العميل"
        message={`هل أنت متأكد من حذف "${confirmTarget?.full_name ?? ''}" نهائياً؟ سيتم حذف العقود والزيارات ورمز QR. الفواتير والمدفوعات ستبقى محفوظة كأرشيف للحفاظ على السلامة المالية. لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel={deleting ? 'جارٍ الحذف…' : 'حذف العميل'}
        danger
      />
    </div>
  );
}
