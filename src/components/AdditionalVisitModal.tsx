import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Feedback';
import { useToast } from '@/components/Toast';
import { additionalVisitService } from '@/services/additionalVisitService';
import { clientService } from '@/services/clientService';
import { formatCurrency, cn } from '@/lib/utils';
import { CalendarPlus, Clock, CheckCircle2, XCircle, AlertTriangle, Search } from 'lucide-react';
import type { VisitType, Contract, Employee, Client } from '@/types';

interface AdditionalVisitModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onCreated?: () => void;
}

interface WorkerChoice {
  employee: Employee;
  available: boolean;
  reasons: string[];
}

export function AdditionalVisitModal({ open, onClose, clientId, clientName, onCreated }: AdditionalVisitModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<'select_client' | 'details' | 'worker' | 'confirm'>('details');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [workers, setWorkers] = useState<WorkerChoice[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [resolvedClientId, setResolvedClientId] = useState('');
  const [resolvedClientName, setResolvedClientName] = useState('');

  const [visitType, setVisitType] = useState<VisitType>('additional');
  const [contractId, setContractId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    if (clientId) {
      setResolvedClientId(clientId);
      setResolvedClientName(clientName);
      setStep('details');
    } else {
      setStep('select_client');
      setResolvedClientId('');
      setResolvedClientName('');
    }
  }, [open, clientId, clientName]);

  useEffect(() => {
    if (!open || !resolvedClientId) return;
    setLoadingContracts(true);
    additionalVisitService.getActiveContractsForClient(resolvedClientId)
      .then((c) => {
        setContracts(c);
        if (c.length === 1) setContractId(c[0].id);
      })
      .catch(() => toast.push('error', 'تعذر تحميل العقود'))
      .finally(() => setLoadingContracts(false));
  }, [open, resolvedClientId]);

  const searchClients = useCallback(async () => {
    if (clientSearch.trim().length < 2) { setClientResults([]); return; }
    setSearchingClients(true);
    try {
      const result = await clientService.search(clientSearch.trim());
      setClientResults(result);
    } catch {
      setClientResults([]);
    } finally {
      setSearchingClients(false);
    }
  }, [clientSearch]);

  useEffect(() => {
    const t = setTimeout(searchClients, 300);
    return () => clearTimeout(t);
  }, [searchClients]);

  const loadWorkers = useCallback(async () => {
    if (!date || !startTime || !endTime || !resolvedClientId) return;
    setLoadingWorkers(true);
    try {
      const client = await clientService.get(resolvedClientId);
      const result = await additionalVisitService.getAvailableWorkers(date, startTime, endTime, client?.service_area);
      setWorkers(result);
    } catch {
      toast.push('error', 'تعذر تحميل العمال المتاحين');
    } finally {
      setLoadingWorkers(false);
    }
  }, [date, startTime, endTime, resolvedClientId]);

  useEffect(() => {
    if (step === 'worker') loadWorkers();
  }, [step, loadWorkers]);

  const canProceedDetails = contractId && date && startTime && endTime;
  const availableWorkers = workers.filter((w) => w.available);

  const handleSubmit = async () => {
    if (!contractId || !selectedWorker || !date || !startTime || !endTime) return;
    const charge = Number(chargeAmount) || 0;
    setSubmitting(true);
    try {
      await additionalVisitService.create({
        clientId: resolvedClientId,
        contractId,
        employeeId: selectedWorker,
        visitType,
        scheduledDate: date,
        startTime,
        endTime,
        chargeAmount: charge,
        notes: notes || undefined,
        specialInstructions: specialInstructions || undefined,
      });
      toast.push('success', visitType === 'emergency' ? 'تم إنشاء الزيارة الطارئة بنجاح' : 'تم إنشاء الزيارة الإضافية بنجاح');
      onCreated?.();
      handleClose();
    } catch (err) {
      toast.push('error', (err as Error).message || 'تعذر إنشاء الزيارة');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('details');
    setVisitType('additional');
    setContractId('');
    setDate('');
    setStartTime('');
    setEndTime('');
    setChargeAmount('');
    setNotes('');
    setSpecialInstructions('');
    setSelectedWorker('');
    setWorkers([]);
    setClientSearch('');
    setClientResults([]);
    setResolvedClientId('');
    setResolvedClientName('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="إضافة زيارة"
      subtitle={resolvedClientName || undefined}
      size="lg"
      footer={
        step === 'select_client' ? null : step === 'details' ? (
          <button
            onClick={() => canProceedDetails ? setStep('worker') : undefined}
            disabled={!canProceedDetails}
            className="btn-primary"
          >
            التالي: اختيار العامل
          </button>
        ) : step === 'worker' ? (
          <div className="flex gap-2">
            <button onClick={() => setStep('details')} className="btn-secondary">رجوع</button>
            <button
              onClick={() => selectedWorker ? setStep('confirm') : undefined}
              disabled={!selectedWorker}
              className="btn-primary"
            >
              التالي: تأكيد
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setStep('worker')} className="btn-secondary">رجوع</button>
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              {submitting ? <Spinner size={16} /> : 'إنشاء الزيارة'}
            </button>
          </div>
        )
      }
    >
      <div dir="rtl" className="space-y-4">
        {step === 'select_client' && (
          <div className="space-y-3">
            <label className="block text-sm font-600 text-slate-700">ابحث عن عميل موجود</label>
            <div className="relative">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="اسم العميل أو رقم الهاتف..."
                className="input pr-10"
                autoFocus
              />
            </div>
            {searchingClients && <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner size={16} /> جارٍ البحث...</div>}
            {!searchingClients && clientResults.length > 0 && (
              <div className="max-h-[300px] space-y-1 overflow-y-auto">
                {clientResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setResolvedClientId(c.id);
                      setResolvedClientName(c.full_name);
                      setStep('details');
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-right transition hover:border-brand-300 hover:bg-brand-50/30"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-700 text-slate-600">
                      {c.full_name?.charAt(0) ?? '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-600 text-slate-900">{c.full_name}</p>
                      <p className="text-xs text-slate-500">{c.phone_number}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!searchingClients && clientSearch.length >= 2 && clientResults.length === 0 && (
              <p className="text-sm text-slate-500">لا توجد نتائج</p>
            )}
          </div>
        )}

        {step === 'details' && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-600 text-slate-700">نوع الزيارة</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setVisitType('additional')}
                  className={cn('flex-1 rounded-lg border p-3 text-sm font-600 transition', visitType === 'additional' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
                >
                  <CalendarPlus size={18} className="mb-1 mx-auto" />
                  زيارة إضافية
                </button>
                <button
                  onClick={() => setVisitType('emergency')}
                  className={cn('flex-1 rounded-lg border p-3 text-sm font-600 transition', visitType === 'emergency' ? 'border-danger-500 bg-danger-50 text-danger-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
                >
                  <AlertTriangle size={18} className="mb-1 mx-auto" />
                  زيارة طارئة
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-600 text-slate-700">العقد</label>
              {loadingContracts ? (
                <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner size={16} /> جارٍ التحميل...</div>
              ) : contracts.length === 0 ? (
                <p className="text-sm text-danger-600">لا توجد عقود نشطة لهذا العميل</p>
              ) : (
                <select value={contractId} onChange={(e) => setContractId(e.target.value)} className="input">
                  <option value="">اختر العقد</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contract_number} — {c.package?.name ?? 'باقة'} ({formatCurrency(c.final_amount)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-600 text-slate-700">التاريخ</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-600 text-slate-700">من</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-600 text-slate-700">إلى</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-600 text-slate-700">سعر الزيارة (₪)</label>
              <input type="number" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="0" className="input" />
              <p className="mt-1 text-xs text-slate-500">سيتم إنشاء فاتورة منفصلة بهذا المبلغ. لا يؤثر على قيمة الباقة الأصلية.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-600 text-slate-700">ملاحظات</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input min-h-[60px] resize-none" placeholder="ملاحظات عامة..." />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-600 text-slate-700">تعليمات خاصة للعامل</label>
              <textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} className="input min-h-[60px] resize-none" placeholder="تعليمات خاصة..." />
            </div>
          </>
        )}

        {step === 'worker' && (
          <>
            <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
              <p><strong>{visitType === 'emergency' ? 'زيارة طارئة' : 'زيارة إضافية'}</strong></p>
              <p className="text-xs">{date} من {startTime} إلى {endTime}</p>
            </div>

            {loadingWorkers ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                <Spinner size={20} /> جارٍ البحث عن العمال المتاحين...
              </div>
            ) : availableWorkers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <XCircle size={32} className="text-danger-500" />
                <p className="text-sm font-600 text-slate-700">لا يوجد عامل متاح في هذا الوقت</p>
                <p className="text-xs text-slate-500">يرجى تغيير التاريخ أو الوقت والمحاولة مرة أخرى</p>
                <button onClick={() => setStep('details')} className="btn-secondary mt-2">تغيير الوقت</button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-600 text-slate-700">اختر العامل:</p>
                {workers.map((w) => (
                  <button
                    key={w.employee.id}
                    onClick={() => w.available ? setSelectedWorker(w.employee.id) : undefined}
                    disabled={!w.available}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3 text-right transition',
                      !w.available && 'cursor-not-allowed border-slate-100 bg-slate-50/50 opacity-60',
                      w.available && selectedWorker === w.employee.id && 'border-brand-500 bg-brand-50',
                      w.available && selectedWorker !== w.employee.id && 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <span className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full text-xs font-700',
                      w.available ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700',
                    )}>
                      {w.available ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-600 text-slate-900">{w.employee.full_name}</p>
                      <p className="text-xs text-slate-500">
                        {w.available ? 'متاح' : w.reasons.join(' · ')}
                      </p>
                    </div>
                    {w.available && (
                      <span className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-600',
                        selectedWorker === w.employee.id ? 'bg-brand-600 text-white' : 'bg-success-50 text-success-700',
                      )}>
                        {selectedWorker === w.employee.id ? 'محدد' : 'متاح'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'confirm' && (
          <div className="space-y-3">
            <h3 className="font-display text-base font-700 text-slate-900">تأكيد إنشاء الزيارة</h3>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm">
              <ConfirmRow label="النوع" value={visitType === 'emergency' ? 'زيارة طارئة' : 'زيارة إضافية'} />
              <ConfirmRow label="العميل" value={resolvedClientName} />
              <ConfirmRow label="التاريخ" value={date} />
              <ConfirmRow label="الوقت" value={`${startTime} - ${endTime}`} />
              <ConfirmRow label="السعر" value={formatCurrency(Number(chargeAmount) || 0)} />
              <ConfirmRow label="العامل" value={workers.find((w) => w.employee.id === selectedWorker)?.employee.full_name ?? '—'} />
              {notes && <ConfirmRow label="ملاحظات" value={notes} />}
              {specialInstructions && <ConfirmRow label="تعليمات" value={specialInstructions} />}
            </div>
            <div className="rounded-lg bg-brand-50 p-3 text-xs text-brand-700">
              <p>سيتم إنشاء فاتورة منفصلة بقيمة {formatCurrency(Number(chargeAmount) || 0)} مرتبطة بهذه الزيارة.</p>
              <p className="mt-1">قيمة الباقة الأصلية لن تتأثر.</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="text-left font-600 text-slate-800">{value}</span>
    </div>
  );
}