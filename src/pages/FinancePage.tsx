import { useState, useEffect, useCallback } from 'react';
import {
  Users, CheckCircle2, Clock, Play, Sparkles, CreditCard, CalendarPlus,
  TrendingUp, Wallet, AlertCircle, Receipt, DollarSign, Download, FileText, Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { contractPaymentService } from '@/services/contractPaymentService';
import { additionalVisitService } from '@/services/additionalVisitService';
import { payrollService } from '@/services/payrollService';
import { expenseService } from '@/services/expenseService';
import { useToast } from '@/components/Toast';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { Modal, NumberInput, ConfirmDialog } from '@/components/ui';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { PAYMENT_STATUS_LABELS } from '@/lib/locale';
import type { ContractWithRelations, Expense, PayrollWithRelations } from '@/types';

function toUserMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('already_paid')) return 'هذا العقد مدفوع بالكامل';
  if (msg.includes('amount_exceeds_remaining')) return 'قيمة الدفعة أكبر من المبلغ المتبقي';
  if (msg.includes('invalid_amount')) return 'قيمة الدفعة يجب أن تكون أكبر من الصفر';
  if (msg.includes('not_authorized')) return 'لا تملك صلاحية تسجيل الدفعات';
  return msg || 'تعذر تسجيل الدفعة. يرجى المحاولة مرة أخرى.';
}

