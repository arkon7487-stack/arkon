import { useEffect, useState } from 'react';
import {
  BarChart3, Users, FileText, Calendar, DollarSign, TrendingUp, Download, Filter,
} from 'lucide-react';
import { clientService } from '@/services/clientService';
import { contractService } from '@/services/contractService';
import { packageService } from '@/services/packageService';
import { employeeService } from '@/services/employeeService';
import { visitService } from '@/services/visitService';
import type { Client, Contract, Package as PackageType, Employee, Visit } from '@/types';
import { PageLoader } from '@/components/Feedback';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { printHtml, buildCsv, downloadCsv } from '@/lib/printExport';

type ReportType = 'overview' | 'clients' | 'employees' | 'visits' | 'contracts' | 'financial';

function buildPrintTable(headers: string[], rows: string[][]): string {
  const ths = headers.map((h) => `<th style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;text-align:right;background:#f8fafc;">${h}</th>`).join('');
  const trs = rows.length === 0
    ? `<tr><td colspan="${headers.length}" style="padding:16px;text-align:center;color:#94a3b8;border:1px solid #e2e8f0;">لا توجد بيانات</td></tr>`
    : rows.map((row) => `<tr>${row.map((c) => `<td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right;">${c}</td>`).join('')}</tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function ReportsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<ReportType>('overview');
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [c, ct, p, e, v] = await Promise.all([
          clientService.list(),
          contractService.list(),
          packageService.list(),
          employeeService.list(),
          visitService.list(),
        ]);
        setClients(c);
        setContracts(ct);
        setPackages(p);
        setEmployees(e);
        setVisits(v as Visit[]);
      } catch (err) {
        toast.push('error', (err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageLoader label="جاري تحميل التقارير…" />;

  const reportTypes: { key: ReportType; label: string; icon: typeof Users }[] = [
    { key: 'overview', label: 'تحليلات لوحة التحكم', icon: BarChart3 },
    { key: 'clients', label: 'تقارير العملاء', icon: Users },
    { key: 'employees', label: 'تقارير الموظفين', icon: TrendingUp },
    { key: 'visits', label: 'تقارير الزيارات', icon: Calendar },
    { key: 'contracts', label: 'تقارير العقود', icon: FileText },
    { key: 'financial', label: 'التقارير المالية', icon: DollarSign },
  ];

  const activeContracts = contracts.filter((c) => c.status === 'active');
  const totalRevenue = activeContracts.reduce((s, c) => s + Number(c.final_amount ?? 0), 0);
  const outstanding = contracts.reduce((s, c) => s + Number(c.remaining_balance ?? 0), 0);
  const completedVisits = visits.filter((v) => v.status === 'completed');
  const pendingVisits = visits.filter((v) => v.status === 'pending' || v.status === 'scheduled');

  const exportCsv = () => {
    let headers: string[] = [];
    let rows: (string | number | null | undefined)[][] = [];

    if (reportType === 'clients') {
      headers = ['Name', 'Phone', 'Email', 'Area', 'Status', 'Created'];
      rows = clients.map((c) => [c.full_name, c.phone_number, c.email ?? '', c.service_area ?? '', c.status, formatDate(c.created_at)]);
    } else if (reportType === 'contracts') {
      headers = ['Contract', 'Client', 'Package', 'Start', 'End', 'Status', 'Value'];
      rows = contracts.map((c) => [c.contract_number, c.client?.full_name ?? '', c.package?.name ?? '', formatDate(c.start_date), formatDate(c.end_date), c.status, formatCurrency(c.final_amount)]);
    } else if (reportType === 'visits') {
      headers = ['Date', 'Client', 'Employee', 'Status', 'Start', 'End'];
      rows = visits.map((v) => [formatDate(v.scheduled_date), v.contract?.client?.full_name ?? '', v.employee?.full_name ?? '', v.status, v.started_at ?? '', v.finished_at ?? '']);
    } else if (reportType === 'employees') {
      headers = ['Name', 'Phone', 'Department', 'Position', 'Status'];
      rows = employees.map((e) => [e.full_name, e.phone_number, e.department ?? '', e.position ?? '', e.employment_status]);
    } else if (reportType === 'financial') {
      headers = ['Contract', 'Client', 'Value', 'Discount', 'Tax', 'Final', 'Balance', 'PaymentStatus'];
      rows = contracts.map((c) => [c.contract_number, c.client?.full_name ?? '', formatCurrency(c.price), formatCurrency(c.discount), `${c.tax}%`, formatCurrency(c.final_amount), formatCurrency(c.remaining_balance), c.payment_status]);
    } else {
      headers = ['Metric', 'Value'];
      rows = [
        ['Total Clients', clients.length],
        ['Active Contracts', activeContracts.length],
        ['Total Revenue', formatCurrency(totalRevenue)],
        ['Outstanding', formatCurrency(outstanding)],
        ['Completed Visits', completedVisits.length],
        ['Pending Visits', pendingVisits.length],
      ];
    }

    const csv = buildCsv(headers, rows);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `arkon-${reportType}-report-${dateStr}.csv`);
    toast.push('success', 'تم تصدير التقرير.');
  };

  const printReport = () => {
    let title = 'تقرير ARKON';
    let tableHtml = '';

    if (reportType === 'overview') {
      title = 'تقرير عام';
      tableHtml = `
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">إجمالي العملاء</td><td style="padding:8px;border:1px solid #e2e8f0;">${clients.length}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">العقود النشطة</td><td style="padding:8px;border:1px solid #e2e8f0;">${activeContracts.length}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">إجمالي الإيرادات</td><td style="padding:8px;border:1px solid #e2e8f0;">${formatCurrency(totalRevenue)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">الرصيد المستحق</td><td style="padding:8px;border:1px solid #e2e8f0;">${formatCurrency(outstanding)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">الزيارات المكتملة</td><td style="padding:8px;border:1px solid #e2e8f0;">${completedVisits.length}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">الزيارات المعلقة</td><td style="padding:8px;border:1px solid #e2e8f0;">${pendingVisits.length}</td></tr>
        </table>`;
    } else if (reportType === 'clients') {
      title = 'تقرير العملاء';
      const headers = ['الاسم', 'الهاتف', 'المنطقة', 'الحالة', 'تاريخ الإنشاء'];
      const data = clients.map((c) => [c.full_name, c.phone_number, c.service_area ?? '—', c.status, formatDate(c.created_at)]);
      tableHtml = buildPrintTable(headers, data);
    } else if (reportType === 'contracts') {
      title = 'تقرير العقود';
      const headers = ['العقد', 'العميل', 'الباقة', 'البداية', 'النهاية', 'الحالة', 'القيمة'];
      const data = contracts.map((c) => [c.contract_number, c.client?.full_name ?? '—', c.package?.name ?? '—', formatDate(c.start_date), formatDate(c.end_date), c.status, formatCurrency(c.final_amount)]);
      tableHtml = buildPrintTable(headers, data);
    } else if (reportType === 'visits') {
      title = 'تقرير الزيارات';
      const headers = ['التاريخ', 'العميل', 'الموظف', 'الحالة', 'بدأت', 'انتهت'];
      const data = visits.map((v) => [formatDate(v.scheduled_date), v.contract?.client?.full_name ?? '—', v.employee?.full_name ?? '—', v.status, v.started_at ? formatDate(v.started_at) : '—', v.finished_at ? formatDate(v.finished_at) : '—']);
      tableHtml = buildPrintTable(headers, data);
    } else if (reportType === 'employees') {
      title = 'تقرير الموظفين';
      const headers = ['الاسم', 'القسم', 'المنصب', 'الحالة', 'الحد اليومي'];
      const data = employees.map((e) => [e.full_name, e.department ?? '—', e.position ?? '—', e.employment_status, String(e.max_daily_visits)]);
      tableHtml = buildPrintTable(headers, data);
    } else if (reportType === 'financial') {
      title = 'التقرير المالي';
      const headers = ['العقد', 'العميل', 'السعر', 'الخصم', 'الضريبة', 'النهائي', 'الرصيد', 'الدفع'];
      const data = contracts.map((c) => [c.contract_number, c.client?.full_name ?? '—', formatCurrency(c.price), formatCurrency(c.discount), `${c.tax}%`, formatCurrency(c.final_amount), formatCurrency(c.remaining_balance), c.payment_status]);
      tableHtml = buildPrintTable(headers, data);
    }

    const body = `
      <div style="text-align:center;margin-bottom:24px;">
        <img src="/756132783_2274483666620765_5282871515405515489_n.jpg" alt="ARKON" style="width:48px;height:48px;border-radius:10px;object-fit:cover;" onerror="this.style.display='none'" />
        <h1 style="font-size:22px;font-weight:700;margin-top:8px;">ARKON</h1>
        <p style="font-size:14px;color:#4f46e5;">${title}</p>
        <p style="font-size:12px;color:#94a3b8;margin-top:4px;">${new Date().toLocaleDateString('ar-EG')}</p>
      </div>
      ${tableHtml}
    `;
    printHtml(title, body);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">التقارير</h1>
          <p className="mt-1 text-sm text-slate-500">تقارير احترافية مع إمكانيات التصدير والطباعة.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn-ghost"><Download size={16} /> تصدير CSV</button>
          <button onClick={printReport} className="btn-ghost"><FileText size={16} /> طباعة</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {reportTypes.map((rt) => (
          <button key={rt.key} onClick={() => setReportType(rt.key)} className={cn('flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-500 transition', reportType === rt.key ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-500 hover:bg-slate-100/50')}>
            <rt.icon size={15} /> {rt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">من تاريخ</label>
          <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">إلى تاريخ</label>
          <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {reportType === 'overview' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="إجمالي العملاء" value={String(clients.length)} icon={Users} />
          <StatCard label="العقود النشطة" value={String(activeContracts.length)} icon={FileText} />
          <StatCard label="إجمالي الإيرادات" value={formatCurrency(totalRevenue)} icon={DollarSign} />
          <StatCard label="الزيارات المكتملة" value={String(completedVisits.length)} icon={Calendar} />
          <StatCard label="الزيارات المعلقة" value={String(pendingVisits.length)} icon={Calendar} />
          <StatCard label="الرصيد المستحق" value={formatCurrency(outstanding)} icon={DollarSign} />
          <StatCard label="الموظفون النشطون" value={String(employees.filter((e) => e.employment_status === 'active').length)} icon={TrendingUp} />
          <StatCard label="باقات الخدمة" value={String(packages.length)} icon={BarChart3} />
        </div>
      )}

      {reportType === 'clients' && (
        <ReportTable title="تقرير العملاء" headers={['الاسم', 'الهاتف', 'المنطقة', 'الحالة', 'تاريخ الإنشاء']} rows={clients.map((c) => [c.full_name, c.phone_number, c.service_area ?? '—', c.status, formatDate(c.created_at)])} />
      )}

      {reportType === 'employees' && (
        <ReportTable title="تقرير الموظفين" headers={['الاسم', 'القسم', 'المنصب', 'الحالة', 'الحد اليومي']} rows={employees.map((e) => [e.full_name, e.department ?? '—', e.position ?? '—', e.employment_status, String(e.max_daily_visits)])} />
      )}

      {reportType === 'visits' && (
        <ReportTable title="تقرير الزيارات" headers={['التاريخ', 'العميل', 'الموظف', 'الحالة', 'بدأت', 'انتهت']} rows={visits.map((v) => [formatDate(v.scheduled_date), v.contract?.client?.full_name ?? '—', v.employee?.full_name ?? '—', v.status, v.started_at ? formatDate(v.started_at) : '—', v.finished_at ? formatDate(v.finished_at) : '—'])} />
      )}

      {reportType === 'contracts' && (
        <ReportTable title="تقرير العقود" headers={['العقد', 'العميل', 'الباقة', 'البداية', 'النهاية', 'الحالة', 'القيمة']} rows={contracts.map((c) => [c.contract_number, c.client?.full_name ?? '—', c.package?.name ?? '—', formatDate(c.start_date), formatDate(c.end_date), c.status, formatCurrency(c.final_amount)])} />
      )}

      {reportType === 'financial' && (
        <ReportTable title="التقرير المالي" headers={['العقد', 'العميل', 'السعر', 'الخصم', 'الضريبة', 'النهائي', 'الرصيد', 'الدفع']} rows={contracts.map((c) => [c.contract_number, c.client?.full_name ?? '—', formatCurrency(c.price), formatCurrency(c.discount), `${c.tax}%`, formatCurrency(c.final_amount), formatCurrency(c.remaining_balance), c.payment_status])} />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-500 uppercase tracking-wide text-slate-9000">{label}</p>
          <p className="mt-2 font-display text-2xl font-700 text-slate-900">{value}</p>
        </div>
        <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><Icon size={20} /></div>
      </div>
    </div>
  );
}

function ReportTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="font-display text-sm font-600 text-slate-900">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-9000">
              {headers.map((h) => <th key={h} className="px-5 py-3 font-500">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={headers.length} className="px-5 py-10 text-center text-slate-9000">لا توجد بيانات متاحة.</td></tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 table-row-hover">
                  {row.map((cell, j) => <td key={j} className="px-5 py-3 text-slate-600">{cell}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
