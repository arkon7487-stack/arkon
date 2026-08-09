import { useEffect, useState, useCallback } from 'react';
import {
  Wallet, Plus, Trash2, TrendingUp, TrendingDown, DollarSign,
  Receipt, Calendar, FileText, Search, Download, AlertCircle,
  Users, CheckCircle2, Clock, Play, Sparkles, CreditCard, CalendarPlus,
} from 'lucide-react';
import { expenseService, type ExpenseInput } from '@/services/expenseService';
import { contractService } from '@/services/contractService';
import { payrollService, type PayrollInput } from '@/services/payrollService';
import { contractPaymentService } from '@/services/contractPaymentService';
import { invoiceService } from '@/services/invoiceService';
import type { Expense, ContractWithRelations, Payroll, InvoiceWithRelations } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { Modal } from '@/components/Modal';
import { ConfirmDialog, NumberInput } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { VISIT_TYPE_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/locale';

const EXPENSE_CATEGORIES = [
  'الرواتب', 'الوقود', 'مواد التنظيف', 'المعدات', 'الصيانة',
  'المرافق', 'مصاريف المكتب', 'التسويق', 'النقل', 'متفرقات',
];

const PAYMENT_METHODS = ['نقدي', 'تحويل بنكي', 'شيك', 'بطاقة ائتمانية'];

function payBadge(status: string) {
  switch (status) {
    case 'paid': return 'bg-success-50 text-success-700';
    case 'partial': return 'bg-warning-50 text-warning-700';
    case 'overdue': return 'bg-danger-50 text-danger-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function payLabel(status: string) {
  return status === 'paid' ? 'مدفوع' : status === 'partial' ? 'مدفوع جزئياً' : status === 'overdue' ? 'متأخر' : 'غير مدفوع';
}

type Tab = 'dashboard' | 'expenses' | 'receivables' | 'payroll' | 'reports';

const emptyForm: ExpenseInput = {
  title: '', category: 'متفرقات', amount: 0, payment_method: 'نقدي',
  vendor: '', description: '', receipt_url: '',
};

import { additionalVisitService } from '@/services/additionalVisitService';

function toUserMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('already_paid')) return 'هذا العقد مدفوع بالكامل';
  if (msg.includes('amount_exceeds_remaining')) return 'قيمة الدفعة أكبر من المبلغ المتبقي';
  if (msg.includes('invalid_amount')) return 'قيمة الدفعة يجب أن تكون أكبر من الصفر';
  if (msg.includes('not_authorized')) return 'لا تملك صلاحية تسجيل الدفعات';
  return msg || 'تعذر تسجيل الدفعة. يرجى المحاولة مرة أخرى.';
}

