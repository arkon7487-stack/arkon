import { useEffect, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { auditService } from '@/services/auditService';
import type { AuditLog } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { useToast } from '@/components/Toast';
import { formatDateTime } from '@/lib/utils';

export function AuditPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLogs(await auditService.list(200));
      } catch (err) {
        toast.push('error', (err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageLoader label="جاري تحميل سجل النشاط…" />;

  const filtered = logs.filter((l) =>
    l.action.toLowerCase().includes(query.toLowerCase()) ||
    (l.entity_type ?? '').toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-700 text-slate-900">سجل النشاط</h1>
        <p className="mt-1 text-sm text-slate-500">يتم تسجيل كل إجراء في النظام بشكل دائم. لا شيء يُفقد.</p>
      </div>

      <div className="relative w-full max-w-xl">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-9000" />
        <input className="input pl-9" placeholder="بحث في الإجراءات…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<ScrollText size={32} />} title="لا توجد سجلات نشاط" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-9000">
                  <th className="px-5 py-3">الإجراء</th>
                  <th className="px-5 py-3">الكيان</th>
                  <th className="px-5 py-3">المستخدم</th>
                  <th className="px-5 py-3">IP</th>
                  <th className="px-5 py-3">الوقت</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 table-row-hover">
                    <td className="px-5 py-3 font-600 text-slate-800">{l.action}</td>
                    <td className="px-5 py-3 text-slate-500">{l.entity_type ?? '—'}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ''}</td>
                    <td className="px-5 py-3 text-slate-500">{l.actor_id ? l.actor_id.slice(0, 8) : 'النظام'}</td>
                    <td className="px-5 py-3 text-slate-9000">{l.ip_address ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-9000">{formatDateTime(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
