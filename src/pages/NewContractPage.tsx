import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Lock, Sparkles, Package as PackageIcon } from 'lucide-react';
import { contractService } from '@/services/contractService';
import { clientService } from '@/services/clientService';
import { packageService } from '@/services/packageService';
import { employeeService } from '@/services/employeeService';
import type { Client, Package, Employee } from '@/types';
import { PageLoader } from '@/components/Feedback';
import { useToast } from '@/components/Toast';
import { computeFinalPrice, computeEndDate, formatCurrency } from '@/lib/utils';
import { NumberInput } from '@/components/ui';

type ContractMode = 'package' | 'quotation';

export function NewContractPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<ContractMode>('package');
  const [clientId, setClientId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [customPrice, setCustomPrice] = useState(0);

  const selectedPackage = packages.find((p) => p.id === packageId);

  useEffect(() => {
    (async () => {
      try {
        const [c, p, e] = await Promise.all([
          clientService.list(),
          packageService.list(),
          employeeService.list(),
        ]);
        setClients(c);
        setPackages(p.filter((pkg) => pkg.status === 'active'));
        setEmployees(e);
      } catch (err) {
        toast.push('error', (err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onPackageSelect = (id: string) => {
    setPackageId(id);
    const pkg = packages.find((p) => p.id === id);
    if (pkg && pkg.contract_duration_weeks && startDate) {
      setEndDate(computeEndDate(startDate, pkg.contract_duration_weeks));
    }
  };

  const onStartDate = (date: string) => {
    setStartDate(date);
    if (mode === 'package' && selectedPackage?.contract_duration_weeks && date) {
      setEndDate(computeEndDate(date, selectedPackage.contract_duration_weeks));
    }
  };

  const price = Number(selectedPackage?.price ?? 0);
  const discount = Number(selectedPackage?.discount ?? 0);
  const tax = Number(selectedPackage?.tax ?? 0);
  const finalAmount = mode === 'quotation'
    ? customPrice
    : selectedPackage ? computeFinalPrice(price, discount, tax) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !startDate || !endDate) {
      toast.push('error', 'العميل وتاريخا البداية والنهاية مطلوبة.');
      return;
    }
    if (mode === 'package' && !packageId) {
      toast.push('error', 'الباقة مطلوبة للعقد القياسي.');
      return;
    }
    if (mode === 'quotation' && customPrice <= 0) {
      toast.push('error', 'السعر المخصص يجب أن يكون أكبر من صفر.');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'package') {
        const contract = await contractService.createFromPackage({
          client_id: clientId,
          package_id: packageId,
          employee_id: employeeId || undefined,
          start_date: startDate,
          end_date: endDate,
          notes,
        });
        toast.push('success', `تم إنشاء العقد ${contract.contract_number} كمسودة.`);
        navigate(`/contracts/${contract.id}`);
      } else {
        const contract = await contractService.createFromQuotation({
          client_id: clientId,
          employee_id: employeeId || undefined,
          start_date: startDate,
          end_date: endDate,
          custom_price: customPrice,
          notes,
        });
        toast.push('success', `تم إنشاء عرض السعر ${contract.contract_number} كمسودة.`);
        navigate(`/contracts/${contract.id}`);
      }
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader label="جاري تحميل النموذج…" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => navigate('/contracts')} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-brand-600">
        <ArrowLeft size={16} /> العودة إلى العقود
      </button>

      <div>
        <h1 className="font-display text-2xl font-700 text-slate-900">عقد جديد</h1>
        <p className="mt-1 text-sm text-slate-400">اختر نوع العقد ثم املأ التفاصيل. التفعيل وزيارة الجدولة تتم من صفحة العقد.</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('package')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-600 transition ${mode === 'package' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <PackageIcon size={16} /> باقة قياسية
        </button>
        <button
          type="button"
          onClick={() => setMode('quotation')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-600 transition ${mode === 'quotation' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Sparkles size={16} /> عرض سعر مخصص
        </button>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">العميل *</label>
                <select className="input" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">اختر العميل…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name} · {c.phone_number}</option>)}
                </select>
              </div>

              {mode === 'package' ? (
                <div>
                  <label className="label">الباقة *</label>
                  <select className="input" required value={packageId} onChange={(e) => onPackageSelect(e.target.value)}>
                    <option value="">اختر الباقة…</option>
                    {packages.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                  </select>
                </div>
              ) : (
                <NumberInput
                  label="السعر المخصص (₪) *"
                  value={customPrice || undefined}
                  onChange={(v) => setCustomPrice(v ?? 0)}
                  min={1}
                  step={0.01}
                  required
                  placeholder="أدخل السعر المتفق عليه…"
                  prefix="₪"
                />
              )}

              <div>
                <label className="label">الموظف المعيّن</label>
                <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                  <option value="">غير معيّن</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name} · {emp.position ?? 'ميداني'}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">تاريخ البداية *</label>
                  <input type="date" className="input" required value={startDate} onChange={(e) => onStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">تاريخ النهاية *</label>
                  <input type="date" className="input" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>
            <div>
              <label className="label">ملاحظات</label>
              <textarea className="input min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {mode === 'quotation' && (
            <div className="card flex items-start gap-3 p-4">
              <Sparkles size={16} className="mt-0.5 text-brand-500" />
              <p className="text-xs text-slate-500">
                بعد إنشاء عرض السعر كمسودة، ستنتقل إلى صفحة العقد حيث يمكنك تحديد مواعيد الزيارات المخصصة
                وتعيين الموظف الميداني مع فحص التعارضات قبل التفعيل — تماماً مثل الباقات القياسية.
              </p>
            </div>
          )}
        </div>

        {/* Preview sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 text-brand-600">
              {mode === 'package' ? <FileText size={16} /> : <Sparkles size={16} />}
              <span className="font-display text-sm font-600">
                {mode === 'package' ? 'ملخص الباقة' : 'ملخص عرض السعر'}
              </span>
            </div>
            {mode === 'package' && !selectedPackage ? (
              <p className="mt-3 text-sm text-slate-400">اختر باقة لملء تفاصيل العقد تلقائياً.</p>
            ) : (
              <dl className="mt-4 space-y-2.5 text-sm">
                {mode === 'package' && selectedPackage && (
                  <>
                    <Preview label="الباقة" value={selectedPackage.name} />
                    <Preview label="الرمز" value={selectedPackage.code} />
                    <Preview label="المدة" value={`${selectedPackage.contract_duration_weeks ?? '—'} أسبوع`} />
                    <Preview label="الزيارات / أسبوع" value={selectedPackage.visits_per_week ? String(Number(selectedPackage.visits_per_week)) : '—'} />
                    <Preview label="إجمالي الزيارات" value={String(selectedPackage.total_visits ?? '—')} />
                    <Preview label="مدة الزيارة" value={selectedPackage.visit_duration_minutes ? `${selectedPackage.visit_duration_minutes} دقيقة` : '—'} />
                    {selectedPackage.default_visit_start_time && <Preview label="الساعات الافتراضية" value={`${selectedPackage.default_visit_start_time} – ${selectedPackage.default_visit_end_time ?? ''}`} />}
                    <div className="border-t border-slate-200/80 pt-2.5">
                      <Preview label="السعر" value={formatCurrency(price)} />
                      <Preview label="الخصم" value={formatCurrency(discount)} />
                      <Preview label="الضريبة" value={`${tax}%`} />
                    </div>
                  </>
                )}
                {mode === 'quotation' && (
                  <>
                    <Preview label="النوع" value="عرض سعر مخصص" />
                    <Preview label="السعر المتفق عليه" value={formatCurrency(customPrice)} />
                    <Preview label="الزيارات" value="تُحدد يدوياً بعد الإنشاء" />
                  </>
                )}
                <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2.5">
                  <span className="text-sm text-slate-600">المبلغ النهائي</span>
                  <span className="font-display text-lg font-700 text-brand-600">{formatCurrency(finalAmount)}</span>
                </div>
              </dl>
            )}
          </div>
          <div className="card flex items-start gap-3 p-4">
            <Lock size={16} className="mt-0.5 text-warning-400" />
            <p className="text-xs text-slate-400">بمجرد التفعيل، يصبح هذا العقد غير قابل للتعديل. لا يمكن تغيير الباقة أو الشروط. للاستمرار في الخدمة بعد الانتهاء، أنشئ عقداً جديداً.</p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'جاري الإنشاء…' : mode === 'package' ? 'إنشاء عقد مسودة' : 'إنشاء عرض سعر مسودة'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-500 text-slate-800">{value}</dd>
    </div>
  );
}
