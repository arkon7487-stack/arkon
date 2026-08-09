import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Check, User, Package as PackageIcon, FileText, CalendarClock,
  UserCog, type LucideIcon, CheckCircle2, XCircle, Loader2, Plus, Trash2,
  DollarSign, AlertTriangle, Users, Calendar, Clock, MapPin, BarChart3,
  UserPlus, Download, Search, Phone,
} from 'lucide-react';
import { clientService } from '@/services/clientService';
import { packageService } from '@/services/packageService';
import { contractService } from '@/services/contractService';
import { qrService } from '@/services/qrService';
import { leadService } from '@/services/leadService';
import { schedulingEngine, type WorkerAvailabilityInfo, type VisitSlot } from '@/services/schedulingEngine';
import { computeVisitDates, computeEndDate, DAY_NAMES, DAY_NAMES_SHORT, formatCurrency, cn } from '@/lib/utils';
import { NumberInput } from '@/components/ui';
import { CLIENT_STATUS_LABELS } from '@/lib/locale';
import type { Package as PackageType, Lead } from '@/types';
import { PageLoader } from '@/components/Feedback';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type ContractMode = 'standard' | 'quotation';

interface CustomVisit {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  employeeId: string;
}

interface FormData {
  full_name: string;
  phone_number: string;
  email: string;
  address: string;
  service_area: string;
  notes: string;
  status: string;
  contractMode: ContractMode;
  packageId: string;
  startDate: string;
  endDate: string;
  visitDays: number[];
  visitStartTime: string;
  visitEndTime: string;
  employeeId: string;
  customPrice: number;
  customVisits: CustomVisit[];
  serviceNotes: string;
}

const empty: FormData = {
  full_name: '', phone_number: '', email: '', address: '', service_area: '',
  notes: '', status: 'lead', contractMode: 'standard', packageId: '', startDate: '', endDate: '',
  visitDays: [], visitStartTime: '', visitEndTime: '', employeeId: '',
  customPrice: 0, customVisits: [], serviceNotes: '',
};

const STEPS = [
  { key: 'personal', label: 'بيانات العميل', icon: User },
  { key: 'package', label: 'الباقة', icon: PackageIcon },
  { key: 'contract', label: 'العقد', icon: FileText },
  { key: 'visits', label: 'جدولة الزيارات', icon: CalendarClock },
  { key: 'worker', label: 'تعيين الموظف', icon: UserCog },
] as const;

const SALES_STAGES: { key: string; label: string; color: string; bg: string }[] = [
  { key: 'new_lead',       label: 'ليد جديد',    color: 'text-slate-600',   bg: 'bg-slate-100' },
  { key: 'contacted',      label: 'تم التواصل',  color: 'text-blue-600',    bg: 'bg-blue-50' },
  { key: 'follow_up',      label: 'متابعة',       color: 'text-amber-600',   bg: 'bg-amber-50' },
  { key: 'quotation_sent', label: 'تم إرسال عرض', color: 'text-purple-600',  bg: 'bg-purple-50' },
  { key: 'negotiation',    label: 'تفاوض',         color: 'text-orange-600',  bg: 'bg-orange-50' },
  { key: 'won',            label: 'ربح',          color: 'text-success-600', bg: 'bg-success-50' },
];

