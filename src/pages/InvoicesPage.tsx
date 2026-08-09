import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { invoiceService } from '@/services/invoiceService';
import type { InvoiceWithRelations } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { StatusBadge } from '@/components/Badge';
import { SearchBar } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, filterByQuery } from '@/lib/utils';
import { PAYMENT_STATUS_LABELS } from '@/lib/locale';

export function InvoicesPage() {
  const toast = useToast();
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

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

  const filtered = filterByQuery(invoices, query, [
    (i: InvoiceWithRelations) => i.invoice_number,
    (i: InvoiceWithRelations) => i.contract?.client?.full_name ?? '',
  ]);

  if (loading) return <PageLoader label="جارٍ تحميل الفواتير…" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-700 text-slate-900">الفواتير</h1>
        <p className="mt-1 text-sm text-slate-500">عرض الفواتير وحالة الدفع. لتسجيل الدفعات استخدم الإدارة المالية ← المستحقات.</p>
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
                  <th className="px-5 py-3">المدفوع</th>
                  <th className="px-5 py-3">المتبقي</th>
                  <th className="px-5 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const paid = Number(inv.amount_paid ?? 0);
                  const remaining = Number(inv.remaining_balance ?? 0);
                  const payStatus = inv.payment_status ?? inv.status;
                  const isPaid = remaining <= 0 || payStatus === 'paid';
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 table-row-hover">
                      <td className="px-5 py-3 font-600 text-slate-800">{inv.invoice_number}</td>
                      <td className="px-5 py-3 text-slate-600">{inv.contract?.client?.full_name ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-500">{formatDate(inv.issue_date)}</td>
                      <td className="px-5 py-3 font-600 text-slate-800">{formatCurrency(Number(inv.total ?? 0))}</td>
                      <td className="px-5 py-3 text-success-600 font-600">{formatCurrency(paid)}</td>
                      <td className={isPaid ? 'px-5 py-3 text-slate-400 font-600' : 'px-5 py-3 text-danger-600 font-600'}>{formatCurrency(remaining)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={payStatus} label={PAYMENT_STATUS_LABELS[payStatus] ?? payStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
