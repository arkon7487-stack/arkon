import { useEffect, useState } from 'react';
import {
  Plus, Boxes, Pencil, Trash2, Search, Package as PackageIcon,
  AlertTriangle, PackageX, TrendingUp, ArrowDownRight, ArrowUpRight,
  ClipboardList, UserPlus, Undo2, Filter,
} from 'lucide-react';
import { inventoryService, type InventoryItemInput } from '@/services/inventoryService';
import type { InventoryCategory, InventoryItem, InventoryMovement, InventoryAssignment, Employee } from '@/types';
import { PageLoader, EmptyState } from '@/components/Feedback';
import { Modal } from '@/components/Modal';
import { ConfirmDialog, NumberInput } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { employeeService } from '@/services/employeeService';

const emptyForm: InventoryItemInput = {
  name: '', sku: '', description: '', unit: 'piece', quantity: 0, min_quantity: 0,
  purchase_price: 0, selling_price: 0, supplier: '', storage_location: '',
};

const MOVEMENT_LABELS: Record<string, string> = {
  purchase: 'شراء', manual_addition: 'إضافة يدوية', manual_deduction: 'خصم يدوي',
  assigned_to_worker: 'تسليم لموظف', returned_by_worker: 'إرجاع من موظف', damaged: 'تالف', lost: 'مفقود',
};

function statusBadge(status: string) {
  switch (status) {
    case 'out_of_stock': return 'bg-danger-50 text-danger-700';
    case 'low_stock': return 'bg-warning-50 text-warning-700';
    default: return 'bg-success-50 text-success-700';
  }
}

function statusLabel(status: string) {
  return status === 'out_of_stock' ? 'نفد المخزون' : status === 'low_stock' ? 'مخزون منخفض' : 'متوفر';
}

type Tab = 'items' | 'movements' | 'assignments';

