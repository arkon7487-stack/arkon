import { useEffect, useState } from 'react';
import {
  Wallet, Plus, Trash2, TrendingUp, TrendingDown, DollarSign,
  Receipt, Calendar, FileText, Search, Download, AlertCircle,
  Users, CheckCircle2, Clock, Play, Sparkles, CreditCard,
} from 'lucide-react';
import { expenseService, type ExpenseInput } from '@/services/expenseService';
import { contractService } from '@/services/contractService';
import { payrollService, type PayrollInput } from '@/services/payrollService';
import { contractPaymentService } from '@/services/contractPaymentService';
import type { Expense, ContractWithRelations, Payroll } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { Modal } from '@/components/Modal';
import { ConfirmDialog, NumberInput } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

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

export function FinancePage() {
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contracts, setContracts] = useState<ContractWithRelations[]>([]);
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
  // Record Payment modal state
  const [paymentTarget, setPaymentTarget] = useState<ContractWithRelations | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'نقدي', payment_date: new Date().toISOString().slice(0, 10), notes: '' });
  const [recordingPayment, setRecordingPayment] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [exp, con, pr] = await Promise.all([expenseService.list(), contractService.list(), payrollService.list()]);
      setExpenses(exp); setContracts(con); setPayroll(pr);
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

  // Financial calculations
  const totalRevenue = contracts.filter((c) => c.status === 'active').reduce((s, c) => s + Number(c.final_amount ?? 0), 0);
  const totalCollected = contracts.reduce((s, c) => s + (Number(c.final_amount ?? 0) - Number(c.remaining_balance ?? 0)), 0);
  const totalOutstanding = contracts.reduce((s, c) => s + Number(c.remaining_balance ?? 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalCollected - totalExpenses;

  const totalCollectedReal = contracts.reduce((s, c) => s + Number(c.amount_paid ?? 0), 0);
  const paidContracts = contracts.filter((c) => c.payment_status === 'fully_paid' || c.payment_status === 'paid').length;
  const partialContracts = contracts.filter((c) => c.payment_status === 'partially_paid' || c.payment_status === 'partial').length;
  const unpaidContracts = contracts.filter((c) => c.payment_status === 'unpaid').length;

  // Monthly data
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlyExpenses = expenses.filter((e) => e.expense_date.startsWith(monthKey)).reduce((s, e) => s + e.amount, 0);

  // Expenses by category
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
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><DollarSign size={16} /><span className="text-xs">إجمالي الإيرادات</span></div><p className="mt-2 font-display text-2xl font-700 text-success-600">{formatCurrency(totalRevenue)}</p></div>
            <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><TrendingDown size={16} /><span className="text-xs">إجمالي المصروفات</span></div><p className="mt-2 font-display text-2xl font-700 text-danger-600">{formatCurrency(totalExpenses)}</p></div>
            <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><TrendingUp size={16} /><span className="text-xs">صافي الربح</span></div><p className={cn('mt-2 font-display text-2xl font-700', netProfit >= 0 ? 'text-success-600' : 'text-danger-600')}>{formatCurrency(netProfit)}</p></div>
            <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><AlertCircle size={16} /><span className="text-xs">مستحقات</span></div><p className="mt-2 font-display text-2xl font-700 text-warning-600">{formatCurrency(totalOutstanding)}</p></div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="card p-4"><p className="text-xs text-slate-500">إيرادات محصّلة فعلياً</p><p className="mt-2 font-display text-xl font-700 text-success-600">{formatCurrency(totalCollectedReal)}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500">عقود مدفوعة</p><p className="mt-2 font-display text-xl font-700 text-success-600">{paidContracts}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500">عقود مدفوعة جزئياً</p><p className="mt-2 font-display text-xl font-700 text-warning-600">{partialContracts}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500">عقود غير مدفوعة</p><p className="mt-2 font-display text-xl font-700 text-danger-600">{unpaidContracts}</p></div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card p-5">
              <h3 className="mb-4 font-600 text-slate-900">المصروفات حسب التصنيف</h3>
              {Object.keys(byCategory).length === 0 ? <p className="text-sm text-slate-400">لا توجد مصروفات</p> : (
                <div className="space-y-2">
                  {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{cat}</span>
                      <span className="font-600 text-slate-900">{formatCurrency(amt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-5">
              <h3 className="mb-4 font-600 text-slate-900">مصروفات هذا الشهر</h3>
              <p className="font-display text-3xl font-700 text-slate-900">{formatCurrency(monthlyExpenses)}</p>
              <p className="mt-1 text-sm text-slate-500">{formatDate(now.toISOString())}</p>
            </div>
          </div>
        </>
      )}

      {tab === 'expenses' && (
        <>
          <div className="relative w-full max-w-xl">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pr-9" placeholder="ابحث في المصروفات…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {filteredExpenses.length === 0 ? (
            <div className="card"><EmptyState icon={<Receipt size={32} />} title="لا توجد مصروفات" action={<button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={16} /> تسجيل مصروف</button>} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="px-4 py-3 text-right font-600">العنوان</th>
                  <th className="px-4 py-3 text-right font-600">التصنيف</th>
                  <th className="px-4 py-3 text-right font-600">المبلغ</th>
                  <th className="px-4 py-3 text-right font-600">طريقة الدفع</th>
                  <th className="px-4 py-3 text-right font-600">المورد</th>
                  <th className="px-4 py-3 text-right font-600">التاريخ</th>
                  <th className="px-4 py-3 text-right font-600">إجراءات</th>
                </tr></thead>
                <tbody>
                  {filteredExpenses.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-600 text-slate-900">{e.title}</td>
                      <td className="px-4 py-3 text-slate-600">{e.category}</td>
                      <td className="px-4 py-3 font-700 text-danger-600">{formatCurrency(e.amount)}</td>
                      <td className="px-4 py-3 text-slate-600">{e.payment_method ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{e.vendor ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(e.expense_date)}</td>
                      <td className="px-4 py-3"><button onClick={() => setConfirmTarget(e)} className="rounded-lg bg-slate-50 p-2 text-slate-500 hover:bg-danger-50 hover:text-danger-500"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'receivables' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-xl">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pr-9" placeholder="ابحث بالعميل أو رقم العقد…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="flex gap-3 text-sm text-slate-600">
              <span>إجمالي المستحقات: <strong className="text-danger-600">{formatCurrency(totalOutstanding)}</strong></span>
              <span>·</span>
              <span>محصّل: <strong className="text-success-600">{formatCurrency(totalCollectedReal)}</strong></span>
            </div>
          </div>
          {filteredReceivables.length === 0 ? (
            <div className="card"><EmptyState icon={<Wallet size={32} />} title="لا توجد مستحقات" description="جميع العقود مدفوعة بالكامل." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="px-4 py-3 text-right font-600">العميل</th>
                  <th className="px-4 py-3 text-right font-600">رقم العقد</th>
                  <th className="px-4 py-3 text-right font-600">قيمة العقد</th>
                  <th className="px-4 py-3 text-right font-600">المدفوع</th>
                  <th className="px-4 py-3 text-right font-600">المتبقي</th>
                  <th className="px-4 py-3 text-right font-600">الاستحقاق</th>
                  <th className="px-4 py-3 text-right font-600">الحالة</th>
                  <th className="px-4 py-3 text-right font-600">إجراءات</th>
                </tr></thead>
                <tbody>
                  {filteredReceivables.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-600 text-slate-900">{c.client?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{c.contract_number ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(Number(c.final_amount ?? 0))}</td>
                      <td className="px-4 py-3 text-success-600 font-600">{formatCurrency(Number(c.amount_paid ?? 0))}</td>
                      <td className="px-4 py-3 text-danger-600 font-700">{formatCurrency(Number(c.remaining_balance ?? 0))}</td>
                      <td className="px-4 py-3 text-slate-600">{c.end_date ? formatDate(c.end_date) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-600', payBadge(c.payment_status))}>
                          {c.payment_status === 'fully_paid' ? 'مدفوع بالكامل' : c.payment_status === 'partially_paid' ? 'مدفوع جزئياً' : payLabel(c.payment_status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setPaymentTarget(c); setPaymentForm({ amount: '', payment_method: 'نقدي', payment_date: new Date().toISOString().slice(0, 10), notes: '' }); }}
                          className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-600 text-brand-700 hover:bg-brand-100 transition"
                        >
                          <CreditCard size={12} /> تسجيل دفعة
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Record Payment Modal */}
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
        </>
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