const EXPENSE_CATEGORIES = ['رواتب', 'إيجار', 'مواد', 'صيانة', 'نقل', 'تسويق', 'ضيافة', 'أخرى'];
const PAYMENT_METHODS = ['نقدي', 'تحويل بنكي', 'شيك', 'بطاقة ائتمان'];

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
      const result: Array<{ visit: any; invoice: any }> = [];
      for (const v of visits) {
        const invoices = await additionalVisitService.getVisitInvoices(v.id);
        if (invoices.length > 0) {
          result.push({ visit: v, invoice: invoices[0] });
        }
      }
      setCharges(result);
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const unpaidCharges = charges.filter(
    ({ invoice }) => Number(invoice?.remaining_balance ?? 0) > 0 && invoice?.payment_status !== 'paid',
  );

  if (loading) return <PageLoader label="جارٍ تحميل المستحقات…" />;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-700 text-slate-900">مستحقات الزيارات الإضافية والطارئة</h2>
          <p className="mt-0.5 text-sm text-slate-500">الدفعات المستحقة على الزيارات الإضافية والطارئة</p>
        </div>
      </div>

      {unpaidCharges.length === 0 ? (
        <div className="card">
          <EmptyState icon={<CalendarPlus size={32} />} title="لا توجد مستحقات" description="جميع الزيارات الإضافية مدفوعة." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="px-4 py-3 text-right font-600">العميل</th>
                  <th className="px-4 py-3 text-right font-600">النوع</th>
                  <th className="px-4 py-3 text-right font-600">التاريخ</th>
                  <th className="px-4 py-3 text-right font-600">المبلغ</th>
                  <th className="px-4 py-3 text-right font-600">المدفوع</th>
                  <th className="px-4 py-3 text-right font-600">المتبقي</th>
                  <th className="px-4 py-3 text-right font-600">الحالة</th>
                  <th className="px-4 py-3 text-right font-600">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {unpaidCharges.map(({ visit, invoice }) => {
                  const clientName = visit?.contract?.client?.full_name ?? '—';
                  const visitType = visit?.visit_type === 'emergency' ? 'زيارة طارئة' : 'زيارة إضافية';
                  const remaining = Number(invoice?.remaining_balance ?? 0);
                  const paid = Number(invoice?.amount_paid ?? 0);
                  const total = Number(invoice?.total ?? 0);
                  const status = invoice?.payment_status ?? 'unpaid';
                  return (
                    <tr key={visit.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-600 text-slate-900">{clientName}</td>
                      <td className="px-4 py-3 text-slate-600">{visitType}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(visit?.scheduled_date)}</td>
                      <td className="px-4 py-3 font-600 text-slate-900">{formatCurrency(total)}</td>
                      <td className="px-4 py-3 text-success-600 font-600">{formatCurrency(paid)}</td>
                      <td className="px-4 py-3 text-danger-600 font-600">{formatCurrency(remaining)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-600',
                          status === 'paid' ? 'bg-success-50 text-success-700' :
                          status === 'partially_paid' ? 'bg-warning-50 text-warning-700' :
                          'bg-danger-50 text-danger-700',
                        )}>
                          {PAYMENT_STATUS_LABELS[status] ?? status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {remaining > 0 && status !== 'paid' ? (
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!paymentTarget}
        onClose={() => setPaymentTarget(null)}
        title="تسجيل دفعة - زيارة إضافية"
        size="sm"
        footer={
          <>
            <button onClick={() => setPaymentTarget(null)} className="btn-ghost">إلغاء</button>
            <button
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
              disabled={recordingPayment || !paymentAmount}
              className="btn-primary"
            >
              {recordingPayment ? 'جارٍ التسجيل…' : 'تسجيل الدفعة'}
            </button>
          </>
        }
      >
        {paymentTarget && (
          <div className="space-y-4" dir="rtl">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">العميل</span><span className="font-600">{paymentTarget.visit?.contract?.client?.full_name ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">إجمالي الفاتورة</span><span className="font-600">{formatCurrency(Number(paymentTarget.invoice.total ?? 0))}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">المدفوع سابقاً</span><span className="font-600 text-success-600">{formatCurrency(Number(paymentTarget.invoice.amount_paid ?? 0))}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-700 font-600">المتبقي</span><span className="font-700 text-danger-600">{formatCurrency(Number(paymentTarget.invoice.remaining_balance ?? 0))}</span></div>
            </div>
            <NumberInput
              label="المبلغ المدفوع *"
              value={paymentAmount ? Number(paymentAmount) : undefined}
              onChange={(v) => setPaymentAmount(v != null ? String(v) : '')}
              min={0.01}
              step={0.01}
              placeholder="0.00"
              required
              prefix="₪"
            />
          </div>
        )}
      </Modal>
    </>
  );
}

export function FinancePage() {
  const toast = useToast();
  const [tab, setTab] = useState<'overview' | 'receivables' | 'payroll' | 'expenses' | 'reports'>('overview');
  const [contracts, setContracts] = useState<ContractWithRelations[]>([]);
  const [payroll, setPayroll] = useState<PayrollWithRelations[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Expense | null>(null);
  const [form, setForm] = useState({ title: '', category: 'رواتب', amount: 0, payment_method: 'نقدي', vendor: '', receipt_url: '', description: '' });
  const [paymentTarget, setPaymentTarget] = useState<ContractWithRelations | null>(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'نقدي', payment_date: new Date().toISOString().slice(0, 10), notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contractsResult, payrollResult, expensesResult] = await Promise.all([
        supabase.from('contracts').select('*, client:clients(*), package:packages(*), employee:employees(*)').order('created_at', { ascending: false }),
        supabase.from('payroll').select('*, employee:employees(*)').order('salary_month', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
      ]);
      if (contractsResult.error) throw contractsResult.error;
      if (payrollResult.error) throw payrollResult.error;
      if (expensesResult.error) throw expensesResult.error;
      setContracts((contractsResult.data as ContractWithRelations[]) ?? []);
      setPayroll((payrollResult.data as PayrollWithRelations[]) ?? []);
      setExpenses((expensesResult.data as Expense[]) ?? []);
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        title: form.title,
        category: form.category,
        amount: form.amount,
        payment_method: form.payment_method,
        vendor: form.vendor || null,
        receipt_url: form.receipt_url || null,
        description: form.description || null,
      });
      if (error) throw error;
      toast.push('success', 'تم تسجيل المصروف بنجاح');
      setModalOpen(false);
      setForm({ title: '', category: 'رواتب', amount: 0, payment_method: 'نقدي', vendor: '', receipt_url: '', description: '' });
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
      const { error } = await supabase.from('expenses').delete().eq('id', confirmTarget.id);
      if (error) throw error;
      toast.push('success', 'تم حذف المصروف');
      setConfirmTarget(null);
      await load();
    } catch (err) {
      toast.push('error', (err as Error).message);
    }
  };

  if (loading) return <PageLoader label="جارٍ تحميل البيانات المالية…" />;

  const totalRevenue = contracts.reduce((sum, c) => sum + Number(c.final_amount ?? 0), 0);
  const totalReceived = contracts.reduce((sum, c) => sum + Number(c.amount_paid ?? 0), 0);
  const totalOutstanding = contracts.reduce((sum, c) => sum + Number(c.remaining_balance ?? 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
  const netProfit = totalReceived - totalExpenses;
  const activeContracts = contracts.filter((c) => c.status === 'active');
  const unpaidContracts = contracts.filter((c) => Number(c.remaining_balance ?? 0) > 0 && c.payment_status !== 'fully_paid' && c.payment_status !== 'paid');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-700 text-slate-900">الإدارة المالية</h1>
        <p className="mt-1 text-sm text-slate-500">إدارة المصروفات والمستحقات والتقارير المالية</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {[
          { key: 'overview', label: 'نظرة عامة' },
          { key: 'receivables', label: 'المستحقات' },
          { key: 'payroll', label: 'الرواتب' },
          { key: 'expenses', label: 'المصروفات' },
          { key: 'reports', label: 'التقارير' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={cn(
              'px-4 py-2 text-sm font-600 transition border-b-2 -mb-px',
              tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><TrendingUp size={20} /></div><div><p className="text-xs text-slate-500">إجمالي الإيرادات</p><p className="font-700 text-lg text-slate-900">{formatCurrency(totalRevenue)}</p></div></div></div>
          <div className="card p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-success-50 p-2.5 text-success-600"><DollarSign size={20} /></div><div><p className="text-xs text-slate-500">المحصل</p><p className="font-700 text-lg text-slate-900">{formatCurrency(totalReceived)}</p></div></div></div>
          <div className="card p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-danger-50 p-2.5 text-danger-600"><AlertCircle size={20} /></div><div><p className="text-xs text-slate-500">المستحقات</p><p className="font-700 text-lg text-slate-900">{formatCurrency(totalOutstanding)}</p></div></div></div>
          <div className="card p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-warning-50 p-2.5 text-warning-600"><Wallet size={20} /></div><div><p className="text-xs text-slate-500">صافي الربح</p><p className="font-700 text-lg text-slate-900">{formatCurrency(netProfit)}</p></div></div></div>
          <div className="card p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><FileText size={20} /></div><div><p className="text-xs text-slate-500">عقود نشطة</p><p className="font-700 text-lg text-slate-900">{activeContracts.length}</p></div></div></div>
          <div className="card p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><Receipt size={20} /></div><div><p className="text-xs text-slate-500">مصروفات</p><p className="font-700 text-lg text-slate-900">{formatCurrency(totalExpenses)}</p></div></div></div>
        </div>
      )}

      {tab === 'receivables' && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-lg font-700 text-slate-900">مستحقات العقود</h2>
            <p className="mt-0.5 text-sm text-slate-500">الدفعات المستحقة على العقود</p>
          </div>
          {unpaidContracts.length === 0 ? (
            <div className="card"><EmptyState icon={<CheckCircle2 size={32} />} title="لا توجد مستحقات" description="جميع العقود مدفوعة بالكامل." /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="px-4 py-3 text-right font-600">العميل</th>
                      <th className="px-4 py-3 text-right font-600">العقد</th>
                      <th className="px-4 py-3 text-right font-600">القيمة</th>
                      <th className="px-4 py-3 text-right font-600">المدفوع</th>
                      <th className="px-4 py-3 text-right font-600">المتبقي</th>
                      <th className="px-4 py-3 text-right font-600">الحالة</th>
                      <th className="px-4 py-3 text-right font-600">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidContracts.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-600 text-slate-900">{c.client?.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{c.contract_number}</td>
                        <td className="px-4 py-3 font-600 text-slate-900">{formatCurrency(Number(c.final_amount ?? 0))}</td>
                        <td className="px-4 py-3 text-success-600 font-600">{formatCurrency(Number(c.amount_paid ?? 0))}</td>
                        <td className="px-4 py-3 text-danger-600 font-600">{formatCurrency(Number(c.remaining_balance ?? 0))}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-600',
                            c.payment_status === 'fully_paid' ? 'bg-success-50 text-success-700' :
                            c.payment_status === 'partially_paid' ? 'bg-warning-50 text-warning-700' :
                            'bg-danger-50 text-danger-700',
                          )}>
                            {c.payment_status === 'fully_paid' ? 'مدفوع بالكامل' :
                             c.payment_status === 'partially_paid' ? 'مدفوع جزئياً' :
                             'غير مدفوع'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {Number(c.remaining_balance ?? 0) > 0 && c.payment_status !== 'fully_paid' && c.payment_status !== 'paid' ? (
                            <button
                              onClick={() => { setPaymentTarget(c); setPaymentForm({ amount: '', payment_method: 'نقدي', payment_date: new Date().toISOString().slice(0, 10), notes: '' }); }}
                              className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-600 text-brand-700 hover:bg-brand-100 transition"
                            >
                              <CreditCard size={12} /> تسجيل دفعة
                            </button>
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
                >
                  {recordingPayment ? 'جارٍ التسجيل…' : 'تسجيل الدفعة'}
                </button>
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
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="px-4 py-3 text-right font-600">الموظف</th>
                    <th className="px-4 py-3 text-right font-600">المسمى الوظيفي</th>
                    <th className="px-4 py-3 text-right font-600">الراتب</th>
                    <th className="px-4 py-3 text-right font-600">الشهر</th>
                    <th className="px-4 py-3 text-right font-600">تاريخ الاستحقاق</th>
                    <th className="px-4 py-3 text-right font-600">الحالة</th>
                    <th className="px-4 py-3 text-right font-600">إجراءات</th>
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
          {expenses.length === 0 ? (
            <div className="card"><EmptyState icon={<Receipt size={32} />} title="لا توجد مصروفات" description="اضغط تسجيل مصروف لإضافة مصروف جديد." /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="px-4 py-3 text-right font-600">العنوان</th>
                      <th className="px-4 py-3 text-right font-600">التصنيف</th>
                      <th className="px-4 py-3 text-right font-600">المبلغ</th>
                      <th className="px-4 py-3 text-right font-600">طريقة الدفع</th>
                      <th className="px-4 py-3 text-right font-600">المورد</th>
                      <th className="px-4 py-3 text-right font-600">التاريخ</th>
                      <th className="px-4 py-3 text-right font-600">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-600 text-slate-900">{e.title}</td>
                        <td className="px-4 py-3 text-slate-600">{e.category}</td>
                        <td className="px-4 py-3 font-700 text-slate-900">{formatCurrency(Number(e.amount))}</td>
                        <td className="px-4 py-3 text-slate-600">{e.payment_method ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{e.vendor ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(e.created_at)}</td>
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
            { label: 'تقرير الإيرادات', icon: DollarSign, desc: 'إجمالي الإيرادات من العقود' },
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
