import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Home, ClipboardCheck, CreditCard, Heart, UserCircle,
  LogOut, Phone, MapPin, Clock, Package, Send, FileText,
  Star, CheckCircle2, Wallet, Lock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ArkonLogo } from '@/components/ArkonLogo';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { visitService } from '@/services/visitService';
import { clientService } from '@/services/clientService';
import { serviceRequestService } from '@/services/serviceRequestService';
import { ratingService } from '@/services/ratingService';
import { supabase } from '@/lib/supabase';
import { PageLoader, EmptyState, Spinner } from '@/components/Feedback';
import { formatDate, formatTime, formatCurrency, cn } from '@/lib/utils';
import { VISIT_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/locale';
import type { VisitWithRelations, Client, ServiceRequest, VisitRating } from '@/types';

const ARKON_COMPANY_ID = '11111111-1111-1111-1111-111111111111';

/* ===== Helpers ===== */

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed': return 'bg-success-50 text-success-700';
    case 'started': return 'bg-warning-50 text-warning-700';
    case 'cancelled': return 'bg-danger-50 text-danger-700';
    default: return 'bg-brand-50 text-brand-700';
  }
}

function payBadgeClass(status: string): string {
  switch (status) {
    case 'paid': return 'bg-success-50 text-success-700';
    case 'partially_paid': case 'partial': return 'bg-warning-50 text-warning-700';
    case 'overdue': return 'bg-danger-50 text-danger-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function contractStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'نشط',
    expired: 'منتهي',
    pending: 'قيد الانتظار',
    cancelled: 'ملغي',
    draft: 'مسودة',
    quotation: 'عرض سعر',
  };
  return labels[status] ?? status;
}

/* ===== ClientApp Layout ===== */

export function ClientApp() {
  const { session } = useAuth();
  const clientName = session?.client?.full_name ?? 'العميل';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50" dir="rtl">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/60 bg-white/95 px-4 backdrop-blur">
        <ArkonLogo size={28} withWordmark variant="compact" />
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1 text-[11px] font-600 text-slate-400 transition hover:text-brand-600">
            <Home size={14} />
            الرئيسية
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-600 text-brand-700">
            {clientName.charAt(0)}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 pb-20">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-slate-200/60 bg-white/95 px-1 py-2 backdrop-blur">
        <NavLink to="/client" end className={({ isActive }) => cn('flex flex-col items-center gap-0.5 px-2 py-1.5 text-[11px] font-500 transition', isActive ? 'text-brand-700' : 'text-slate-400')}>
          <Home size={20} /> الرئيسية
        </NavLink>
        <NavLink to="/client/visits" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 px-2 py-1.5 text-[11px] font-500 transition', isActive ? 'text-brand-700' : 'text-slate-400')}>
          <ClipboardCheck size={20} /> الزيارات
        </NavLink>
        <NavLink to="/client/invoices" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 px-2 py-1.5 text-[11px] font-500 transition', isActive ? 'text-brand-700' : 'text-slate-400')}>
          <CreditCard size={20} /> الفواتير
        </NavLink>
        <NavLink to="/client/support" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 px-2 py-1.5 text-[11px] font-500 transition', isActive ? 'text-brand-700' : 'text-slate-400')}>
          <Heart size={20} /> الدعم
        </NavLink>
        <NavLink to="/client/profile" className={({ isActive }) => cn('flex flex-col items-center gap-0.5 px-2 py-1.5 text-[11px] font-500 transition', isActive ? 'text-brand-700' : 'text-slate-400')}>
          <UserCircle size={20} /> الملف
        </NavLink>
      </nav>
    </div>
  );
}

/* ===== Client Home ===== */