function AdditionalVisitReceivables() {
  const toast = useToast();
  const [charges, setCharges] = useState<Array<{ visit: any; invoice: any }>>([]);
  const [loading, setLoading] = useState(true);
  const [paymentTarget, setPaymentTarget] = useState<{ visit: any; invoice: any } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const visits = await additionalVisitService.getAdditionalVisits();
      const results: Array<{ visit: any; invoice: any }> = [];
      for (const v of visits) {
        const invoices = await additionalVisitService.getVisitInvoices(v.id);
        if (invoices[0] && Number(invoices[0].remaining_balance ?? 0) > 0) {
          results.push({ visit: v, invoice: invoices[0] });
        }
      }
      setCharges(results);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return null;
  if (charges.length === 0) return null;

  const totalOutstanding = charges.reduce((sum, c) => sum + Number(c.invoice?.remaining_balance ?? 0), 0);

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <CalendarPlus size={18} className="text-brand-600" />
        <h3 className="text-sm font-700 text-slate-900">مستحقات الزيارات الإضافية والطارئة</h3>
        <span className="text-sm text-danger-600 font-600">{formatCurrency(totalOutstanding)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-right text-xs font-600 text-slate-500">
              <th className="px-4 py-3">العميل</th>
              <th className="px-4 py-3">النوع</th>
              <th className="px-4 py-3">التاريخ</th>
              <th className="px-4 py-3">القيمة</th>
              <th className="px-4 py-3">المدفوع</th>
              <th className="px-4 py-3">المتبقي</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {charges.map(({ visit, invoice }) => (
              <tr key={visit.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-600 text-slate-900">{visit.contract?.client?.full_name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-600',
                    visit.visit_type === 'emergency' ? 'bg-danger-50 text-danger-700' : 'bg-brand-50 text-brand-700')}>
                    {VISIT_TYPE_LABELS[visit.visit_type] ?? visit.visit_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDate(visit.scheduled_date)}</td>
                <td className="px-4 py-3 font-600 text-slate-900">{formatCurrency(invoice?.total ?? 0)}</td>
                <td className="px-4 py-3 text-success-600">{formatCurrency(invoice?.amount_paid ?? 0)}</td>
                <td className="px-4 py-3 font-600 text-danger-600">{formatCurrency(invoice?.remaining_balance ?? 0)}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-600',
                    invoice?.payment_status === 'paid' ? 'bg-success-50 text-success-700' :
                    invoice?.payment_status === 'partially_paid' ? 'bg-warning-50 text-warning-700' : 'bg-slate-100 text-slate-600')}>
                    {PAYMENT_STATUS_LABELS[invoice?.payment_status] ?? invoice?.payment_status ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {Number(invoice?.remaining_balance ?? 0) > 0 && invoice?.payment_status !== 'paid' ? (
                    <button
                      onClick={() => { setPaymentTarget({ visit, invoice }); setPaymentAmount(''); }}
                      className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-600 text-brand-700 hover:bg-brand-100"
                    >تسجيل دفعة</button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-success-50 px-2.5 py-1.5 text-xs font-600 text-success-700">
                      <CheckCircle2 size={12} /> تم الدفع
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={!!paymentTarget}
        onClose={() => setPaymentTarget(null)}
        title="تسجيل دفعة للزيارة"
        size="sm"
        footer={
          <>
            <button onClick={() => setPaymentTarget(null)} className="btn-ghost">إلغاء</button>
            <button
              disabled={recordingPayment || !paymentAmount}
              onClick={async () => {
                if (!paymentTarget || !paymentAmount) return;
                const amount = Number(paymentAmount);
                const remaining = Number(paymentTarget.invoice.remaining_balance ?? 0);
                if (!Number.isFinite(amount) || amount <= 0) {
                  toast.push('error', 'قيمة الدفعة يجب أن تكون أكبر من الصفر');
                  return;
                }
                if (amount > remaining) {
                  toast.push('error', `قيمة الدفعة (${formatCurrency(amount)}) أكبر من المبلغ المتبقي (${formatCurrency(remaining)})`);
                  return;
                }
                setRecordingPayment(true);
                try {
                  await additionalVisitService.recordPayment(paymentTarget.invoice.id, amount, 'نقدي');
                  toast.push('success', 'تم تسجيل الدفعة بنجاح');
                  setPaymentTarget(null);
                  setPaymentAmount('');
                  await load();
                } catch (err) {
                  toast.push('error', (err as Error).message || 'تعذر تسجيل الدفعة. يرجى المحاولة مرة أخرى.');
                } finally {
                  setRecordingPayment(false);
                }
              }}
              className="btn-primary"
            >{recordingPayment ? 'جارٍ التسجيل…' : 'تسجيل الدفعة'}</button>
          </>
        }
      >
        <NumberInput
          label="المبلغ المدفوع *"
          value={paymentAmount ? Number(paymentAmount) : undefined}
          onChange={(value) => setPaymentAmount(value == null ? '' : String(value))}
          min={0.01}
          step={0.01}
          prefix="₪"
          required
        />
      </Modal>
    </div>
  );
}

export function FinancePage() {
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contracts, setContracts] = useState<ContractWithRelations[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ExpenseInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Expense | null>(null);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<ContractWithRelations | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'نقدي', payment_date: new Date().toISOString().slice(0, 10), notes: '' });
  const [recordingPayment, setRecordingPayment] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [exp, con, pr, inv] = await Promise.all([expenseService.list(), contractService.list(), payrollService.list(), invoiceService.list()]);
      setExpenses(exp); setContracts(con); setPayroll(pr); setInvoices(inv);
    } catch (err) { toast.push('error', (err as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await expenseService.create(form);
      toast.push('success', 'تم تسجيل المصروف');
      setModalOpen(false); setForm({ ...emptyForm }); await load();
    } catch (err) { toast.push('error', (err as Error).message); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    try { await expenseService.remove(confirmTarget.id); toast.push('success', 'تم حذف المصروف'); await load(); }
    catch (err) { toast.push('error', (err as Error).message); }
    finally { setConfirmTarget(null); }
  };

  const visitInvoices = invoices.filter((i) => i.charge_type === 'additional_visit' || i.charge_type === 'emergency_visit');
  const visitInvoiceRevenue = visitInvoices.reduce((s, i) => s + Number(i.total ?? 0), 0);
  const visitInvoiceCollected = visitInvoices.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
  const visitInvoiceOutstanding = visitInvoices.reduce((s, i) => s + Number(i.remaining_balance ?? 0), 0);

  const totalRevenue = contracts.filter((c) => c.status === 'active').reduce((s, c) => s + Number(c.final_amount ?? 0), 0) + visitInvoiceRevenue;
  const totalCollected = contracts.reduce((s, c) => s + (Number(c.final_amount ?? 0) - Number(c.remaining_balance ?? 0)), 0) + visitInvoiceCollected;
  const totalOutstanding = contracts.reduce((s, c) => s + Number(c.remaining_balance ?? 0), 0) + visitInvoiceOutstanding;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalCollected - totalExpenses;
  const totalCollectedReal = contracts.reduce((s, c) => s + Number(c.amount_paid ?? 0), 0) + visitInvoiceCollected;
  const paidContracts = contracts.filter((c) => c.payment_status === 'fully_paid' || c.payment_status === 'paid').length;
  const partialContracts = contracts.filter((c) => c.payment_status === 'partially_paid' || c.payment_status === 'partial').length;
  const unpaidContracts = contracts.filter((c) => c.payment_status === 'unpaid').length;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlyExpenses = expenses.filter((e) => e.expense_date.startsWith(monthKey)).reduce((s, e) => s + e.amount, 0);
  const byCategory: Record<string, number> = {};
  for (const e of expenses) { byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount; }
  const filteredExpenses = expenses.filter((e) =>
    !query || e.title.toLowerCase().includes(query.toLowerCase()) || e.category.includes(query) || (e.vendor ?? '').includes(query)
  );
  const filteredReceivables = contracts.filter((c) =>
    c.payment_status !== 'paid' && (!query || (c.contract_number ?? '').includes(query) || (c.client?.full_name ?? '').includes(query))
  );

  if (loading) return <PageLoader label="جارٍ تحميل البيانات المالية…" />;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">الإدارة المالية</h1>
          <p className="mt-1 text-sm text-slate-500">المركز المالي للشركة — الإيرادات والمصروفات والمستحقات</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={16} /> تسجيل مصروف</button>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {([['dashboard', 'لوحة المعلومات'], ['expenses', 'المصروفات'], ['receivables', 'المستحقات'], ['payroll', 'الرواتب الشهرية'], ['reports', 'التقارير']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={cn('flex-1 rounded-lg py-2 text-sm font-600 transition', tab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>{label}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><TrendingUp size={20} /></div><div><p className="text-xs text-slate-500">الإيرادات الإجمالية</p><p className="font-700 text-lg text-slate-900">{formatCurrency(totalRevenue)}</p></div></div></div>
          <div className="card p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-success-50 p-2.5 text-success-600"><DollarSign size={20} /></div><div><p className="text-xs text-slate-500">الإيرادات المحصلة فعليًا</p><p className="font-700 text-lg text-slate-900">{formatCurrency(totalCollectedReal)}</p></div></div></div>
          <div className="card p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-danger-50 p-2.5 text-danger-600"><AlertCircle size={20} /></div><div><p className="text-xs text-slate-500">المستحقات</p><p className="font-700 text-lg text-slate-900">{formatCurrency(totalOutstanding)}</p></div></div></div>
          <div className="card p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-warning-50 p-2.5 text-warning-600"><Wallet size={20} /></div><div><p className="text-xs text-slate-500">صافي الربح</p><p className="font-700 text-lg text-slate-900">{formatCurrency(netProfit)}</p></div></div></div>
          <div className="card p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><FileText size={20} /></div><div><p className="text-xs text-slate-500">عقود نشطة</p><p className="font-700 text-lg text-slate-900">{contracts.filter((c) => c.status === 'active').length}</p></div></div></div>
          <div className="card p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><Receipt size={20} /></div><div><p className="text-xs text-slate-500">مصروفات</p><p className="font-700 text-lg text-slate-900">{formatCurrency(totalExpenses)}</p></div></div></div>
        </div>
      )}

      {tab === 'receivables' && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-lg font-700 text-slate-900">مستحقات العقود</h2>
            <p className="mt-0.5 text-sm text-slate-500">الدفعات المستحقة على العقود</p>
          </div>
          {filteredReceivables.length === 0 ? (
            <div className="card"><EmptyState icon={<CheckCircle2 size={32} />} title="لا توجد مستحقات" description="جميع العقود مدفوعة بالكامل." /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-right text-xs font-600 text-slate-500">
                      <th className="px-4 py-3">العميل</th>
                      <th className="px-4 py-3">العقد</th>
                      <th className="px-4 py-3">القيمة</th>
                      <th className="px-4 py-3">المدفوع</th>
                      <th className="px-4 py-3">المتبقي</th>
                      <th className="px-4 py-3">الحالة</th>
                      <th className="px-4 py-3">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceivables.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100">
                        <td className="px-4 py-3 font-600 text-slate-900">{c.client?.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{c.contract_number}</td>
                        <td className="px-4 py-3 font-600 text-slate-900">{formatCurrency(Number(c.final_amount ?? 0))}</td>
                        <td className="px-4 py-3 text-success-600 font-600">{formatCurrency(Number(c.amount_paid ?? 0))}</td>
                        <td className="px-4 py-3 text-danger-600 font-600">{formatCurrency(Number(c.remaining_balance ?? 0))}</td>
                        <td className="px-4 py-3"><span className={cn('rounded-full px-2 py-0.5 text-xs font-600', payBadge(c.payment_status))}>{payLabel(c.payment_status)}</span></td>
                        <td className="px-4 py-3">
                          {Number(c.remaining_balance ?? 0) > 0 && c.payment_status !== 'fully_paid' && c.payment_status !== 'paid' ? (
                            <button onClick={() => { setPaymentTarget(c); setPaymentForm({ amount: '', payment_method: 'نقدي', payment_date: new Date().toISOString().slice(0, 10), notes: '' }); }} className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-600 text-brand-700 hover:bg-brand-100"><CreditCard size={12} /> تسجيل دفعة</button>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-success-50 px-2.5 py-1.5 text-xs font-600 text-success-700"><CheckCircle2 size={12} /> تم الدفع</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <AdditionalVisitReceivables />

          <Modal
            open={!!paymentTarget}
            onClose={() => setPaymentTarget(null)}
            title="تسجيل دفعة"
            size="sm"
            footer={
              <>
                <button onClick={() => setPaymentTarget(null)} className="btn-ghost">إلغاء</button>
                <button
                  disabled={recordingPayment || !paymentForm.amount}
                  onClick={async () => {
                    if (!paymentTarget || !paymentForm.amount) return;
                    const amt = Number(paymentForm.amount);
                    if (amt <= 0) { toast.push('error', 'المبلغ يجب أن يكون أكبر من صفر'); return; }
                    const remaining = Number(paymentTarget.remaining_balance ?? 0);
                    if (amt > remaining) { toast.push('error', `المبلغ (${formatCurrency(amt)}) أكبر من المتبقي (${formatCurrency(remaining)})`); return; }
                    setRecordingPayment(true);
                    try {
                      await contractPaymentService.record({
                        contract_id: paymentTarget.id,
                        amount: amt,
                        payment_method: paymentForm.payment_method,
                        payment_date: paymentForm.payment_date,
                        notes: paymentForm.notes,
                      });
                      toast.push('success', `تم تسجيل دفعة ${formatCurrency(amt)} بنجاح`);
                      setPaymentTarget(null);
                      await load();
                    } catch (err) { toast.push('error', toUserMessage(err)); }
                    finally { setRecordingPayment(false); }
                  }}
                  className="btn-primary"
                >{recordingPayment ? 'جارٍ التسجيل…' : 'تسجيل الدفعة'}</button>
              </>
            }
          >
            {paymentTarget && (
              <div className="space-y-4" dir="rtl">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">العميل</span><span className="font-600">{paymentTarget.client?.full_name ?? '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">قيمة العقد</span><span className="font-600">{formatCurrency(Number(paymentTarget.final_amount ?? 0))}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">المدفوع سابقاً</span><span className="font-600 text-success-600">{formatCurrency(Number(paymentTarget.amount_paid ?? 0))}</span></div>
                  <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-700 font-600">المتبقي</span><span className="font-700 text-danger-600">{formatCurrency(Number(paymentTarget.remaining_balance ?? 0))}</span></div>
                </div>
                <NumberInput
                  label="المبلغ المدفوع *"
                  value={paymentForm.amount ? Number(paymentForm.amount) : undefined}
                  onChange={(v) => setPaymentForm({ ...paymentForm, amount: v != null ? String(v) : '' })}
                  min={0.01}
                  step={0.01}
                  placeholder="0.00"
                  required
                  prefix="₪"
                />
                <div>
                  <label className="label">طريقة الدفع</label>
                  <select className="input" value={paymentForm.payment_method} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}>
                    {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">تاريخ الدفع</label>
                  <input type="date" className="input" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">ملاحظات</label>
                  <input className="input" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} placeholder="اختياري" />
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}

      {tab === 'payroll' && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <label className="label">شهر الرواتب</label>
              <input
                type="month"
                className="input"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
              />
            </div>
            <button
              onClick={async () => {
                setGeneratingPayroll(true);
                try {
                  const result = await payrollService.generateForMonth(payrollMonth);
                  toast.push('success', `تم توليد ${result.generated} مستحق راتب جديد${result.skipped > 0 ? ` (${result.skipped} موجود مسبقاً)` : ''}`);
                  await load();
                } catch (err) { toast.push('error', (err as Error).message); }
                finally { setGeneratingPayroll(false); }
              }}
              disabled={generatingPayroll}
              className="btn-primary"
            >
              {generatingPayroll ? 'جاري التوليد…' : <><Sparkles size={16} /> توليد رواتب الشهر</>}
            </button>
          </div>

          {payroll.filter((p) => p.salary_month === payrollMonth).length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Users size={32} />}
                title="لا توجد رواتب لهذا الشهر"
                description="اضغط زر توليد رواتب الشهر لإنشاء مستحقات الرواتب تلقائياً لجميع الموظفين النشطين."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-right text-xs font-600 text-slate-500">
                    <th className="px-4 py-3">الموظف</th>
                    <th className="px-4 py-3">المسمى الوظيفي</th>
                    <th className="px-4 py-3">الراتب</th>
                    <th className="px-4 py-3">الشهر</th>
                    <th className="px-4 py-3">تاريخ الاستحقاق</th>
                    <th className="px-4 py-3">الحالة</th>
                    <th className="px-4 py-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.filter((p) => p.salary_month === payrollMonth).map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-600 text-slate-900">{p.employee?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{p.employee?.job_title ?? p.employee?.position ?? '—'}</td>
                      <td className="px-4 py-3 font-700 text-slate-900">{formatCurrency(Number(p.salary_amount))}</td>
                      <td className="px-4 py-3 text-slate-600">{p.salary_month}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(p.due_date)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-600',
                          p.status === 'paid' ? 'bg-success-50 text-success-700' :
                          p.status === 'overdue' ? 'bg-danger-50 text-danger-700' :
                          'bg-warning-50 text-warning-700',
                        )}>
                          {p.status === 'paid' ? 'مدفوع' : p.status === 'overdue' ? 'متأخر' : 'معلق'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.status !== 'paid' && (
                          <button
                            onClick={async () => {
                              setPayingId(p.id);
                              try {
                                await payrollService.markAsPaid(p.id, 'admin');
                                toast.push('success', `تم دفع راتب ${p.employee?.full_name ?? ''} وتسجيله في المصروفات`);
                                await load();
                              } catch (err) { toast.push('error', (err as Error).message); }
                              finally { setPayingId(null); }
                            }}
                            disabled={payingId === p.id}
                            className="flex items-center gap-1 rounded-lg bg-success-50 px-2.5 py-1.5 text-xs font-600 text-success-700 hover:bg-success-100"
                          >
                            {payingId === p.id ? <Clock size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            دفع
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-xs text-brand-700">
            <p className="font-600">كيف يعمل محرك الرواتب:</p>
            <ul className="mt-2 space-y-1">
              <li>• اضغط "توليد رواتب الشهر" لإنشاء مستحقات لجميع الموظفين النشطين تلقائياً</li>
              <li>• عند الضغط على "دفع" يتم نقل الراتب إلى أرشيف المصروفات تلقائياً</li>
              <li>• يظل سجل الرواتب محفوظاً في المصروفات حتى لو تغير راتب الموظف لاحقاً</li>
            </ul>
          </div>
        </>
      )}

      {tab === 'expenses' && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-700 text-slate-900">المصروفات</h2>
            <button onClick={() => setModalOpen(true)} className="btn-primary"><Receipt size={16} /> تسجيل مصروف</button>
          </div>
          {filteredExpenses.length === 0 ? (
            <div className="card"><EmptyState icon={<Receipt size={32} />} title="لا توجد مصروفات" description="اضغط تسجيل مصروف لإضافة مصروف جديد." /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-right text-xs font-600 text-slate-500">
                      <th className="px-4 py-3">العنوان</th>
                      <th className="px-4 py-3">التصنيف</th>
                      <th className="px-4 py-3">المبلغ</th>
                      <th className="px-4 py-3">طريقة الدفع</th>
                      <th className="px-4 py-3">المورد</th>
                      <th className="px-4 py-3">التاريخ</th>
                      <th className="px-4 py-3">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((e) => (
                      <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-600 text-slate-900">{e.title}</td>
                        <td className="px-4 py-3 text-slate-600">{e.category}</td>
                        <td className="px-4 py-3 font-700 text-slate-900">{formatCurrency(Number(e.amount))}</td>
                        <td className="px-4 py-3 text-slate-600">{e.payment_method ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{e.vendor ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(e.expense_date)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setConfirmTarget(e)} className="text-danger-600 hover:text-danger-700"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'reports' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'تقرير الإيرادات', icon: DollarSign, desc: 'إجمالي الإيرادات من العقود والزيارات الإضافية' },
            { label: 'تقرير المصروفات', icon: Receipt, desc: 'تفصيل المصروفات حسب التصنيف' },
            { label: 'الأرباح والخسائر', icon: TrendingUp, desc: 'صافي الربح أو الخسارة' },
            { label: 'المستحقات', icon: AlertCircle, desc: 'المدفوعات المعلقة' },
            { label: 'التدفق النقدي', icon: Wallet, desc: 'حركة النقد الشهرية' },
            { label: 'مدفوعات العقود', icon: FileText, desc: 'تفصيل دفعات كل عقد' },
          ].map((r) => (
            <button key={r.label} onClick={() => toast.push('info', 'سيتم إضافة التصدير قريباً')} className="card card-hover p-5 text-right">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><r.icon size={20} /></div>
                <div><p className="font-600 text-slate-900">{r.label}</p><p className="text-xs text-slate-500">{r.desc}</p></div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-brand-600"><Download size={12} /> تصدير</div>
            </button>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="تسجيل مصروف" size="lg"
        footer={<><button onClick={() => setModalOpen(false)} className="btn-ghost">إلغاء</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'جارٍ الحفظ…' : 'حفظ'}</button></>}>
        <form onSubmit={save} className="space-y-4" dir="rtl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="label">العنوان *</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="label">التصنيف *</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <NumberInput label="المبلغ *" value={form.amount || undefined} onChange={(v) => setForm({ ...form, amount: v ?? 0 })} min={0} step={0.01} required prefix="₪" />
            <div><label className="label">طريقة الدفع</label><select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
            <div><label className="label">المورد</label><input className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
            <div><label className="label">رابط الإيصال</label><input className="input" value={form.receipt_url} onChange={(e) => setForm({ ...form, receipt_url: e.target.value })} dir="ltr" /></div>
          </div>
          <div><label className="label">الوصف</label><textarea className="input min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmTarget} onClose={() => setConfirmTarget(null)} onConfirm={confirmDelete} title="حذف المصروف" message="هل أنت متأكد من حذف هذا المصروف؟" confirmLabel="حذف" danger />
    </div>
  );
}
