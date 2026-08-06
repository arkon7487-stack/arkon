import { supabase } from '@/lib/supabase';
import type { SearchResult } from '@/types';

export const searchService = {
  async global(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    const [clients, employees, contracts, visits, invoices, packages, qrCodes] = await Promise.all([
      supabase.from('clients').select('id, full_name, phone_number, service_area').ilike('full_name', `%${q}%`).limit(5),
      supabase.from('employees').select('id, full_name, phone_number, department, position').ilike('full_name', `%${q}%`).limit(5),
      supabase.from('contracts').select('id, contract_number, status').ilike('contract_number', `%${q}%`).limit(5),
      supabase.from('visits').select('id, scheduled_date, status').limit(5),
      supabase.from('invoices').select('id, invoice_number, status').ilike('invoice_number', `%${q}%`).limit(5),
      supabase.from('packages').select('id, name, code').ilike('name', `%${q}%`).limit(5),
      supabase.from('qr_codes').select('id, code_value').ilike('code_value', `%${q}%`).limit(5),
    ]);

    for (const c of clients.data ?? []) {
      results.push({ type: 'client', id: c.id, label: c.full_name, subtitle: c.phone_number, link: `/clients/${c.id}` });
    }
    for (const e of employees.data ?? []) {
      results.push({ type: 'employee', id: e.id, label: e.full_name, subtitle: e.position ?? e.department ?? '', link: `/employees` });
    }
    for (const c of contracts.data ?? []) {
      results.push({ type: 'contract', id: c.id, label: c.contract_number, subtitle: c.status, link: `/contracts/${c.id}` });
    }
    for (const v of visits.data ?? []) {
      results.push({ type: 'visit', id: v.id, label: `Visit ${v.scheduled_date}`, subtitle: v.status, link: `/visits` });
    }
    for (const inv of invoices.data ?? []) {
      results.push({ type: 'invoice', id: inv.id, label: inv.invoice_number, subtitle: inv.status, link: `/invoices` });
    }
    for (const p of packages.data ?? []) {
      results.push({ type: 'package', id: p.id, label: p.name, subtitle: p.code, link: `/packages` });
    }
    for (const qr of qrCodes.data ?? []) {
      results.push({ type: 'qr', id: qr.id, label: qr.code_value, subtitle: 'QR Code', link: `/visits` });
    }

    return results;
  },
};