export function ClientHome() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);

  const clientId = session?.userId;
  const client = session?.client as Client | null;
  const clientName = client?.full_name ?? 'العميل';

  const loadData = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    try {
      const [v, inv, contracts] = await Promise.all([
        visitService.getByClient(clientId),
        supabase.from('invoices').select('status, contract:contracts!inner(client_id)').eq('contract.client_id', clientId).neq('status', 'paid'),
        supabase.from('contracts').select('*, package:packages(name)').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setVisits(v);
      setUnpaidCount(inv.data?.length ?? 0);
      setContract(contracts.data);
    } catch { /* */ } finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime: refresh when visits, contracts, or invoices change
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase.channel('client-home-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, loadData]);

  if (loading) return <PageLoader label="جاري التحميل..." />;

  const upcoming = visits.filter((v) => v.status === 'scheduled' || v.status === 'started').slice(0, 3);
  const completedVisits = visits.filter((v) => v.status === 'completed');
  const remainingVisits = visits.filter((v) => v.status === 'scheduled').length;
  const packageName = contract?.package?.name ?? null;

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <div>
        <h1 className="font-display text-xl font-700 text-slate-900">مرحباً، {clientName}</h1>
        <p className="text-sm text-slate-500">حسابك في ARKON</p>
      </div>

      {packageName && (
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
            <Package size={20} className="text-brand-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-400">الباقة الحالية</p>
            <p className="font-600 text-slate-900">{packageName}</p>
          </div>
          {contract && (
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-600', contract.status === 'active' ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-600')}>
              {contractStatusLabel(contract.status)}
            </span>
          )}
        </div>
      )}

      {contract && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileText size={18} className="text-brand-600" />
            <h2 className="text-sm font-600 text-slate-700">تفاصيل العقد</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">رقم العقد</span>
              <span className="font-600 text-slate-900">{contract.contract_number ?? contract.id.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">القيمة النهائية</span>
              <span className="font-600 text-slate-900">{formatCurrency(contract.final_amount ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">المبلغ المدفوع</span>
              <span className="font-600 text-success-600">{formatCurrency(contract.amount_paid ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">المبلغ المتبقي</span>
              <span className="font-600 text-warning-600">{formatCurrency(contract.remaining_balance ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">حالة الدفع</span>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-600', payBadgeClass(contract.payment_status))}>
                {PAYMENT_STATUS_LABELS[contract.payment_status] ?? contract.payment_status ?? '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => navigate('/client/visits')} className="card p-4 text-right transition hover:shadow-glow">
          <ClipboardCheck size={20} className="text-brand-600" />
          <p className="mt-2 text-2xl font-700 text-slate-900">{upcoming.length}</p>
          <p className="text-xs text-slate-500">زيارات قادمة</p>
        </button>
        <button onClick={() => navigate('/client/invoices')} className="card p-4 text-right transition hover:shadow-glow">
          <CreditCard size={20} className="text-warning-600" />
          <p className="mt-2 text-2xl font-700 text-slate-900">{unpaidCount}</p>
          <p className="text-xs text-slate-500">فواتير غير مدفوعة</p>
        </button>
      </div>

      {contract && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-700 text-slate-900">{remainingVisits}</p>
            <p className="text-xs text-slate-500">زيارات متبقية</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-700 text-slate-900">{completedVisits.length}</p>
            <p className="text-xs text-slate-500">زيارات مكتملة</p>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-600 text-slate-700">الزيارات القادمة</h2>
        {upcoming.length === 0 ? (
          <EmptyState icon={<ClipboardCheck size={28} className="text-slate-300" />} title="لا زيارات قادمة" />
        ) : (
          <div className="space-y-2">
            {upcoming.map((v) => (
              <div key={v.id} className="card flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                  <Clock size={18} className="text-brand-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-600 text-slate-900">{formatDate(v.scheduled_date)}</p>
                  <p className="text-xs text-slate-500">{v.scheduled_start_time ? formatTime(v.scheduled_start_time) : ''} • {v.employee?.full_name ?? 'غير معين'}</p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-600', statusBadgeClass(v.status))}>
                  {VISIT_STATUS_LABELS[v.status] ?? v.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => setShowRequest(true)} className="btn-primary w-full">
        طلب خدمة جديدة
      </button>

      {showRequest && <ServiceRequestModal clientId={clientId!} contractId={contract?.id ?? null} onClose={() => setShowRequest(false)} />}
    </div>
  );
}

/* ===== Service Request Modal ===== */

function ServiceRequestModal({ clientId, contractId, onClose }: { clientId: string; contractId: string | null; onClose: () => void }) {
  const { add } = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await serviceRequestService.create({
        companyId: ARKON_COMPANY_ID,
        clientId,
        contractId,
        subject: subject.trim(),
        message: message.trim(),
      });
      add('تم إرسال طلب الدعم بنجاح', 'success');
      onClose();
    } catch {
      add('فشل إرسال الطلب', 'error');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center" dir="rtl">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-700 text-slate-900">طلب خدمة جديدة</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">الموضوع</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع الطلب" required />
          </div>
          <div>
            <label className="label">الرسالة</label>
            <textarea className="input min-h-[100px]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="اكتب رسالتك هنا..." required />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? <Spinner /> : <><Send size={16} /> إرسال</>}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ===== Client Visits ===== */

export function ClientVisits() {
  const { session } = useAuth();
  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingVisit, setRatingVisit] = useState<VisitWithRelations | null>(null);
  const clientId = session?.userId;

  const loadVisits = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    try { setVisits(await visitService.getByClient(clientId)); }
    catch { /* */ } finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  // Realtime: refresh when visits change
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase.channel('client-visits-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => loadVisits())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, loadVisits]);

  if (loading) return <PageLoader label="جاري التحميل..." />;

  const upcoming = visits.filter((v) => v.status === 'scheduled' || v.status === 'started');
  const history = visits.filter((v) => v.status === 'completed' || v.status === 'cancelled');

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <h1 className="font-display text-xl font-700 text-slate-900">زياراتي</h1>

      {upcoming.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-600 text-slate-700">الزيارات القادمة</h2>
          <div className="space-y-2">
            {upcoming.map((v) => (
              <div key={v.id} className="card flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                  <Clock size={18} className="text-brand-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-600 text-slate-900">{formatDate(v.scheduled_date)}</p>
                  <p className="text-xs text-slate-500">{v.scheduled_start_time ? formatTime(v.scheduled_start_time) : ''} • {v.employee?.full_name ?? 'غير معين'}</p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-600', statusBadgeClass(v.status))}>
                  {VISIT_STATUS_LABELS[v.status] ?? v.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-600 text-slate-700">سجل الزيارات</h2>
        {history.length === 0 ? (
          <EmptyState icon={<ClipboardCheck size={28} className="text-slate-300" />} title="لا يوجد سجل" />
        ) : (
          <div className="space-y-2">
            {history.map((v) => (
              <div key={v.id} className="card p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                    {v.status === 'completed' ? <CheckCircle2 size={18} className="text-success-600" /> : <ClipboardCheck size={18} className="text-slate-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-600 text-slate-900">{formatDate(v.scheduled_date)}</p>
                    <p className="text-xs text-slate-500">{v.employee?.full_name ?? 'غير معين'}</p>
                  </div>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-600', statusBadgeClass(v.status))}>
                    {VISIT_STATUS_LABELS[v.status] ?? v.status}
                  </span>
                </div>
                {v.status === 'completed' && (
                  <button onClick={() => setRatingVisit(v)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-50 py-2 text-xs font-600 text-brand-600 transition hover:bg-brand-100">
                    <Star size={14} /> تقييم الزيارة
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {ratingVisit && (
        <RatingModal
          visit={ratingVisit}
          clientId={clientId!}
          onClose={() => setRatingVisit(null)}
        />
      )}
    </div>
  );
}

/* ===== Rating Modal ===== */

function RatingModal({ visit, clientId, onClose }: { visit: VisitWithRelations; clientId: string; onClose: () => void }) {
  const { add } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<VisitRating | null>(null);

  useEffect(() => {
    ratingService.getByVisit(visit.id).then(setExisting).catch(() => {});
  }, [visit.id]);

  const submit = async () => {
    if (rating < 1 || rating > 5) return;
    setSubmitting(true);
    try {
      await ratingService.create({
        companyId: ARKON_COMPANY_ID,
        visitId: visit.id,
        clientId,
        employeeId: visit.employee_id ?? null,
        rating,
        comment,
      });
      add('تم إرسال تقييمك بنجاح', 'success');
      onClose();
    } catch {
      add('فشل إرسال التقييم', 'error');
    } finally { setSubmitting(false); }
  };

  if (existing) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center" dir="rtl">
        <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-700 text-slate-900">تقييم الزيارة</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <p className="text-sm text-slate-500">لقد قمت بتقييم هذه الزيارة مسبقاً.</p>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={24} className={s <= existing.rating ? 'fill-warning-400 text-warning-400' : 'text-slate-200'} />
            ))}
          </div>
          {existing.comment && <p className="mt-3 text-sm text-slate-600">{existing.comment}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center" dir="rtl">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-700 text-slate-900">تقييم الزيارة</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <p className="mb-3 text-sm text-slate-500">{formatDate(visit.scheduled_date)} • {visit.employee?.full_name ?? 'غير معين'}</p>
        <div className="mb-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(s)}
              className="transition"
            >
              <Star
                size={36}
                className={s <= (hover || rating) ? 'fill-warning-400 text-warning-400' : 'text-slate-200 hover:text-slate-300'}
              />
            </button>
          ))}
        </div>
        <textarea
          className="input min-h-[80px] resize-none"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="اكتب تعليقك هنا (اختياري)..."
        />
        <button onClick={submit} disabled={submitting || rating === 0} className="btn-primary mt-3 w-full">
          {submitting ? <Spinner /> : 'إرسال التقييم'}
        </button>
      </div>
    </div>
  );
}

/* ===== Client Invoices ===== */

export function ClientInvoices() {
  const { session } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const clientId = session?.userId;

  const loadData = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    try {
      const [inv, c] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, contract:contracts!inner(client_id)')
          .eq('contract.client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase.from('contracts').select('*, package:packages(name)').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setInvoices(inv.data ?? []);
      setContract(c.data);
    } catch { /* */ } finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: refresh when invoices, contracts, or payments change
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase.channel('client-invoices-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, loadData]);

  if (loading) return <PageLoader label="جاري التحميل..." />;

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <h1 className="font-display text-xl font-700 text-slate-900">الفواتير والمدفوعات</h1>

      {contract && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wallet size={18} className="text-brand-600" />
            <h2 className="text-sm font-600 text-slate-700">ملخص المدفوعات</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">القيمة الإجمالية</span>
              <span className="font-600 text-slate-900">{formatCurrency(contract.final_amount ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">المبلغ المدفوع</span>
              <span className="font-600 text-success-600">{formatCurrency(contract.amount_paid ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">المبلغ المتبقي</span>
              <span className="font-600 text-warning-600">{formatCurrency(contract.remaining_balance ?? 0)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="text-slate-500">حالة الدفع</span>
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-600', payBadgeClass(contract.payment_status))}>
                {PAYMENT_STATUS_LABELS[contract.payment_status] ?? contract.payment_status ?? '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-600 text-slate-700">الفواتير</h2>
        {invoices.length === 0 ? (
          <EmptyState icon={<CreditCard size={28} className="text-slate-300" />} title="لا توجد فواتير" />
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-600 text-slate-900">#{inv.invoice_number ?? inv.id.slice(0, 8)}</p>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-600', payBadgeClass(inv.status))}>
                    {PAYMENT_STATUS_LABELS[inv.status] ?? inv.status}
                  </span>
                </div>
                <p className="mt-1 text-lg font-700 text-slate-900">{formatCurrency(inv.total_amount ?? inv.amount ?? 0)}</p>
                <p className="text-xs text-slate-500">{formatDate(inv.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Client Support ===== */

export function ClientSupport() {
  const { session } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [tickets, setTickets] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { add } = useToast();
  const clientId = session?.userId;

  const loadTickets = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    try {
      setTickets(await serviceRequestService.listByClient(clientId));
    } catch { /* */ } finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // Realtime: refresh when service requests change
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase.channel('client-support-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => loadTickets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, loadTickets]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || !clientId) return;
    setSubmitting(true);
    try {
      await serviceRequestService.create({
        companyId: ARKON_COMPANY_ID,
        clientId,
        subject: subject.trim(),
        message: message.trim(),
      });
      add('تم إرسال طلب الدعم', 'success');
      setSubject('');
      setMessage('');
      loadTickets();
    } catch {
      add('فشل إرسال الطلب', 'error');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <h1 className="font-display text-xl font-700 text-slate-900">الدعم</h1>

      <form onSubmit={submit} className="card space-y-3 p-4">
        <div>
          <label className="label">الموضوع</label>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع الطلب" required />
        </div>
        <div>
          <label className="label">الرسالة</label>
          <textarea className="input min-h-[100px]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="اكتب رسالتك هنا..." required />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? <Spinner /> : <><Send size={16} /> إرسال</>}
        </button>
      </form>

      {loading ? (
        <PageLoader label="جاري التحميل..." />
      ) : tickets.length > 0 ? (
        <div>
          <h2 className="mb-2 text-sm font-600 text-slate-700">طلبات سابقة</h2>
          <div className="space-y-2">
            {tickets.map((t) => (
              <div key={t.id} className="card p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-600 text-slate-900">{t.subject}</p>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-600',
                    t.status === 'open' ? 'bg-warning-50 text-warning-700' :
                    t.status === 'resolved' ? 'bg-success-50 text-success-700' :
                    'bg-slate-100 text-slate-600'
                  )}>
                    {t.status === 'open' ? 'مفتوح' : t.status === 'in_progress' ? 'قيد المعالجة' : t.status === 'resolved' ? 'تم الحل' : t.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{t.message}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDate(t.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ===== Client Profile ===== */

function toEnglishDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

function sanitizePin(s: string): string {
  return toEnglishDigits(s).replace(/\D/g, '').slice(0, 4);
}

export function ClientProfile() {
  const { session, logout, clientChangePin } = useAuth();
  const navigate = useNavigate();
  const { add } = useToast();
  const client = session?.client as Client | null;
  const [phone, setPhone] = useState(client?.phone_number ?? '');
  const [email, setEmail] = useState(client?.email ?? '');
  const [address, setAddress] = useState(client?.address ?? '');
  const [saving, setSaving] = useState(false);

  // PIN change state
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  const handleSave = async () => {
    if (!client?.id) return;
    setSaving(true);
    try {
      await clientService.update(client.id, { phone_number: phone, email, address });
      add('تم حفظ التغييرات', 'success');
    } catch {
      add('فشل الحفظ', 'error');
    } finally { setSaving(false); }
  };

  const handleChangePin = async () => {
    if (!client?.id) return;
    if (newPin !== confirmNewPin) { add('رمزا PIN غير متطابقين', 'error'); return; }
    if (!/^\d{4}$/.test(newPin)) { add('رمز PIN يجب أن يكون 4 أرقام', 'error'); return; }
    setPinSaving(true);
    try {
      await clientChangePin(client.id, currentPin, newPin, confirmNewPin);
      add('تم تغيير رمز PIN بنجاح', 'success');
      setShowPinChange(false);
      setCurrentPin(''); setNewPin(''); setConfirmNewPin('');
    } catch (err) {
      add((err as Error).message, 'error');
    } finally { setPinSaving(false); }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <h1 className="font-display text-xl font-700 text-slate-900">الملف الشخصي</h1>

      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-700 text-brand-700">
            {client?.full_name?.charAt(0) ?? '?'}
          </div>
          <div>
            <p className="font-600 text-slate-900">{client?.full_name ?? '—'}</p>
            <p className="text-sm text-slate-500">{client?.service_area ?? ''}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">رقم الهاتف</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label className="label">العنوان</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Lock size={18} className="text-brand-600" />
          <h2 className="text-sm font-600 text-slate-700">رمز PIN</h2>
        </div>
        {!showPinChange ? (
          <button onClick={() => setShowPinChange(true)} className="btn-ghost w-full">
            تغيير رمز PIN
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label">رمز PIN الحالي</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(sanitizePin(e.target.value))}
                placeholder="••••"
                dir="ltr"
                onPaste={(e) => e.preventDefault()}
              />
            </div>
            <div>
              <label className="label">رمز PIN الجديد</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(sanitizePin(e.target.value))}
                placeholder="••••"
                dir="ltr"
                onPaste={(e) => e.preventDefault()}
              />
            </div>
            <div>
              <label className="label">تأكيد رمز PIN الجديد</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmNewPin}
                onChange={(e) => setConfirmNewPin(sanitizePin(e.target.value))}
                placeholder="••••"
                dir="ltr"
                onPaste={(e) => e.preventDefault()}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleChangePin} disabled={pinSaving} className="btn-primary flex-1">
                {pinSaving ? <Spinner /> : 'حفظ'}
              </button>
              <button onClick={() => { setShowPinChange(false); setCurrentPin(''); setNewPin(''); setConfirmNewPin(''); }} className="btn-ghost flex-1">
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>

      <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-lg bg-danger-50 py-3 text-sm font-600 text-danger-600">
        <LogOut size={18} /> تسجيل الخروج
      </button>
    </div>
  );
}
