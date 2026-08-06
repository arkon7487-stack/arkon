import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, User, Package as PackageIcon, Calendar, Lock,
  Clock, Receipt, Paperclip, Activity, Archive, PlayCircle, AlertTriangle,
  Plus, Trash2, Users, CheckCircle2, XCircle, type LucideIcon, Sparkles,
} from 'lucide-react';
import { contractService } from '@/services/contractService';
import { employeeService } from '@/services/employeeService';
import { schedulingEngine, type SchedulingResult, type SchedulingContext } from '@/services/schedulingEngine';
import { daysUntil, computeReminders, formatCurrency, formatDate, formatDateTime, cn } from '@/lib/utils';
import type { ContractWithRelations, Employee, ContractTimelineEntry } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { StatusBadge } from '@/components/Badge';
import { ArkonLogo } from '@/components/ArkonLogo';
import { useToast } from '@/components/Toast';

interface QuotationVisit {
  date: string;
  startTime: string;
  endTime: string;
  employeeId: string;
}

const DEFAULT_START = '09:00';
const DEFAULT_END = '10:00';

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const navigate = useNavigate();
  const [contract, setContract] = useState<ContractWithRelations | null>(null);
  const [timeline, setTimeline] = useState<ContractTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Quotation visit builder state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [quotationVisits, setQuotationVisits] = useState<QuotationVisit[]>([]);
  const [schedulingResults, setSchedulingResults] = useState<Record<number, SchedulingResult | null>>({});
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const isQuotation = contract?.contract_type === 'quotation';
  const isDraft = contract?.status === 'draft';

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, t, emps] = await Promise.all([
        contractService.get(id),
        contractService.getTimeline(id),
        employeeService.list(),
      ]);
      setContract(c);
      setTimeline(t);
      setEmployees(emps.filter((e) => e.employment_status === 'active'));
      if (c?.contract_type === 'quotation' && c.status === 'draft' && quotationVisits.length === 0) {
        // Pre-fill one empty visit row
        setQuotationVisits([{ date: c.start_date, startTime: DEFAULT_START, endTime: DEFAULT_END, employeeId: c.employee_id ?? '' }]);
      }
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const activate = async () => {
    if (!contract) return;
    setActing(true);
    try {
      await contractService.activate(contract.id);
      toast.push('success', 'تم تفعيل العقد. تم قفل التحرير الآن.');
      await load();
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setActing(false);
    }
  };

  const activateQuotation = async () => {
    if (!contract) return;
    if (quotationVisits.length === 0) {
      toast.push('error', 'أضف زيارة واحدة على الأقل قبل التفعيل.');
      return;
    }
    // Validate all visits have dates and times
    const invalid = quotationVisits.some((v) => !v.date || !v.startTime || !v.endTime);
    if (invalid) {
      toast.push('error', 'جميع الزيارات يجب أن تحتوي على تاريخ ووقت بداية ونهاية.');
      return;
    }
    // Block activation if any visit has conflicts
    const hasConflicts = quotationVisits.some((_, i) => {
      const result = schedulingResults[i];
      return result && result.suggestions.some((s) => s.employee.id === quotationVisits[i].employeeId && !s.available);
    });
    if (hasConflicts) {
      toast.push('error', 'يوجد تعارضات في جدولة الزيارات. راجع التحذيرات قبل التفعيل.');
      return;
    }
    setActing(true);
    try {
      await contractService.activateQuotation(
        contract.id,
        quotationVisits.map((v) => ({
          date: v.date,
          startTime: v.startTime,
          endTime: v.endTime,
          employeeId: v.employeeId || undefined,
        })),
      );
      toast.push('success', `تم تفعيل عرض السعر. تم توليد ${quotationVisits.length} زيارة.`);
      await load();
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setActing(false);
    }
  };

  const archive = async () => {
    if (!contract) return;
    if (!confirm('أرشفة هذا العقد؟ يتم الاحتفاظ بالسجلات التاريخية بشكل دائم.')) return;
    setActing(true);
    try {
      await contractService.archive(contract.id);
      toast.push('success', 'تمت أرشفة العقد.');
      await load();
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setActing(false);
    }
  };

  // Quotation visit builder helpers
  const addVisitRow = () => {
    setQuotationVisits([...quotationVisits, { date: contract?.start_date ?? '', startTime: DEFAULT_START, endTime: DEFAULT_END, employeeId: '' }]);
  };

  const removeVisitRow = (index: number) => {
    setQuotationVisits(quotationVisits.filter((_, i) => i !== index));
    setSchedulingResults((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const updateVisit = (index: number, field: keyof QuotationVisit, value: string) => {
    setQuotationVisits((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const checkConflicts = useCallback(async () => {
    if (quotationVisits.length === 0) return;
    setCheckingConflicts(true);
    const results: Record<number, SchedulingResult | null> = {};
    const serviceArea = contract?.client?.service_area;

    await Promise.all(
      quotationVisits.map(async (v, i) => {
        if (!v.date || !v.startTime || !v.endTime) {
          results[i] = null;
          return;
        }
        const ctx: SchedulingContext = {
          date: v.date,
          startTime: v.startTime,
          endTime: v.endTime,
          serviceArea,
          clientId: contract?.client_id,
        };
        try {
          results[i] = await schedulingEngine.suggestEmployees(ctx);
        } catch {
          results[i] = null;
        }
      }),
    );
    setSchedulingResults(results);
    setCheckingConflicts(false);
  }, [quotationVisits, contract]);

  if (loading) return <PageLoader label="جاري تحميل العقد…" />;
  if (!contract) return <EmptyState icon={<FileText size={32} />} title="العقد غير موجود" />;

  const isImmutable = contract.status === 'active' || contract.status === 'archived';
  const reminders = computeReminders([contract]);
  const d = daysUntil(contract.end_date);

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => navigate('/contracts')} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-brand-600">
        <ArrowLeft size={16} /> العودة إلى العقود
      </button>

      {/* Header */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-brand-50 p-3 text-brand-600">
              {isQuotation ? <Sparkles size={24} /> : <FileText size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl font-700 text-slate-900">{contract.contract_number}</h1>
                <StatusBadge status={contract.status} />
                {isQuotation && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-600 text-brand-700">عرض سعر مخصص</span>}
              </div>
              <p className="mt-1 text-sm text-slate-400">
                <Link to={`/clients/${contract.client_id}`} className="text-brand-600 hover:text-brand-800">{contract.client?.full_name}</Link>
                {' · '}<span>{contract.package?.name ?? 'عرض سعر مخصص'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDraft && !isQuotation && (
              <button onClick={activate} disabled={acting} className="btn-primary"><PlayCircle size={16} /> تفعيل</button>
            )}
            {isDraft && isQuotation && (
              <button onClick={activateQuotation} disabled={acting} className="btn-primary"><PlayCircle size={16} /> تفعيل وتوليد الزيارات</button>
            )}
            {(contract.status === 'active' || contract.status === 'expired') && (
              <button onClick={archive} disabled={acting} className="btn-ghost"><Archive size={16} /> أرشفة</button>
            )}
          </div>
        </div>

        {/* Reminder banner */}
        {contract.status === 'active' && reminders.length > 0 && (
          <div className={cn('flex items-center gap-2 border-t px-6 py-3 text-sm', d < 0 ? 'border-danger-500/30 bg-danger-500/10 text-danger-400' : d <= 7 ? 'border-warning-500/30 bg-warning-500/10 text-warning-400' : 'border-brand-200 bg-brand-50 text-brand-600')}>
            <AlertTriangle size={16} />
            {reminders.map((r) => r.label).join(' · ')}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: details + quotation builder */}
        <div className="space-y-4 lg:col-span-2">
          {isImmutable && (
            <div className="card flex items-center gap-3 p-4">
              <Lock size={16} className="text-warning-400" />
              <p className="text-sm text-slate-400">هذا العقد <span className="font-600 text-slate-800">{contract.status}</span> ومقفل. لا يمكن تغيير الباقة والشروط المالية. للتجديد، أنشئ عقداً جديداً.</p>
            </div>
          )}

          {/* Quotation Visit Builder */}
          {isQuotation && isDraft && (
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-brand-600">
                  <Sparkles size={16} />
                  <span className="font-display text-sm font-600">مواعيد الزيارات المخصصة</span>
                </div>
                <button onClick={addVisitRow} className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-600 text-brand-700 hover:bg-brand-100">
                  <Plus size={12} /> إضافة زيارة
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                حدد مواعيد الزيارات وأوقاتها وعيّن الموظف الميداني لكل زيارة. استخدم زر "فحص التعارضات" للتحقق من توفر الموظفين قبل التفعيل.
              </p>

              <div className="mt-4 space-y-3">
                {quotationVisits.map((v, i) => {
                  const result = schedulingResults[i];
                  const selectedEmp = employees.find((e) => e.id === v.employeeId);
                  const hasConflict = result && v.employeeId && result.suggestions.some((s) => s.employee.id === v.employeeId && !s.available);
                  const empStatus = result?.suggestions.find((s) => s.employee.id === v.employeeId);

                  return (
                    <div key={i} className={cn('rounded-xl border p-4', hasConflict ? 'border-danger-300 bg-danger-50/50' : 'border-slate-200 bg-slate-50/50')}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-600 text-slate-500">الزيارة {i + 1}</span>
                        <button onClick={() => removeVisitRow(i)} className="rounded-lg p-1 text-slate-400 hover:bg-danger-50 hover:text-danger-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <label className="label">التاريخ</label>
                          <input type="date" className="input" value={v.date} onChange={(e) => updateVisit(i, 'date', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">البداية</label>
                          <input type="time" className="input" value={v.startTime} onChange={(e) => updateVisit(i, 'startTime', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">النهاية</label>
                          <input type="time" className="input" value={v.endTime} onChange={(e) => updateVisit(i, 'endTime', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">الموظف</label>
                          <select className="input" value={v.employeeId} onChange={(e) => updateVisit(i, 'employeeId', e.target.value)}>
                            <option value="">غير معيّن</option>
                            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Conflict status for this visit's selected employee */}
                      {v.employeeId && empStatus && (
                        <div className={cn('mt-2 flex items-start gap-2 rounded-lg p-2 text-xs', empStatus.available ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700')}>
                          {empStatus.available ? <CheckCircle2 size={14} className="mt-0.5" /> : <XCircle size={14} className="mt-0.5" />}
                          <div>
                            <p className="font-600">{empStatus.available ? 'الموظف متاح' : 'يوجد تعارض — لا يمكن التفعيل'}</p>
                            {!empStatus.available && (
                              <ul className="mt-1 space-y-0.5">
                                {empStatus.reasons.map((r, ri) => <li key={ri}>• {r}</li>)}
                              </ul>
                            )}
                            {empStatus.available && empStatus.reasons.length > 0 && (
                              <p className="text-success-600">{empStatus.reasons.join(' · ')}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Worker availability preview */}
                      {v.date && v.startTime && v.endTime && result && !v.employeeId && (
                        <div className="mt-2 rounded-lg bg-slate-100 p-2 text-xs text-slate-600">
                          <p className="font-600">{result.hasAvailable ? 'موظفون متاحون:' : 'لا يوجد موظفون متاحون لهذا الموعد.'}</p>
                          {result.hasAvailable && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {result.suggestions.filter((s) => s.available).slice(0, 5).map((s) => (
                                <button
                                  key={s.employee.id}
                                  onClick={() => updateVisit(i, 'employeeId', s.employee.id)}
                                  className="rounded-full bg-success-50 px-2 py-0.5 font-600 text-success-700 hover:bg-success-100"
                                >
                                  {s.employee.full_name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {quotationVisits.length === 0 && (
                  <p className="text-sm text-slate-400">لا توجد زيارات. اضغط "إضافة زيارة" للبدء.</p>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button onClick={checkConflicts} disabled={checkingConflicts} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-600 text-slate-700 hover:bg-slate-200">
                  <Users size={14} /> {checkingConflicts ? 'جاري الفحص…' : 'فحص التعارضات'}
                </button>
                <p className="text-xs text-slate-400">يفحص توفر جميع الموظفين لكل زيارة ويعرض التعارضات</p>
              </div>
            </div>
          )}

          {/* Quotation visits summary (after activation) */}
          {isQuotation && !isDraft && (
            <div className="card p-6">
              <div className="flex items-center gap-2 text-brand-600">
                <Sparkles size={16} />
                <span className="font-display text-sm font-600">الزيارات المخصصة</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">تم توليد الزيارات وفق الجدول المخصص. تظهر الآن في لوحة الجدولة وملف العميل.</p>
            </div>
          )}

          <div className="card p-6">
            <p className="mb-4 font-display text-sm font-600 text-slate-900">تفاصيل العقد</p>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <Detail icon={User} label="العميل" value={contract.client?.full_name ?? '—'} />
              <Detail icon={PackageIcon} label="الباقة" value={contract.package?.name ?? 'عرض سعر مخصص'} />
              <Detail icon={User} label="الموظف المعيّن" value={contract.employee?.full_name ?? 'غير معيّن'} />
              <Detail icon={Calendar} label="تاريخ البداية" value={formatDate(contract.start_date)} />
              <Detail icon={Calendar} label="تاريخ النهاية" value={formatDate(contract.end_date)} />
              <Detail icon={Clock} label="المدة" value={`${contract.contract_duration_weeks ?? '—'} أسبوع`} />
            </div>
          </div>

          <div className="card p-6">
            <p className="mb-4 font-display text-sm font-600 text-slate-900">الملخص المالي</p>
            <div className="space-y-2.5 text-sm">
              <FinRow label="السعر" value={formatCurrency(contract.price)} />
              <FinRow label="الخصم" value={`- ${formatCurrency(contract.discount)}`} />
              <FinRow label="الضريبة" value={`${contract.tax}%`} />
              <div className="flex items-center justify-between border-t border-slate-200/80 pt-2.5">
                <span className="text-slate-600">المبلغ النهائي</span>
                <span className="font-display text-lg font-700 text-brand-600">{formatCurrency(contract.final_amount)}</span>
              </div>
              <FinRow label="الرصيد المتبقي" value={formatCurrency(contract.remaining_balance)} />
              <div className="flex items-center justify-between">
                <span className="text-slate-500">حالة الدفع</span>
                <StatusBadge status={contract.payment_status} />
              </div>
            </div>
          </div>

          {contract.notes && (
            <div className="card p-6">
              <p className="mb-2 font-display text-sm font-600 text-slate-900">ملاحظات</p>
              <p className="text-sm text-slate-400">{contract.notes}</p>
            </div>
          )}
        </div>

        {/* Right: timeline + meta */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-600"><Activity size={16} /><span className="font-display text-sm font-600">الجدول الزمني</span></div>
              <div className="opacity-30"><ArkonLogo size={24} /></div>
            </div>
            {timeline.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">لا توجد أحداث بعد.</p>
            ) : (
              <ol className="relative mt-4 space-y-4 border-l border-slate-200/80 pl-6">
                {timeline.map((t) => (
                  <li key={t.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                    <p className="text-sm text-slate-800">{t.message}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(t.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 text-slate-600"><Paperclip size={16} /><span className="font-display text-sm font-600">المرفقات</span></div>
            <p className="mt-3 text-sm text-slate-500">يظهر هنا ملف PDF للعقد الموقع والمستندات الداعمة.</p>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 text-slate-600"><Receipt size={16} /><span className="font-display text-sm font-600">الفواتير</span></div>
            <p className="mt-3 text-sm text-slate-500">تظهر هنا الفواتير المُنشأة من هذا العقد.</p>
          </div>

          <div className="card p-5 text-xs text-slate-500">
            <p>أُنشئ في {formatDateTime(contract.created_at)}</p>
            {contract.activated_at && <p className="mt-1">تم التفعيل {formatDateTime(contract.activated_at)}</p>}
            <p className="mt-1">تم التحديث {formatDateTime(contract.updated_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg bg-slate-100/50 p-2 text-slate-500"><Icon size={16} /></div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-500 text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function FinRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-500 text-slate-800">{value}</span>
    </div>
  );
}
