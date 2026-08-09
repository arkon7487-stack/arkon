import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import { contractService } from '@/services/contractService';
import { daysUntil, formatCurrency, formatDate, cn, filterByQuery } from '@/lib/utils';
import type { ContractWithRelations } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { StatusBadge } from '@/components/Badge';
import { SearchBar } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { CONTRACT_STATUS_LABELS } from '@/lib/locale';

export function ContractsPage() {
  const toast = useToast();
  const [contracts, setContracts] = useState<ContractWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setContracts(await contractService.list());
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filterByQuery(contracts, query, [
    (c: ContractWithRelations) => c.contract_number,
    (c: ContractWithRelations) => c.client?.full_name ?? '',
    (c: ContractWithRelations) => c.package?.name ?? '',
  ]);

  if (loading) return <PageLoader label="جارٍ تحميل العقود…" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">العقود</h1>
          <p className="mt-1 text-sm text-slate-500">سجلات العقود المستقلة. غير قابلة للتعديل بمجرد تفعيلها.</p>
        </div>
        <Link to="/contracts/new" className="btn-primary"><Plus size={16} /> عقد جديد</Link>
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder="بحث في العقود…" />

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FileText size={32} />} title="لا توجد عقود بعد" description="أنشئ عقداً باختيار عميل وباقة." action={<Link to="/contracts/new" className="btn-primary"><Plus size={16} /> إنشاء عقد</Link>} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 text-left text-xs uppercase tracking-wide text-slate-9000">
                  <th className="px-5 py-3">العقد</th>
                  <th className="px-5 py-3">العميل</th>
                  <th className="px-5 py-3">الباقة</th>
                  <th className="px-5 py-3">الموظف</th>
                  <th className="px-5 py-3">تاريخ الانتهاء</th>
                  <th className="px-5 py-3">القيمة</th>
                  <th className="px-5 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const d = daysUntil(c.end_date);
                  return (
                    <tr key={c.id} className="border-b border-slate-200 table-row-hover">
                      <td className="px-5 py-3"><Link to={`/contracts/${c.id}`} className="font-600 text-brand-600 hover:text-brand-200">{c.contract_number}</Link></td>
                      <td className="px-5 py-3 text-slate-600">{c.client?.full_name ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-500">{c.package?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-500">{c.employee?.full_name ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-500">
                        {formatDate(c.end_date)}
                        {c.status === 'active' && (
                          <span className={cn('ml-2 text-[10px]', d <= 7 ? 'text-danger-400' : d <= 30 ? 'text-warning-400' : 'text-slate-600')}>
                            {d < 0 ? 'منتهي' : `${d} يوم`}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-600 text-slate-800">{formatCurrency(c.final_amount)}</td>
                      <td className="px-5 py-3"><StatusBadge status={c.status} label={CONTRACT_STATUS_LABELS[c.status] ?? c.status} /></td>
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