export function InventoryPage() {
  const toast = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [assignments, setAssignments] = useState<InventoryAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('items');
  const [query, setQuery] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryItemInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<InventoryItem | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignItemId, setAssignItemId] = useState('');
  const [assignEmpId, setAssignEmpId] = useState('');
  const [assignQty, setAssignQty] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const [it, cats, movs, asgns, emps] = await Promise.all([
        inventoryService.listItems(),
        inventoryService.listCategories(),
        inventoryService.listMovements(),
        inventoryService.listAssignments(),
        employeeService.list(),
      ]);
      setItems(it); setCategories(cats); setMovements(movs); setAssignments(asgns); setEmployees(emps);
    } catch (err) { toast.push('error', (err as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setModalOpen(true); };
  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setForm({
      category_id: item.category_id, name: item.name, sku: item.sku ?? '', description: item.description ?? '',
      unit: item.unit, quantity: Number(item.quantity), min_quantity: Number(item.min_quantity),
      purchase_price: Number(item.purchase_price), selling_price: Number(item.selling_price ?? 0),
      supplier: item.supplier ?? '', storage_location: item.storage_location ?? '',
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) { await inventoryService.updateItem(editing.id, form); toast.push('success', 'تم تحديث العنصر'); }
      else { await inventoryService.createItem(form); toast.push('success', 'تم إضافة العنصر'); }
      setModalOpen(false); await load();
    } catch (err) { toast.push('error', (err as Error).message); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    try { await inventoryService.deleteItem(confirmTarget.id); toast.push('success', 'تم حذف العنصر'); await load(); }
    catch (err) { toast.push('error', (err as Error).message); }
    finally { setConfirmTarget(null); }
  };

  const saveCategory = async () => {
    if (!catName.trim()) return;
    try { await inventoryService.createCategory(catName, catDesc); toast.push('success', 'تم إضافة التصنيف'); setCatModalOpen(false); setCatName(''); setCatDesc(''); await load(); }
    catch (err) { toast.push('error', (err as Error).message); }
  };

  const doAssign = async () => {
    if (!assignItemId || !assignEmpId) return;
    try { await inventoryService.assignItem(assignItemId, assignEmpId, assignQty); toast.push('success', 'تم تسليم المعدة'); setAssignModalOpen(false); setAssignItemId(''); setAssignEmpId(''); setAssignQty(1); await load(); }
    catch (err) { toast.push('error', (err as Error).message); }
  };

  const doReturn = async (assignmentId: string) => {
    try { await inventoryService.returnAssignment(assignmentId); toast.push('success', 'تم استلام المعدة'); await load(); }
    catch (err) { toast.push('error', (err as Error).message); }
  };

  const filtered = items.filter((i) => {
    const matchQ = !query || i.name.toLowerCase().includes(query.toLowerCase()) || (i.sku ?? '').toLowerCase().includes(query.toLowerCase());
    const matchCat = filterCat === 'all' || i.category_id === filterCat;
    const matchStatus = filterStatus === 'all' || i.status === filterStatus;
    return matchQ && matchCat && matchStatus;
  });

  const lowStock = items.filter((i) => i.status === 'low_stock').length;
  const outStock = items.filter((i) => i.status === 'out_of_stock').length;

  if (loading) return <PageLoader label="جارٍ تحميل المخزون…" />;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">المخزون</h1>
          <p className="mt-1 text-sm text-slate-500">إدارة المواد والمعدات والمستهلكات</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCatModalOpen(true)} className="btn-ghost"><Plus size={16} /> تصنيف</button>
          <button onClick={openCreate} className="btn-primary"><Plus size={16} /> إضافة عنصر</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><Boxes size={16} /><span className="text-xs">إجمالي العناصر</span></div><p className="mt-2 font-display text-2xl font-700 text-slate-900">{items.length}</p></div>
        <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><PackageIcon size={16} /><span className="text-xs">متوفر</span></div><p className="mt-2 font-display text-2xl font-700 text-success-600">{items.length - lowStock - outStock}</p></div>
        <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><AlertTriangle size={16} /><span className="text-xs">مخزون منخفض</span></div><p className="mt-2 font-display text-2xl font-700 text-warning-600">{lowStock}</p></div>
        <div className="card p-4"><div className="flex items-center gap-2 text-slate-500"><PackageX size={16} /><span className="text-xs">نفد المخزون</span></div><p className="mt-2 font-display text-2xl font-700 text-danger-600">{outStock}</p></div>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {([['items', 'العناصر'], ['movements', 'الحركات'], ['assignments', 'تسليمات الموظفين']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={cn('flex-1 rounded-lg py-2 text-sm font-600 transition', tab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>{label}</button>
        ))}
      </div>

      {tab === 'items' && (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pr-9" placeholder="ابحث بالاسم أو الرمز…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="input max-w-[180px]" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="all">كل التصنيفات</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input max-w-[160px]" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">كل الحالات</option>
              <option value="available">متوفر</option>
              <option value="low_stock">مخزون منخفض</option>
              <option value="out_of_stock">نفد المخزون</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="card"><EmptyState icon={<Boxes size={32} />} title="لا توجد عناصر" description="ابدأ بإضافة عناصر المخزون." action={<button onClick={openCreate} className="btn-primary"><Plus size={16} /> إضافة عنصر</button>} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="px-4 py-3 text-right font-600">الاسم</th>
                    <th className="px-4 py-3 text-right font-600">الرمز</th>
                    <th className="px-4 py-3 text-right font-600">التصنيف</th>
                    <th className="px-4 py-3 text-right font-600">الكمية</th>
                    <th className="px-4 py-3 text-right font-600">سعر الشراء</th>
                    <th className="px-4 py-3 text-right font-600">الحالة</th>
                    <th className="px-4 py-3 text-right font-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-600 text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-slate-600">{item.sku ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{item.category?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(item.purchase_price)}</td>
                      <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-600', statusBadge(item.status))}>{statusLabel(item.status)}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(item)} className="rounded-lg bg-slate-50 p-2 text-brand-600 hover:bg-brand-50"><Pencil size={14} /></button>
                          <button onClick={() => setConfirmTarget(item)} className="rounded-lg bg-slate-50 p-2 text-slate-500 hover:bg-danger-50 hover:text-danger-500"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'movements' && (
        <div className="space-y-2">
          {movements.length === 0 ? <div className="card"><EmptyState icon={<ClipboardList size={32} />} title="لا توجد حركات" /></div> : (
            movements.map((m) => (
              <div key={m.id} className="card flex items-center gap-3 p-4">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', ['purchase', 'manual_addition', 'returned_by_worker'].includes(m.movement_type) ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600')}>
                  {['purchase', 'manual_addition', 'returned_by_worker'].includes(m.movement_type) ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                </div>
                <div className="flex-1">
                  <p className="font-600 text-slate-900">{MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}</p>
                  <p className="text-xs text-slate-500">{m.item?.name ?? '—'} • {m.employee?.full_name ?? ''} • {formatDate(m.created_at)}</p>
                  {m.reason && <p className="text-xs text-slate-400">{m.reason}</p>}
                </div>
                <p className={cn('font-700', ['purchase', 'manual_addition', 'returned_by_worker'].includes(m.movement_type) ? 'text-success-600' : 'text-danger-600')}>
                  {['purchase', 'manual_addition', 'returned_by_worker'].includes(m.movement_type) ? '+' : '-'}{m.quantity}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'assignments' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setAssignModalOpen(true)} className="btn-primary"><UserPlus size={16} /> تسليم لموظف</button>
          </div>
          <div className="space-y-2">
            {assignments.length === 0 ? <div className="card"><EmptyState icon={<UserPlus size={32} />} title="لا توجد تسليمات" /></div> : (
              assignments.map((a) => (
                <div key={a.id} className="card flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600"><PackageIcon size={20} /></div>
                  <div className="flex-1">
                    <p className="font-600 text-slate-900">{a.item?.name ?? '—'}</p>
                    <p className="text-xs text-slate-500">{a.employee?.full_name ?? '—'} • {a.quantity} وحدة</p>
                    <p className="text-xs text-slate-400">تاريخ التسليم: {formatDate(a.assigned_at)}</p>
                  </div>
                  {a.status === 'assigned' ? (
                    <button onClick={() => doReturn(a.id)} className="btn-ghost text-sm"><Undo2 size={14} /> استلام</button>
                  ) : (
                    <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-600 text-success-700">تم الإرجاع</span>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل العنصر' : 'إضافة عنصر جديد'} size="lg"
        footer={<><button onClick={() => setModalOpen(false)} className="btn-ghost">إلغاء</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'جارٍ الحفظ…' : 'حفظ'}</button></>}>
        <form onSubmit={save} className="space-y-4" dir="rtl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="label">الاسم *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">الرمز (SKU)</label><input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div><label className="label">التصنيف</label><select className="input" value={form.category_id ?? ''} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="label">الوحدة</label><input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            <NumberInput label="الكمية الحالية" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v ?? 0 })} min={0} step={1} />
            <NumberInput label="الحد الأدنى" value={form.min_quantity} onChange={(v) => setForm({ ...form, min_quantity: v ?? 0 })} min={0} step={1} />
            <NumberInput label="سعر الشراء *" value={form.purchase_price || undefined} onChange={(v) => setForm({ ...form, purchase_price: v ?? 0 })} min={0} step={0.01} required prefix="₪" />
            <NumberInput label="سعر البيع" value={form.selling_price || undefined} onChange={(v) => setForm({ ...form, selling_price: v ?? 0 })} min={0} step={0.01} prefix="₪" />
            <div><label className="label">المورد</label><input className="input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
            <div><label className="label">موقع التخزين</label><input className="input" value={form.storage_location} onChange={(e) => setForm({ ...form, storage_location: e.target.value })} /></div>
          </div>
          <div><label className="label">الوصف</label><textarea className="input min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </form>
      </Modal>

      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title="إضافة تصنيف" size="sm"
        footer={<><button onClick={() => setCatModalOpen(false)} className="btn-ghost">إلغاء</button><button onClick={saveCategory} className="btn-primary">حفظ</button></>}>
        <div className="space-y-4" dir="rtl">
          <div><label className="label">اسم التصنيف *</label><input className="input" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="مثال: مواد التنظيف" /></div>
          <div><label className="label">الوصف</label><input className="input" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} /></div>
        </div>
      </Modal>

      <Modal open={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="تسليم معدة لموظف" size="sm"
        footer={<><button onClick={() => setAssignModalOpen(false)} className="btn-ghost">إلغاء</button><button onClick={doAssign} className="btn-primary">تسليم</button></>}>
        <div className="space-y-4" dir="rtl">
          <div><label className="label">العنصر *</label><select className="input" value={assignItemId} onChange={(e) => setAssignItemId(e.target.value)}><option value="">—</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
          <div><label className="label">الموظف *</label><select className="input" value={assignEmpId} onChange={(e) => setAssignEmpId(e.target.value)}><option value="">—</option>{employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}</select></div>
          <NumberInput label="الكمية" value={assignQty} onChange={(v) => setAssignQty(v ?? 1)} min={1} step={1} />
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmTarget} onClose={() => setConfirmTarget(null)} onConfirm={confirmDelete} title="حذف العنصر" message="هل أنت متأكد من حذف هذا العنصر؟" confirmLabel="حذف" danger />
    </div>
  );
}
