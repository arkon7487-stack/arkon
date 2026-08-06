import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, Phone, Mail, MapPin, FileText, Calendar, Paperclip,
  Receipt, Activity, User, Package as PackageIcon, QrCode, Printer,
  CheckCircle2, Clock, XCircle, CalendarClock, UserCheck, ClipboardList,
  Siren, AlertCircle, Trash2, Lock, KeyRound,
} from 'lucide-react';
import { clientService } from '@/services/clientService';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { StatusBadge } from '@/components/Badge';
import { ArkonLogo } from '@/components/ArkonLogo';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ui';
import { formatCurrency, formatDate, formatDateTime, initials, cn } from '@/lib/utils';
import {
  VISIT_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  CLIENT_STATUS_LABELS,
} from '@/lib/locale';

interface ProfileData {
  client: any;
  contracts: any[];
  visits: any[];
  attachments: any[];
  invoices: any[];
  activity: any[];
  qrCode: any;
}

export function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pinActionLoading, setPinActionLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const result = await clientService.getProfile(id);
        setData(result as ProfileData);
      } catch (err) {
        toast.push('error', 'تعذر تحميل ملف العميل');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const { client, contracts, visits, invoices, activity, qrCode } = data ?? {
    client: null, contracts: [], visits: [], invoices: [], activity: [], qrCode: null,
  };

  const activeContract = useMemo(
    () => contracts.find((c) => c.status === 'active') ?? contracts[0],
    [contracts],
  );
  const assignedEmployee = activeContract?.employee ?? null;
  const currentPackage = activeContract?.package ?? null;

  const visitStats = useMemo(() => {
    const total = visits.length;
    const completed = visits.filter((v) => v.status === 'completed').length;
    const scheduled = visits.filter((v) => v.status === 'scheduled' || v.status === 'pending').length;
    const cancelled = visits.filter((v) => v.status === 'cancelled').length;
    return { total, completed, scheduled, cancelled };
  }, [visits]);

  const paymentStatus = useMemo(() => {
    if (invoices.length === 0) return { label: 'لا توجد فواتير', tone: 'neutral' as const };
    const paid = invoices.filter((i) => i.status === 'paid').length;
    const unpaid = invoices.filter((i) => i.status === 'unpaid' || i.status === 'partial' || i.status === 'overdue').length;
    if (unpaid === 0) return { label: 'مدفوع بالكامل', tone: 'success' as const };
    if (paid > 0) return { label: 'مدفوع جزئياً', tone: 'warning' as const };
    return { label: 'غير مدفوع', tone: 'danger' as const };
  }, [invoices]);

  const handlePinAction = async (action: 'admin_generate_activation' | 'admin_reset_pin') => {
    if (!id) return;
    setPinActionLoading(true);
    setGeneratedCode(null);
    try {
      const AUTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arkon-client-auth`;
      const resp = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ action, client_id: id }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'فشل العملية');
      setGeneratedCode(data.activation_code);
      toast.push('success', action === 'admin_reset_pin' ? 'تم إعادة تعيين رمز PIN وإنشاء رمز تفعيل جديد' : 'تم إنشاء رمز التفعيل');
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally { setPinActionLoading(false); }
  };

  if (loading) return <PageLoader label="جارٍ تحميل ملف العميل…" />;;
  if (!data || !data.client) return <EmptyState icon={<User size={32} />} title="العميل غير موجود" />;

  const handlePrintQR = () => {
    if (!qrCode) return;
    const codeValue = qrCode.code_value ?? '';
    const clientName = client.full_name ?? '';
    const clientId = client.id ?? '';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(codeValue)}`;

    const printWin = window.open('', '_blank', 'width=600,height=700');
    if (!printWin) {
      toast.push('error', 'تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.');
      return;
    }

    printWin.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>رمز QR - ${clientName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff; color: #0f172a; padding: 40px; text-align: center; }
  .logo { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; margin: 0 auto 16px; display: block; }
  .brand { font-size: 28px; font-weight: 700; letter-spacing: 2px; color: #0f172a; margin-bottom: 4px; }
  .tagline { font-size: 12px; color: #4f46e5; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 32px; }
  .card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 32px; max-width: 420px; margin: 0 auto; }
  .client-name { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
  .client-id { font-size: 14px; color: #64748b; font-family: monospace; margin-bottom: 24px; }
  .qr { width: 300px; height: 300px; margin: 0 auto 16px; display: block; }
  .code-value { font-family: monospace; font-size: 16px; color: #334155; background: #f1f5f9; border-radius: 8px; padding: 8px 16px; display: inline-block; margin-top: 8px; }
  .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; }
  @media print {
    body { padding: 20px; }
    .card { border: none; }
  }
</style>
</head>
<body>
  <img class="logo" src="/756132783_2274483666620765_5282871515405515489_n.jpg" alt="ARKON" onerror="this.style.display='none'" />
  <div class="brand">ARKON</div>
  <div class="tagline">Facility Management</div>
  <div class="card">
    <div class="client-name">${clientName}</div>
    <div class="client-id">رقم العميل: ${clientId}</div>
    <img class="qr" src="${qrUrl}" alt="QR Code" />
    <div class="code-value">${codeValue}</div>
  </div>
  <div class="footer">تم الإنشاء بواسطة نظام ARKON — ${new Date().toLocaleDateString('ar-EG')}</div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`);
    printWin.document.close();
  };

  return (
    <div dir="rtl" className="space-y-6 animate-fade-in">
      {/* Back link + actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/clients')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600"
        >
          <ArrowRight size={16} /> العودة إلى العملاء
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-danger-50 px-3 py-1.5 text-sm font-600 text-danger-600 transition hover:bg-danger-100"
        >
          <Trash2 size={16} /> حذف العميل
        </button>
      </div>

      {/* Profile header */}
      <div className="card overflow-hidden">
        <div className="relative h-24 bg-gradient-to-l from-slate-50 via-white to-brand-900/40">
          <div className="absolute left-4 top-4 opacity-30"><ArkonLogo size={40} /></div>
        </div>
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-700 text-white shadow-glow">
              {initials(client.full_name)}
            </span>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-700 text-slate-900">{client.full_name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Phone size={14} /> {client.phone_number}</span>
                {client.email && <span className="flex items-center gap-1.5"><Mail size={14} /> {client.email}</span>}
                {client.service_area && <span className="flex items-center gap-1.5"><MapPin size={14} /> {client.service_area}</span>}
                <StatusBadge status={client.status} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Customer Information */}
      <Section title="معلومات العميل" icon={<User size={16} />}>
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="الاسم الكامل" value={client.full_name ?? '—'} />
          <Row label="رقم الهاتف" value={client.phone_number ?? '—'} />
          <Row label="البريد الإلكتروني" value={client.email ?? '—'} />
          <Row label="العنوان" value={client.address ?? '—'} />
          <Row label="منطقة الخدمة" value={client.service_area ?? '—'} />
          <Row label="الحالة" value={CLIENT_STATUS_LABELS[client.status] ?? client.status ?? '—'} />
          <div className="sm:col-span-2">
            <Row label="ملاحظات" value={client.notes ?? '—'} />
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 2. Current Package */}
        <Section title="الباقة الحالية" icon={<PackageIcon size={16} />}>
          {currentPackage ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-700 text-slate-900">{currentPackage.name}</span>
                <StatusBadge status={activeContract?.status ?? 'neutral'} />
              </div>
              {currentPackage.description && (
                <p className="text-sm text-slate-500">{currentPackage.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Row label="عدد الزيارات" value={String(currentPackage.visits_per_week ?? currentPackage.total_visits ?? '—')} />
                <Row label="المدة" value={currentPackage.duration_weeks ? `${currentPackage.duration_weeks} أسبوع` : currentPackage.duration_months ? `${currentPackage.duration_months} شهر` : '—'} />
                <Row label="السعر الأساسي" value={formatCurrency(currentPackage.base_price)} />
                <Row label="السعر النهائي للعقد" value={formatCurrency(activeContract?.final_amount)} />
              </div>
            </div>
          ) : (
            <EmptyState icon={<PackageIcon size={24} />} title="لا توجد باقة حالية" />
          )}
        </Section>

        {/* 3. Active Contract */}
        <Section title="العقد النشط" icon={<FileText size={16} />}>
          {activeContract ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Link to={`/contracts/${activeContract.id}`} className="font-display text-lg font-700 text-brand-600 hover:text-brand-700">
                  {activeContract.contract_number}
                </Link>
                <StatusBadge status={activeContract.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Row label="تاريخ البداية" value={formatDate(activeContract.start_date)} />
                <Row label="تاريخ النهاية" value={formatDate(activeContract.end_date)} />
                <Row label="الحالة" value={CONTRACT_STATUS_LABELS[activeContract.status] ?? activeContract.status ?? '—'} />
                <Row label="القيمة" value={formatCurrency(activeContract.final_amount)} />
              </div>
              <Link
                to={`/contracts/${activeContract.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-600 text-brand-600 hover:text-brand-700"
              >
                <FileText size={12} /> عرض تفاصيل العقد
              </Link>
            </div>
          ) : (
            <EmptyState icon={<FileText size={24} />} title="لا يوجد عقد نشط" />
          )}
        </Section>
      </div>

      {/* 4. Assigned Employee */}
      <Section title="الموظف المسؤول" icon={<UserCheck size={16} />}>
        {assignedEmployee ? (
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-sm font-700 text-brand-500">
              {initials(assignedEmployee.full_name)}
            </span>
            <div className="space-y-1">
              <p className="font-600 text-slate-900">{assignedEmployee.full_name}</p>
              <p className="text-xs text-slate-500">{assignedEmployee.position ?? assignedEmployee.job_title ?? 'عامل ميداني'}</p>
              {assignedEmployee.phone_number && (
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Phone size={12} /> {assignedEmployee.phone_number}
                </p>
              )}
            </div>
          </div>
        ) : (
          <EmptyState icon={<UserCheck size={24} />} title="لا يوجد موظف مسؤول" />
        )}
      </Section>

      {/* 5. Customer QR Code */}
      {qrCode && (
        <Section title="رمز QR" icon={<QrCode size={16} />}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-lg bg-white p-2 shadow-card">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrCode.code_value ?? '')}`}
                alt="QR Code"
                width={120}
                height={120}
              />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-mono text-sm font-600 text-slate-800">{qrCode.code_value}</p>
              <p className="text-xs text-slate-500">تاريخ الإنشاء: {formatDate(qrCode.created_at)}</p>
              <button
                onClick={handlePrintQR}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-600 text-white shadow-glow transition hover:bg-brand-600"
              >
                <Printer size={14} /> طباعة
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* PIN Management */}
      <Section title="إدارة رمز PIN" icon={<Lock size={16} />}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">قم بإنشاء رمز تفعيل مؤقت للعميل الجديد، أو إعادة تعيين رمز PIN لعميل موجود. يسري رمز التفعيل لمدة 24 ساعة.</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handlePinAction('admin_generate_activation')}
              disabled={pinActionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm font-600 text-brand-700 transition hover:bg-brand-100"
            >
              <KeyRound size={14} /> إنشاء رمز تفعيل
            </button>
            <button
              onClick={() => handlePinAction('admin_reset_pin')}
              disabled={pinActionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-danger-50 px-3 py-2 text-sm font-600 text-danger-600 transition hover:bg-danger-100"
            >
              <Lock size={14} /> إعادة تعيين PIN
            </button>
          </div>
          {generatedCode && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
              <p className="text-sm font-600 text-brand-700">رمز التفعيل المؤقت:</p>
              <p className="mt-1 font-mono text-2xl font-700 tracking-widest text-brand-800" dir="ltr">{generatedCode}</p>
              <p className="mt-2 text-xs text-slate-500">يصبح هذا الرمز غير صالح بعد استخدامه أو بعد 24 ساعة. وفرّه للعميل بشكل آمن.</p>
            </div>
          )}
        </div>
      </Section>

      {/* 6. Visit Statistics */}
      <Section title="إحصائيات الزيارات" icon={<CalendarClock size={16} />}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="إجمالي الزيارات" value={visitStats.total} icon={<Calendar size={18} />} tone="brand" />
          <StatCard label="مكتملة" value={visitStats.completed} icon={<CheckCircle2 size={18} />} tone="success" />
          <StatCard label="مجدولة" value={visitStats.scheduled} icon={<Clock size={18} />} tone="warning" />
          <StatCard label="ملغاة" value={visitStats.cancelled} icon={<XCircle size={18} />} tone="danger" />
        </div>
      </Section>

      {/* 7. Payment Status */}
      <Section title="حالة الدفع" icon={<Receipt size={16} />}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-600',
              paymentStatus.tone === 'success' && 'border-success-500/30 bg-success-500/15 text-success-500',
              paymentStatus.tone === 'warning' && 'border-warning-500/30 bg-warning-500/15 text-warning-400',
              paymentStatus.tone === 'danger' && 'border-danger-500/30 bg-danger-500/15 text-danger-400',
              paymentStatus.tone === 'neutral' && 'border-slate-200 bg-slate-100 text-slate-600',
            )}>
              {paymentStatus.label}
            </span>
            <span className="text-sm text-slate-500">
              {invoices.length} فاتورة · إجمالي {formatCurrency(invoices.reduce((s, i) => s + Number(i.total ?? 0), 0))}
            </span>
          </div>
        </div>
      </Section>

      {/* 8. Customer Timeline */}
      <Section title="الجدول الزمني" icon={<Activity size={16} />}>
        {activity.length === 0 ? (
          <EmptyState icon={<Activity size={24} />} title="لا يوجد نشاط حتى الآن" />
        ) : (
          <ol className="relative space-y-4 border-r border-slate-200/80 pr-6">
            {activity.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -right-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                <p className="text-sm text-slate-800">{a.message}</p>
                <p className="text-xs text-slate-500">{formatDateTime(a.created_at)}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* 9. Invoices */}
      <Section title="الفواتير" icon={<Receipt size={16} />}>
        {invoices.length === 0 ? (
          <EmptyState icon={<Receipt size={24} />} title="لا توجد فواتير" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 text-right text-xs uppercase text-slate-500">
                  <th className="px-4 py-3 font-600">رقم الفاتورة</th>
                  <th className="px-4 py-3 font-600">تاريخ الإصدار</th>
                  <th className="px-4 py-3 font-600">الإجمالي</th>
                  <th className="px-4 py-3 font-600">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-200 table-row-hover">
                    <td className="px-4 py-3 font-600 text-slate-800">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(inv.issue_date)}</td>
                    <td className="px-4 py-3 font-600 text-slate-800">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-600',
                        inv.status === 'paid' && 'border-success-500/30 bg-success-500/15 text-success-500',
                        inv.status === 'unpaid' && 'border-warning-500/30 bg-warning-500/15 text-warning-400',
                        inv.status === 'partial' && 'border-brand-200 bg-brand-50 text-brand-600',
                        inv.status === 'overdue' && 'border-danger-500/30 bg-danger-500/15 text-danger-400',
                      )}>
                        {PAYMENT_STATUS_LABELS[inv.status] ?? inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 10. Service Requests & Emergency Requests (placeholders) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="طلبات الخدمة" icon={<ClipboardList size={16} />}>
          <EmptyState
            icon={<ClipboardList size={24} />}
            title="لا توجد طلبات خدمة"
            description="ستظهر طلبات الخدمة الخاصة بهذا العميل هنا"
          />
        </Section>

        <Section title="الطلبات الطارئة" icon={<Siren size={16} />}>
          <EmptyState
            icon={<Siren size={24} />}
            title="لا توجد طلبات طارئة"
            description="ستظهر الطلبات الطارئة الخاصة بهذا العميل هنا"
          />
        </Section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await clientService.remove(id!);
            toast.push('success', 'تم حذف العميل. الفواتير والمدفوعات محفوظة كأرشيف.');
            navigate('/clients');
          } catch (err) {
            toast.push('error', (err as Error).message);
          } finally {
            setDeleting(false);
            setConfirmOpen(false);
          }
        }}
        title="حذف العميل"
        message="هل أنت متأكد من حذف هذا العميل نهائياً؟ سيتم حذف العقود والزيارات ورمز QR. الفواتير والمدفوعات ستبقى محفوظة كأرشيف للحفاظ على السلامة المالية. لا يمكن التراجع عن هذا الإجراء."
        confirmLabel={deleting ? 'جارٍ الحذف…' : 'حذف العميل'}
        danger
      />
    </div>
  );
}

/* ---------- Helper components ---------- */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-brand-600">{icon}</span>
        <h2 className="font-display text-sm font-700 text-slate-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-left text-slate-800">{value}</dd>
    </div>
  );
}

const toneClasses: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600 border-brand-200',
  success: 'bg-success-500/15 text-success-500 border-success-500/30',
  warning: 'bg-warning-500/15 text-warning-400 border-warning-500/30',
  danger: 'bg-danger-500/15 text-danger-400 border-danger-500/30',
};

function StatCard({
  label, value, icon, tone,
}: { label: string; value: number; icon: React.ReactNode; tone: 'brand' | 'success' | 'warning' | 'danger' }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border p-4', toneClasses[tone])}>
      <span className="shrink-0">{icon}</span>
      <div>
        <p className="font-display text-xl font-700 text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