export function NewClientPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Import-from-Sales state
  const [importMode, setImportMode] = useState<'new' | 'sales' | null>(null);
  const [eligibleLeads, setEligibleLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadQuery, setLeadQuery] = useState('');
  const [leadStageFilter, setLeadStageFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [dupWarning, setDupWarning] = useState<{ name: string; id: string } | null>(null);

  // Pre-fill from a Won lead when navigated via /clients/new?from_lead=...
  const prefill: Partial<FormData> = {
    full_name: searchParams.get('name') ?? '',
    phone_number: searchParams.get('phone') ?? '',
    address: searchParams.get('address') ?? '',
    service_area: searchParams.get('area') ?? '',
    notes: searchParams.get('notes') ?? '',
  };
  const [form, setForm] = useState<FormData>({ ...empty, ...prefill });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [workerSuggestions, setWorkerSuggestions] = useState<WorkerAvailabilityInfo[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [totalConflicts, setTotalConflicts] = useState(0);

  // If navigated with from_lead, auto-select import mode and prefill
  useEffect(() => {
    const fromLeadId = searchParams.get('from_lead');
    if (fromLeadId) {
      setImportMode('sales');
      setLeadsLoading(true);
      leadService.listEligibleForImport().then((leads) => {
        setEligibleLeads(leads);
        const lead = leads.find((l) => l.id === fromLeadId);
        if (lead) {
          setSelectedLead(lead);
          setForm((f) => ({
            ...f,
            full_name: lead.full_name,
            phone_number: lead.phone_number,
            address: lead.address ?? '',
            service_area: lead.area ?? '',
            notes: lead.notes ?? '',
          }));
        }
      }).catch((err) => toast.push('error', (err as Error).message))
        .finally(() => setLeadsLoading(false));
    }
  }, []);

  const loadEligibleLeads = async () => {
    setLeadsLoading(true);
    try {
      const leads = await leadService.listEligibleForImport();
      setEligibleLeads(leads);
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setLeadsLoading(false);
    }
  };

  const selectLead = async (lead: Lead) => {
    // Check for duplicate customer by phone
    try {
      const dup = await clientService.checkDuplicate(lead.phone_number, lead.alternate_phone ?? undefined);
      if (dup.exists && dup.client) {
        setDupWarning({ name: dup.client.full_name, id: dup.client.id });
        return;
      }
    } catch {
      // Non-fatal: proceed with selection
    }
    setSelectedLead(lead);
    setDupWarning(null);
    setForm((f) => ({
      ...f,
      full_name: lead.full_name,
      phone_number: lead.phone_number,
      address: lead.address ?? '',
      service_area: lead.area ?? '',
      notes: lead.notes ?? '',
    }));
  };

  const filteredLeads = eligibleLeads.filter((l) => {
    const q = leadQuery.trim().toLowerCase();
    const matchQ = !q ||
      l.full_name.toLowerCase().includes(q) ||
      l.phone_number.includes(q) ||
      (l.area ?? '').toLowerCase().includes(q);
    const matchStage = leadStageFilter === 'all' || l.stage === leadStageFilter;
    return matchQ && matchStage;
  });

  useEffect(() => {
    (async () => {
      try {
        const pkgs = await packageService.list();
        setPackages(pkgs.filter((p) => p.status === 'active'));
      } catch (err) {
        toast.push('error', (err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedPackage = packages.find((p) => p.id === form.packageId);

  const update = (patch: Partial<FormData>) => setForm((f) => ({ ...f, ...patch }));

  const onPackageSelect = (id: string) => {
    update({ packageId: id });
    const pkg = packages.find((p) => p.id === id);
    if (pkg && pkg.contract_duration_weeks && form.startDate) {
      update({ endDate: computeEndDate(form.startDate, pkg.contract_duration_weeks) });
    }
  };

  const onStartDate = (date: string) => {
    update({ startDate: date });
    if (selectedPackage?.contract_duration_weeks && date) {
      update({ endDate: computeEndDate(date, selectedPackage.contract_duration_weeks) });
    }
  };

  const toggleDay = (day: number) => {
    update({
      visitDays: form.visitDays.includes(day)
        ? form.visitDays.filter((d) => d !== day)
        : [...form.visitDays, day].sort(),
    });
  };

  const addCustomVisit = () => {
    update({
      customVisits: [...form.customVisits, {
        id: Date.now().toString(),
        date: form.startDate || '',
        startTime: '09:00',
        endTime: '10:00',
        employeeId: '',
      }],
    });
  };

  const updateCustomVisit = (id: string, patch: Partial<CustomVisit>) =>
    update({ customVisits: form.customVisits.map((v) => v.id === id ? { ...v, ...patch } : v) });

  const removeCustomVisit = (id: string) =>
    update({ customVisits: form.customVisits.filter((v) => v.id !== id) });

  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!form.full_name.trim()) errs.full_name = 'الاسم الكامل مطلوب';
      if (!form.phone_number.trim()) errs.phone_number = 'رقم الهاتف مطلوب';
    }
    if (s === 1) {
      if (form.contractMode === 'standard' && !form.packageId) errs.packageId = 'اختر باقة';
    }
    if (s === 2) {
      if (!form.startDate) errs.startDate = 'تاريخ البداية مطلوب';
      if (!form.endDate) errs.endDate = 'تاريخ النهاية مطلوب';
      if (form.contractMode === 'quotation' && form.customPrice <= 0) errs.customPrice = 'السعر يجب أن يكون أكبر من صفر';
    }
    if (s === 3) {
      if (form.contractMode === 'standard') {
        if (form.visitDays.length === 0) errs.visitDays = 'اختر يوم زيارة واحد على الأقل';
        if (!form.visitStartTime) errs.visitStartTime = 'وقت البداية مطلوب';
        if (!form.visitEndTime) errs.visitEndTime = 'وقت النهاية مطلوب';
        if (form.visitStartTime && form.visitEndTime && form.visitStartTime >= form.visitEndTime) {
          errs.visitEndTime = 'وقت النهاية يجب أن يكون بعد وقت البداية';
        }
        if (form.visitDays.length > 0 && selectedPackage?.visits_per_week) {
          const perWeek = Number(selectedPackage.visits_per_week);
          if (form.visitDays.length !== perWeek) {
            errs.visitDays = `عدد الأيام يجب أن يساوي ${perWeek} (عدد الزيارات الأسبوعية)`;
          }
        }
      } else {
        if (form.customVisits.length === 0) errs.customVisits = 'أضف زيارة واحدة على الأقل';
        for (const v of form.customVisits) {
          if (!v.date) { errs.customVisits = 'كل زيارة يجب أن يكون لها تاريخ'; break; }
          if (!v.startTime || !v.endTime) { errs.customVisits = 'كل زيارة يجب أن يكون لها وقت'; break; }
          if (v.startTime >= v.endTime) { errs.customVisits = 'وقت النهاية يجب أن يكون بعد وقت البداية'; break; }
        }
      }
    }
    if (s === 4) {
      if (!form.employeeId) {
        errs.employeeId = 'يجب اختيار موظف متاح قبل إنشاء العميل';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const previewDates = selectedPackage && form.startDate && form.endDate && form.contractMode === 'standard'
    ? computeVisitDates(
        form.startDate, form.endDate,
        selectedPackage.visits_per_week ? Number(selectedPackage.visits_per_week) : 1,
        selectedPackage.total_visits ?? undefined,
        form.visitDays,
      )
    : [];

  // Build visit slots from whichever mode is active
  const workerSlots: VisitSlot[] = form.contractMode === 'standard'
    ? previewDates.map((d) => ({ date: d.date, startTime: form.visitStartTime, endTime: form.visitEndTime }))
    : form.customVisits.map((v) => ({ date: v.date, startTime: v.startTime, endTime: v.endTime }));

  // Load worker suggestions when entering step 4 (both modes)
  useEffect(() => {
    if (step !== 4) return;
    if (workerSlots.length === 0) return;

    setLoadingWorkers(true);
    setWorkerSuggestions([]);
    setForm((f) => ({ ...f, employeeId: '' }));

    schedulingEngine.suggestEmployeesForAllDates(workerSlots, form.service_area || undefined)
      .then((result) => {
        setWorkerSuggestions(result.suggestions);
        setTotalConflicts(result.totalConflicts);
      })
      .catch((err) => toast.push('error', (err as Error).message || 'تعذر حل توفر الموظفين'))
      .finally(() => setLoadingWorkers(false));
  }, [step, form.contractMode, form.startDate, form.visitStartTime, form.visitEndTime, form.visitDays.join(','), form.service_area, form.customVisits.map((v) => `${v.date}|${v.startTime}|${v.endTime}`).join(',')]);

  const next = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    if (step === 4) {
      if (!validateStep(4)) return;
      const selected = workerSuggestions.find((w) => w.employee.id === form.employeeId);
      if (!selected) {
        toast.push('error', 'يجب اختيار موظف متاح');
        return;
      }
      if (!selected.available) {
        toast.push('error', 'لا يمكن اختيار موظف غير متاح');
        return;
      }
    }

    setSaving(true);
    try {
      const client = await clientService.create({
        full_name: form.full_name,
        phone_number: form.phone_number,
        email: form.email || undefined,
        address: form.address || undefined,
        service_area: form.service_area || undefined,
        notes: form.notes || undefined,
        status: form.status || 'active',
      });

      // Link client to originating sales lead and opportunity if imported from Sales
      if (selectedLead) {
        const linkUpdate: Record<string, string | null> = { source_sales_lead_id: selectedLead.id };
        if (selectedLead.opportunity_id) {
          linkUpdate.source_opportunity_id = selectedLead.opportunity_id;
        }
        await supabase.from('clients').update(linkUpdate).eq('id', client.id);

        // Mark the sales lead as converted
        await leadService.markConverted(selectedLead.id, client.id, session?.profile?.full_name);

        // Mark the originating opportunity as converted
        if (selectedLead.opportunity_id) {
          await supabase
            .from('opportunities')
            .update({ status: 'converted', converted_client_id: client.id, updated_at: new Date().toISOString() })
            .eq('id', selectedLead.opportunity_id);
        }
      }

      await qrService.generateForClient(client.id);

      if (form.contractMode === 'standard') {
        const contract = await contractService.createFromPackage({
          client_id: client.id,
          package_id: form.packageId,
          employee_id: form.employeeId || undefined,
          start_date: form.startDate,
          end_date: form.endDate,
        });
        await contractService.activate(contract.id, {
          visitDays: form.visitDays,
          startTime: form.visitStartTime,
          endTime: form.visitEndTime,
        });
        toast.push('success', 'تم إنشاء العميل والعقد وجدولة الزيارات بنجاح');
      } else {
        const contract = await contractService.createFromQuotation({
          client_id: client.id,
          start_date: form.startDate,
          end_date: form.endDate,
          custom_price: form.customPrice,
          notes: form.serviceNotes || undefined,
        });
        await contractService.activateQuotation(contract.id, form.customVisits.map((v) => ({
          date: v.date,
          startTime: v.startTime,
          endTime: v.endTime,
          employeeId: form.employeeId || undefined,
        })));
        toast.push('success', 'تم إنشاء العميل وعرض السعر المخصص وجدولة الزيارات بنجاح');
      }

      navigate(`/clients/${client.id}`);
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader label="جاري التحميل…" />;

  const availableCount = workerSuggestions.filter((w) => w.available).length;
  const unavailableCount = workerSuggestions.filter((w) => !w.available).length;
  const isLastStep = step === 4;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 animate-fade-in" dir="rtl">
      <button onClick={() => navigate('/clients')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600">
        <ArrowRight size={16} /> العودة للعملاء
      </button>

      <div>
        <h1 className="font-display text-2xl font-700 text-slate-900">عميل جديد</h1>
        <p className="mt-1 text-sm text-slate-500">أكمل الخطوات لإنشاء عميل وعقد وجدولة زيارات في تدفق واحد.</p>
      </div>

      {/* Import mode chooser — shown first, before the wizard steps */}
      {importMode === null && (
        <div className="card p-6 space-y-4 animate-fade-in">
          <SectionTitle icon={UserPlus} title="اختر طريقة الإنشاء" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => setImportMode('new')}
              className="rounded-xl border-2 border-slate-200 p-5 text-right transition hover:border-brand-300 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <UserPlus size={20} />
                </div>
                <div>
                  <p className="font-600 text-slate-900">عميل جديد</p>
                  <p className="text-xs text-slate-500">إدخال بيانات العميل يدوياً من الصفر</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => { setImportMode('sales'); loadEligibleLeads(); }}
              className="rounded-xl border-2 border-slate-200 p-5 text-right transition hover:border-brand-300 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-50 text-success-600">
                  <Download size={20} />
                </div>
                <div>
                  <p className="font-600 text-slate-900">استيراد من المبيعات</p>
                  <p className="text-xs text-slate-500">اختر عميلاً محتملاً من قسم المبيعات واستكمل بياناته</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Import from Sales — lead selection list */}
      {importMode === 'sales' && !selectedLead && (
        <div className="card p-6 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <SectionTitle icon={Download} title="استيراد من المبيعات" />
            <button onClick={() => setImportMode(null)} className="text-sm text-slate-500 hover:text-brand-600">رجوع</button>
          </div>
          <p className="text-sm text-slate-500">اختر عميلاً محتملاً من قائمة المبيعات. سيتم تعبئة بياناته تلقائياً في نموذج إنشاء العميل.</p>

          {dupWarning && (
            <div className="flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warning-500" />
              <div className="flex-1">
                <p className="font-600 text-warning-800">يوجد عميل بنفس رقم الهاتف</p>
                <p className="text-sm text-warning-700">العميل: {dupWarning.name}</p>
              </div>
              <button onClick={() => navigate(`/clients/${dupWarning.id}`)} className="btn-ghost text-sm">
                فتح ملف العميل <ArrowRight size={14} />
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pr-9" placeholder="ابحث بالاسم، الهاتف، المنطقة…" value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} />
            </div>
            <select className="input max-w-[160px]" value={leadStageFilter} onChange={(e) => setLeadStageFilter(e.target.value)}>
              <option value="all">كل المراحل</option>
              <option value="new_lead">ليد جديد</option>
              <option value="contacted">تم التواصل</option>
              <option value="follow_up">متابعة</option>
              <option value="quotation_sent">تم إرسال عرض</option>
              <option value="negotiation">تفاوض</option>
              <option value="won">ربح</option>
            </select>
          </div>

          {leadsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-brand-500" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm text-slate-400">لا توجد ليدات مؤهلة للاستيراد.</p>
              <p className="mt-1 text-xs text-slate-400">يتم استبعاد الليدات الخاسرة والمحولة بالفعل.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredLeads.map((lead) => {
                const stageInfo = SALES_STAGES.find((s) => s.key === lead.stage);
                return (
                  <button
                    key={lead.id}
                    onClick={() => selectLead(lead)}
                    className="w-full rounded-xl border border-slate-200 p-4 text-right transition hover:border-brand-300 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-600 text-slate-900">{lead.full_name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Phone size={11} /> {lead.phone_number}</p>
                        {lead.area && <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin size={11} /> {lead.area}</p>}
                      </div>
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-600', stageInfo?.bg ?? 'bg-slate-100', stageInfo?.color ?? 'text-slate-600')}>
                        {stageInfo?.label ?? lead.stage}
                      </span>
                    </div>
                    {lead.interested_service && <p className="mt-2 text-xs text-slate-500">الخدمة: {lead.interested_service}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected lead confirmation banner */}
      {importMode === 'sales' && selectedLead && (
        <div className="flex items-center justify-between rounded-xl border border-success-200 bg-success-50 p-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-success-600" />
            <div>
              <p className="text-sm font-600 text-success-800">تم استيراد بيانات العميل المحتمل: {selectedLead.full_name}</p>
              <p className="text-xs text-success-600">راجع البيانات وأكمل بقية خطوات الإنشاء.</p>
            </div>
          </div>
          <button onClick={() => { setSelectedLead(null); setDupWarning(null); }} className="text-sm text-slate-500 hover:text-danger-600">
            تغيير
          </button>
        </div>
      )}

      {/* Step indicators — only shown after import mode is chosen */}
      {importMode !== null && (
      <>
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-600 transition',
                i < step ? 'border-brand-500 bg-brand-500 text-white' :
                i === step ? 'border-brand-500 text-brand-600' : 'border-slate-200 text-slate-400',
              )}
            >
              {i < step ? <Check size={16} /> : i + 1}
            </button>
            <span className={cn('hidden text-sm font-500 sm:block', i === step ? 'text-slate-800' : 'text-slate-400')}>{s.label}</span>
            {i < STEPS.length - 1 && (
              <div className={cn('h-0.5 flex-1 rounded-full', i < step ? 'bg-brand-500' : 'bg-slate-100')} />
            )}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {/* ---- STEP 0: Personal ---- */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <SectionTitle icon={User} title="بيانات العميل" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="الاسم الكامل *" value={form.full_name} onChange={(v) => update({ full_name: v })} error={errors.full_name} />
              <Field label="رقم الهاتف *" value={form.phone_number} onChange={(v) => update({ phone_number: v })} error={errors.phone_number} placeholder="+972 59 000 0000" />
              <Field label="البريد الإلكتروني" value={form.email} onChange={(v) => update({ email: v })} type="email" />
              <Field label="منطقة الخدمة" value={form.service_area} onChange={(v) => update({ service_area: v })} />
            </div>
            <Field label="العنوان" value={form.address} onChange={(v) => update({ address: v })} />
            <div>
              <label className="label">حالة العميل</label>
              <select className="input" value={form.status} onChange={(e) => update({ status: e.target.value })}>
                {Object.entries(CLIENT_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">ملاحظات</label>
              <textarea className="input min-h-16" value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
            </div>
          </div>
        )}

        {/* ---- STEP 1: Package ---- */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <SectionTitle icon={PackageIcon} title="نوع العقد" />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => update({ contractMode: 'standard' })}
                className={cn('rounded-xl border-2 p-4 text-right transition', form.contractMode === 'standard' ? 'border-brand-500 bg-brand-50 shadow-glow' : 'border-slate-200 hover:border-slate-300')}
              >
                <div className="flex items-center gap-2">
                  <PackageIcon size={18} className="text-brand-600" />
                  <span className="font-600 text-slate-900">باقة قياسية</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">زيارات متكررة أسبوعياً حسب قالب الباقة</p>
              </button>
              <button
                onClick={() => update({ contractMode: 'quotation' })}
                className={cn('rounded-xl border-2 p-4 text-right transition', form.contractMode === 'quotation' ? 'border-brand-500 bg-brand-50 shadow-glow' : 'border-slate-200 hover:border-slate-300')}
              >
                <div className="flex items-center gap-2">
                  <DollarSign size={18} className="text-brand-600" />
                  <span className="font-600 text-slate-900">عرض سعر مخصص</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">جدولة مرنة بالكامل وسعر مخصص</p>
              </button>
            </div>

            {form.contractMode === 'standard' && (
              <>
                {errors.packageId && <p className="text-sm text-danger-500">{errors.packageId}</p>}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {packages.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onPackageSelect(p.id)}
                      className={cn('rounded-xl border p-4 text-right transition', form.packageId === p.id ? 'border-brand-500 bg-brand-50 shadow-glow' : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50')}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display font-600 text-slate-900">{p.name}</span>
                        <span className="text-xs text-slate-400">{p.code}</span>
                      </div>
                      {p.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{p.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        <span className="rounded bg-slate-50 px-1.5 py-0.5">{p.contract_duration_weeks ?? '—'} أسبوع</span>
                        <span className="rounded bg-slate-50 px-1.5 py-0.5">{p.visits_per_week ? Number(p.visits_per_week) : '—'} زيارة/أسبوع</span>
                      </div>
                      <p className="mt-2 font-display text-sm font-700 text-brand-600">{formatCurrency(p.final_price)}</p>
                    </button>
                  ))}
                </div>
                {selectedPackage && (
                  <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
                    <p className="mb-2 text-xs font-600 uppercase tracking-wide text-brand-600">تفاصيل الباقة</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                      <Detail label="المدة" value={`${selectedPackage.contract_duration_weeks ?? '—'} أسبوع`} />
                      <Detail label="الزيارات الأسبوعية" value={selectedPackage.visits_per_week ? String(Number(selectedPackage.visits_per_week)) : '—'} />
                      <Detail label="إجمالي الزيارات" value={String(selectedPackage.total_visits ?? '—')} />
                      <Detail label="السعر" value={formatCurrency(selectedPackage.price)} />
                      <Detail label="السعر النهائي" value={formatCurrency(selectedPackage.final_price)} />
                    </div>
                  </div>
                )}
              </>
            )}

            {form.contractMode === 'quotation' && (
              <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
                <p className="text-sm font-600 text-brand-700">عرض سعر مخصص</p>
                <p className="mt-1 text-xs text-slate-600">يمكنك تحديد أيام وأوقات وأسعار مخصصة بالكامل. الزيارات لا تحتاج إلى اتباع نمط أسبوعي ثابت.</p>
              </div>
            )}
          </div>
        )}

        {/* ---- STEP 2: Contract ---- */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <SectionTitle icon={FileText} title="تفاصيل العقد" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="تاريخ البداية *" value={form.startDate} onChange={onStartDate} type="date" error={errors.startDate} />
              <Field label="تاريخ النهاية *" value={form.endDate} onChange={(v) => update({ endDate: v })} type="date" error={errors.endDate} />
            </div>
            {form.contractMode === 'standard' && selectedPackage && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-600 uppercase tracking-wide text-slate-500">معبأ تلقائياً من الباقة</p>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  <Detail label="الباقة" value={selectedPackage.name} />
                  <Detail label="المدة" value={`${selectedPackage.contract_duration_weeks ?? '—'} أسبوع`} />
                  <Detail label="المبلغ النهائي" value={formatCurrency(selectedPackage.final_price)} />
                </div>
              </div>
            )}
            {form.contractMode === 'quotation' && (
              <>
                <div>
                  <NumberInput
                    label="السعر المخصص *"
                    value={form.customPrice || undefined}
                    onChange={(v) => update({ customPrice: v ?? 0 })}
                    min={1}
                    step={0.01}
                    required
                    placeholder="0.00"
                    prefix="₪"
                  />
                  {errors.customPrice && <p className="mt-1 text-xs text-danger-500">{errors.customPrice}</p>}
                </div>
                <div>
                  <label className="label">ملاحظات الخدمة</label>
                  <textarea className="input min-h-16" value={form.serviceNotes} onChange={(e) => update({ serviceNotes: e.target.value })} placeholder="تفاصيل الخدمات المشمولة في عرض السعر" />
                </div>
              </>
            )}
            <p className="text-xs text-slate-500">
              {form.contractMode === 'standard'
                ? 'يتم توليد رقم العقد تلقائياً. في الخطوة التالية، سيتم تخطيط الزيارات. التفعيل يولد جدول الزيارات الكامل ورمز QR للعميل.'
                : 'سيتم إنشاء عقد بعرض السعر المخصص. في الخطوة التالية، ستقوم بتحديد الزيارات المخصصة.'}
            </p>
          </div>
        )}

        {/* ---- STEP 3: Visits / Schedule ---- */}
        {step === 3 && form.contractMode === 'standard' && (
          <div className="space-y-5 animate-fade-in">
            <SectionTitle icon={CalendarClock} title="جدولة الزيارات" />
            <div>
              <label className="label">أيام الزيارات * ({selectedPackage?.visits_per_week ? Number(selectedPackage.visits_per_week) : '—'} أيام مطلوبة)</label>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES.map((name, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={cn('rounded-lg border px-3.5 py-2 text-sm font-500 transition', form.visitDays.includes(i) ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-500 hover:border-slate-300')}
                  >
                    {DAY_NAMES_SHORT[i]}
                  </button>
                ))}
              </div>
              {errors.visitDays && <p className="mt-1 text-sm text-danger-500">{errors.visitDays}</p>}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">وقت بداية الزيارة *</label>
                <input type="time" className="input" value={form.visitStartTime} onChange={(e) => update({ visitStartTime: e.target.value })} />
                {errors.visitStartTime && <p className="mt-1 text-sm text-danger-500">{errors.visitStartTime}</p>}
              </div>
              <div>
                <label className="label">وقت نهاية الزيارة *</label>
                <input type="time" className="input" value={form.visitEndTime} onChange={(e) => update({ visitEndTime: e.target.value })} />
                {errors.visitEndTime && <p className="mt-1 text-sm text-danger-500">{errors.visitEndTime}</p>}
              </div>
            </div>
            {previewDates.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-600 uppercase tracking-wide text-slate-500">معاينة: {previewDates.length} زيارة</p>
                  <span className="text-xs text-brand-600">{selectedPackage?.visits_per_week ? `${Number(selectedPackage.visits_per_week)}/أسبوع` : ''}</span>
                </div>
                <div className="max-h-48 space-y-1.5 overflow-y-auto pl-1">
                  {previewDates.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-md bg-white px-3 py-1.5 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-[11px] font-600 text-brand-600">{i + 1}</span>
                      <span className="text-slate-600">{new Date(d.date).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="text-slate-400">{form.visitStartTime} – {form.visitEndTime}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-xs text-brand-700">
              <p>في الخطوة التالية، سيتم تحليل توفر جميع الموظفين الميدانيين تلقائياً لجميع مواعيد الزيارات المحددة.</p>
            </div>
          </div>
        )}

        {step === 3 && form.contractMode === 'quotation' && (
          <div className="space-y-5 animate-fade-in">
            <SectionTitle icon={CalendarClock} title="جدولة الزيارات المخصصة" />
            {errors.customVisits && <p className="text-sm text-danger-500">{errors.customVisits}</p>}
            {form.customVisits.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                <p className="text-sm text-slate-400">لا توجد زيارات. اضغط "إضافة زيارة" للبدء.</p>
              </div>
            )}
            <div className="space-y-3">
              {form.customVisits.map((v, idx) => (
                <div key={v.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-700 text-brand-600">{idx + 1}</span>
                    <button onClick={() => removeCustomVisit(v.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="label">التاريخ *</label>
                      <input type="date" className="input" value={v.date} onChange={(e) => updateCustomVisit(v.id, { date: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">من *</label>
                      <input type="time" className="input" value={v.startTime} onChange={(e) => updateCustomVisit(v.id, { startTime: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">إلى *</label>
                      <input type="time" className="input" value={v.endTime} onChange={(e) => updateCustomVisit(v.id, { endTime: e.target.value })} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="label">الموظف (اختياري)</label>
                    <input className="input" value={v.employeeId} onChange={(e) => updateCustomVisit(v.id, { employeeId: e.target.value })} placeholder="معرف الموظف" />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addCustomVisit} className="btn-ghost w-full">
              <Plus size={16} /> إضافة زيارة
            </button>
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-xs text-brand-700">
              <p>يمكن لكل زيارة أن تكون في يوم ووقت مختلفين. لا حاجة لاتباع نمط أسبوعي ثابت. يتم توليد رمز QR للعميل تلقائياً.</p>
            </div>
          </div>
        )}

        {/* ---- STEP 4: Worker Assignment (both modes) ---- */}
        {step === 4 && (
          <div className="space-y-5 animate-fade-in">
            <SectionTitle icon={UserCog} title="تعيين الموظف الميداني" />

            {/* Summary Bar */}
            {!loadingWorkers && workerSuggestions.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <SummaryCard icon={Calendar} label="إجمالي الزيارات" value={String(workerSlots.length)} color="brand" />
                <SummaryCard icon={Clock} label="ساعات الخدمة" value={totalServiceHoursFromSlots(workerSlots)} color="brand" />
                <SummaryCard icon={Users} label="موظفون متاحون" value={String(availableCount)} color="success" />
                <SummaryCard icon={XCircle} label="غير متاحون" value={String(unavailableCount)} color="danger" />
                <SummaryCard icon={BarChart3} label="تعارضات مكتشفة" value={String(totalConflicts)} color={totalConflicts > 0 ? 'warning' : 'success'} />
              </div>
            )}

            {loadingWorkers ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 size={28} className="animate-spin text-brand-500" />
                <p className="text-sm font-500 text-slate-600">جاري تحليل توفر الموظفين لجميع مواعيد الزيارات…</p>
                <p className="text-xs text-slate-400">يتم فحص {workerSlots.length} موعد زيارة</p>
              </div>
            ) : workerSuggestions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-400">لا يوجد موظفون ميدانيون نشطون في النظام.</p>
              </div>
            ) : (
              <>
                {!workerSuggestions.some((w) => w.available) && (
                  <div className="flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4">
                    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warning-500" />
                    <div>
                      <p className="font-600 text-warning-800">لا يوجد موظفون متاحون للجدول المحدد</p>
                      <ul className="mt-1 space-y-0.5 text-xs text-warning-700">
                        <li>• قم بتغيير أيام الزيارات أو أوقاتها في الخطوة السابقة</li>
                        <li>• أو أضف موظفاً ميدانياً جديداً إلى النظام</li>
                      </ul>
                    </div>
                  </div>
                )}

                {errors.employeeId && (
                  <p className="text-sm text-danger-500">{errors.employeeId}</p>
                )}

                {/* Available workers */}
                {availableCount > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-600 uppercase tracking-wide text-success-600">
                      متاحون — {availableCount} موظف
                    </p>
                    {workerSuggestions.filter((w) => w.available).map((w) => (
                      <WorkerCard
                        key={w.employee.id}
                        worker={w}
                        selected={form.employeeId === w.employee.id}
                        onSelect={() => update({ employeeId: w.employee.id })}
                      />
                    ))}
                  </div>
                )}

                {/* Unavailable workers */}
                {unavailableCount > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-600 uppercase tracking-wide text-slate-400">
                      غير متاحين — {unavailableCount} موظف
                    </p>
                    {workerSuggestions.filter((w) => !w.available).map((w) => (
                      <WorkerCard
                        key={w.employee.id}
                        worker={w}
                        selected={false}
                        onSelect={() => {}}
                        disabled
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ---- Navigation ---- */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
          <button onClick={back} disabled={step === 0} className="btn-ghost">
            <ArrowRight size={16} /> السابق
          </button>
          {isLastStep ? (
            <button onClick={submit} disabled={saving || loadingWorkers} className="btn-primary">
              {saving ? <><Loader2 size={15} className="animate-spin" /> جاري الإنشاء…</> : 'إنشاء العميل والجدولة'}
            </button>
          ) : (
            <button onClick={next} className="btn-primary">
              التالي <ArrowRight size={16} className="rotate-180" />
            </button>
          )}
        </div>
      </div>
      </>
      )}

    </div>
  );
}

function totalServiceHours(visitCount: number, start: string, end: string): string {
  if (!start || !end) return '—';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const minutesPerVisit = (eh * 60 + em) - (sh * 60 + sm);
  if (minutesPerVisit <= 0) return '—';
  const total = visitCount * minutesPerVisit;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}س ${m}د` : `${h} ساعة`;
}

function totalServiceHoursFromSlots(slots: VisitSlot[]): string {
  if (slots.length === 0) return '—';
  const total = slots.reduce((sum, s) => {
    const [sh, sm] = s.startTime.split(':').map(Number);
    const [eh, em] = s.endTime.split(':').map(Number);
    return sum + ((eh * 60 + em) - (sh * 60 + sm));
  }, 0);
  if (total <= 0) return '—';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}س ${m}د` : `${h} ساعة`;
}

function SummaryCard({ icon: Icon, label, value, color }: {
  icon: LucideIcon; label: string; value: string;
  color: 'brand' | 'success' | 'danger' | 'warning';
}) {
  const colors = {
    brand: 'bg-brand-50 text-brand-600 border-brand-100',
    success: 'bg-success-50 text-success-600 border-success-100',
    danger: 'bg-danger-50 text-danger-600 border-danger-100',
    warning: 'bg-warning-50 text-warning-600 border-warning-100',
  };
  return (
    <div className={cn('rounded-xl border p-3 text-center', colors[color])}>
      <Icon size={16} className="mx-auto mb-1 opacity-70" />
      <p className="text-lg font-700 leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-500 opacity-70">{label}</p>
    </div>
  );
}

function WorkerCard({ worker, selected, onSelect, disabled = false }: {
  worker: WorkerAvailabilityInfo;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const { employee, available, reasons, conflictDetails, availabilityInfo } = worker;

  return (
    <button
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border p-4 text-right transition',
        disabled
          ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-70'
          : selected
            ? 'border-brand-500 bg-brand-50 shadow-glow ring-1 ring-brand-400'
            : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50',
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-700',
            available ? 'bg-success-100 text-success-700' : 'bg-slate-100 text-slate-500',
          )}>
            {employee.full_name.charAt(0)}
          </div>
          <div className="text-right">
            <p className="font-display font-600 text-slate-900">{employee.full_name}</p>
            {employee.job_title && <p className="text-xs text-slate-500">{employee.job_title}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {available ? (
            <span className="flex items-center gap-1 rounded-full bg-success-100 px-2.5 py-1 text-xs font-600 text-success-700">
              <CheckCircle2 size={12} /> متاح
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-danger-100 px-2.5 py-1 text-xs font-600 text-danger-600">
              <XCircle size={12} /> غير متاح
            </span>
          )}
          {selected && <Check size={16} className="text-brand-500" />}
        </div>
      </div>

      {/* Available: show info details */}
      {available && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 sm:grid-cols-3">
          <InfoRow icon={Clock} label="ساعات العمل" value={availabilityInfo.workingHours} />
          <InfoRow icon={Calendar} label="زيارات اليوم" value={`${availabilityInfo.visitsToday} / ${availabilityInfo.maxDailyVisits || '∞'}`} />
          <InfoRow icon={BarChart3} label="المتبقي" value={availabilityInfo.remainingTime} />
          <InfoRow icon={MapPin} label="منطقة الخدمة" value={availabilityInfo.serviceArea} />
          {availabilityInfo.nextVisit && <InfoRow icon={ArrowRight} label="أقرب زيارة" value={availabilityInfo.nextVisit} />}
          {availabilityInfo.lastVisit && <InfoRow icon={Clock} label="آخر زيارة اليوم" value={availabilityInfo.lastVisit} />}
        </div>
      )}

      {/* Unavailable: show conflict details */}
      {!available && conflictDetails.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {conflictDetails.map((cd, i) => (
            <div key={i} className="rounded-lg bg-danger-50/60 px-3 py-2 text-right">
              <p className="text-xs font-600 text-danger-700">{cd.dayName} · {cd.timeRange}</p>
              <p className="mt-0.5 text-xs text-danger-600">{cd.reason}</p>
              {cd.clientName && (
                <p className="mt-0.5 text-xs text-slate-500">
                  مسند إلى: {cd.clientName}
                  {cd.existingTimeRange && <span className="mr-1 text-danger-500">({cd.existingTimeRange})</span>}
                </p>
              )}
            </div>
          ))}
          {reasons.length > conflictDetails.length && (
            <p className="text-xs text-slate-400">+ {reasons.length - conflictDetails.length} تعارض آخر</p>
          )}
        </div>
      )}

      {/* Unavailable: if no conflict details but has reasons */}
      {!available && conflictDetails.length === 0 && reasons.length > 0 && (
        <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2">
          {reasons.map((r, i) => (
            <p key={i} className="text-xs text-danger-500">• {r}</p>
          ))}
        </div>
      )}
    </button>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={11} className="shrink-0 text-slate-400" />
      <span className="text-[11px] text-slate-500">{label}:</span>
      <span className="text-[11px] font-500 text-slate-700">{value}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className="text-brand-600" />
      <p className="font-display text-sm font-600 text-slate-900">{title}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', error, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; error?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-500 text-slate-800">{value}</p>
    </div>
  );
}
