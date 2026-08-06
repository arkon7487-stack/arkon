import { useEffect, useState } from 'react';
import { Receipt, Plus, Download } from 'lucide-react';
import { invoiceService } from '@/services/invoiceService';
import { paymentService } from '@/services/paymentService';
import type { InvoiceWithRelations } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { StatusBadge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { SearchBar, NumberInput } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, filterByQuery } from '@/lib/utils';
import { PAYMENT_STATUS_LABELS } from '@/lib/locale';

export function InvoicesPage() {
  const toast = useToast();
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [payModal, setPayModal] = useState<InvoiceWithRelations | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setInvoices(await invoiceService.list());
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const recordPayment = async () => {
    if (!payModal || !payAmount) return;
    setSaving(true);
    try {
      await paymentService.record({
        invoice_id: payModal.id,
        amount: Number(payAmount),
        method: payMethod,
      });
      toast.push('success', 'تم تسجيل الدفع.');
      setPayModal(null);
      setPayAmount('');
      await load();
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = filterByQuery(invoices, query, [
    (i: InvoiceWithRelations) => i.invoice_number,
    (i: InvoiceWithRelations) => i.contract?.client?.full_name ?? '',
  ]);

  if (loading) return <PageLoader label="جارٍ تحميل الفواتير…" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-700 text-slate-900">الفواتير</h1>
        <p className="mt-1 text-sm text-slate-500">إدارة الفواتير والمدفوعات.</p>
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder="بحث في الفواتير…" />

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Receipt size={32} />} title="لا توجد فواتير" description="تُنشأ الفواتير من العقود." /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-9000">
                  <th className="px-5 py-3">الفاتورة</th>
                  <th className="px-5 py-3">العميل</th>
                  <th className="px-5 py-3">تاريخ الإصدار</th>
                  <th className="px-5 py-3">الإجمالي</th>
                  <th className="px-5 py-3">الحالة</th>
                  <th className="px-5 py-3">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 table-row-hover">
                    <td className="px-5 py-3 font-600 text-slate-800">{inv.invoice_number}</td>
                    <td className="px-5 py-3 text-slate-600">{inv.contract?.client?.full_name ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(inv.issue_date)}</td>
                    <td className="px-5 py-3 font-600 text-slate-800">{formatCurrency(inv.total)}</td>
                    <td className="px-5 py-3"><StatusBadge status={inv.status} label={PAYMENT_STATUS_LABELS[inv.status] ?? inv.status} /></td>
                    <td className="px-5 py-3">
                      {inv.status !== 'paid' && (
                        <button onClick={() => { setPayModal(inv); setPayAmount(String(inv.total)); }} className="text-sm text-brand-600 hover:text-brand-200">
                          تسجيل الدفع
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title="تسجيل الدفع"
        subtitle={payModal?.invoice_number}
        size="sm"
        footer={<><button onClick={() => setPayModal(null)} className="btn-ghost">إلغاء</button><button onClick={recordPayment} disabled={saving} className="btn-primary">{saving ? 'جارٍ الحفظ…' : 'تسجيل'}</button></>}
      >
        <div className="space-y-4">
          <NumberInput
            label="المبلغ"
            value={payAmount ? Number(payAmount) : undefined}
            onChange={(v) => setPayAmount(v != null ? String(v) : '')}
            min={0}
            step={0.01}
            placeholder="0.00"
            prefix="₪"
          />
          <div>
            <label className="label">طريقة الدفع</label>
            <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="cash">نقدي</option>
              <option value="card">بطاقة</option>
              <option value="transfer">تحويل بنكي</option>
              <option value="cheque">شيك</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
