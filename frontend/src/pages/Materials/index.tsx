import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import {
  PackageOpen, Search, ArrowUpDown, AlertCircle, CalendarClock, Box, Plus, Pencil, Trash2, FileSpreadsheet, FileDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import SlideOver from '../../components/ui/SlideOver';
import FormField from '../../components/ui/FormField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';

const MATERIAL_STATUSES = ['ORDERED', 'RELEASED', 'SHIPPED', 'DELIVERED', 'INSTALLED', 'REJECTED'];
const SHOP_STATUSES = ['NOT_REQUIRED', 'NOT_SUBMITTED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED'];
const SYSTEM_CATEGORIES = ['MECHANICAL', 'ELECTRICAL', 'PLUMBING', 'STRUCTURAL', 'ARCHITECTURAL', 'CIVIL', 'FIRE_PROTECTION', 'OTHER'];

interface Material {
  id: string; description: string; quantity: number; unit: string; unitPrice: number | null;
  status: string; systemCategory: string; shopDrawingStatus: string;
  expectedDeliveryDate: string | null; releasedDate: string | null; leadTimeWeeks: number | null;
  notes: string | null; drawingReference: string | null; location: string | null;
  vendor: { companyName: string } | null;
  purchaseOrder: { poNumber: string } | null;
}
interface POOption { id: string; poNumber: string; vendorId: string | null; vendorName: string | null; projectName: string | null; }
interface DropdownOption { id: string; name: string; projectNumber?: string; companyName?: string; poNumber?: string; }

const emptyForm = {
  poId: '', vendorId: '', description: '', quantity: '',
  unit: '', unitPrice: '', status: 'ORDERED', shopDrawingStatus: 'NOT_SUBMITTED',
  systemCategory: 'OTHER', leadTimeWeeks: '', expectedDeliveryDate: '',
  releasedDate: '', notes: '', drawingReference: '', location: ''
};

const statusBadge = (s: string) => ({
  ORDERED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400',
  RELEASED: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-400',
  SHIPPED: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-400',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400',
  INSTALLED: 'bg-slate-800 text-slate-200 border-slate-700',
  REJECTED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400',
} as Record<string, string>)[s] || 'bg-slate-100 text-slate-700 border-slate-200';

const shopBadge = (s: string) => ({
  SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800',
  APPROVED: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800',
  REJECTED: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800',
  REVISION_REQUIRED: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800',
} as Record<string, string>)[s] || 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';

export default function MaterialsIndex() {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const canMutate = ['COMPANY_MANAGER', 'PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COORDINATOR'].includes(user?.role || '');
  const canDelete = ['COMPANY_MANAGER', 'PROJECT_MANAGER', 'PROJECT_ENGINEER'].includes(user?.role || '');

  const [data, setData] = useState<Material[]>([]);
  const [pos, setPOs] = useState<POOption[]>([]);
  const [vendors, setVendors] = useState<DropdownOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortField, setSortField] = useState('calculatedDelivery');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [slideOpen, setSlideOpen] = useState(false);
  const [editingMat, setEditingMat] = useState<Material | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<typeof emptyForm>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const calcDeliveryTs = (mat: Material) => {
    if (mat.expectedDeliveryDate) return new Date(mat.expectedDeliveryDate).getTime();
    if (mat.releasedDate && mat.leadTimeWeeks) return new Date(mat.releasedDate).getTime() + mat.leadTimeWeeks * 604800000;
    if (mat.leadTimeWeeks) return Date.now() + mat.leadTimeWeeks * 604800000;
    return 0;
  };
  const calcDeliveryStr = (mat: Material) => { const ts = calcDeliveryTs(mat); return ts ? new Date(ts).toLocaleDateString() : 'TBD'; };
  const isPastDue = (mat: Material) => { const ts = calcDeliveryTs(mat); return ts > 0 && !['DELIVERED', 'INSTALLED'].includes(mat.status) && ts < Date.now(); };

  const fetchAll = useCallback(async () => {
    if (!activeProject) return;
    try {
      const [matRes, poRes, vendRes] = await Promise.all([
        api.get(`/materials?projectId=${activeProject.id}`),
        api.get(`/purchase-orders?projectId=${activeProject.id}`),
        api.get('/vendors'),
      ]);
      setData(matRes.data);
      setPOs(poRes.data.map((p: any) => ({
        id: p.id,
        poNumber: p.poNumber,
        vendorId: p.vendor?.id || null,
        vendorName: p.vendor?.companyName || null,
        projectName: p.project?.name || null,
      })));
      setVendors(vendRes.data);
    } catch { setError('Failed to load Materials data.'); }
    finally { setIsLoading(false); }
  }, [activeProject]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!activeProject) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-in fade-in zoom-in duration-500">
        <PackageOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Project Required</h2>
        <p className="text-slate-500">Please select an Active Project from the top navigation bar to manage Materials.</p>
      </div>
    );
  }

  const openCreate = () => {
    setEditingMat(null); setForm(emptyForm); setFormErrors({}); setSaveError(''); setSlideOpen(true);
  };
  const openEdit = (m: Material) => {
    setEditingMat(m);
    setForm({
      poId: '', vendorId: '',
      description: m.description, quantity: String(m.quantity), unit: m.unit,
      unitPrice: m.unitPrice != null ? String(m.unitPrice) : '',
      status: m.status, shopDrawingStatus: m.shopDrawingStatus, systemCategory: m.systemCategory,
      leadTimeWeeks: m.leadTimeWeeks != null ? String(m.leadTimeWeeks) : '',
      expectedDeliveryDate: m.expectedDeliveryDate?.split('T')[0] || '',
      releasedDate: m.releasedDate?.split('T')[0] || '',
      notes: m.notes || '', drawingReference: m.drawingReference || '', location: m.location || ''
    });
    setFormErrors({}); setSaveError(''); setSlideOpen(true);
  };

  // When a PO is selected, auto-populate vendorId from that PO
  const handlePOChange = (poId: string) => {
    const po = pos.find(p => p.id === poId);
    setForm(f => ({ ...f, poId, vendorId: po?.vendorId || '' }));
  };

  // Derive the currently linked PO object for display
  const selectedPO = pos.find(p => p.id === form.poId) || null;

  const validate = () => {
    const errors: Partial<typeof emptyForm> = {};
    if (!form.description.trim()) errors.description = 'Description is required';
    if (!form.quantity || isNaN(Number(form.quantity))) errors.quantity = 'Valid quantity is required';
    if (!form.unit.trim()) errors.unit = 'Unit is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true); setSaveError('');
    try {
      const payload = { ...form, projectId: activeProject?.id, quantity: Number(form.quantity), unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined, leadTimeWeeks: form.leadTimeWeeks ? Number(form.leadTimeWeeks) : undefined };
      if (editingMat) await api.patch(`/materials/${editingMat.id}`, payload);
      else await api.post('/materials', payload);
      setSlideOpen(false); await fetchAll();
    } catch (err: any) { setSaveError(err.response?.data?.message || 'Failed to save material.'); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setIsDeleting(true);
    try { await api.delete(`/materials/${deleteTarget.id}`); setDeleteTarget(null); await fetchAll(); }
    catch (err: any) { setDeleteTarget(null); setError(err.response?.data?.message || 'Failed to delete.'); }
    finally { setIsDeleting(false); }
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const uniqueStatuses = Array.from(new Set(data.map(d => d.status)));
  const uniqueCategories = Array.from(new Set(data.map(d => d.systemCategory)));

  const filtered = data
    .filter(m => m.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (statusFilter === 'ALL' || m.status === statusFilter) &&
      (categoryFilter === 'ALL' || m.systemCategory === categoryFilter))
    .sort((a: any, b: any) => {
      let av = sortField === 'vendor.companyName' ? a.vendor?.companyName : sortField === 'calculatedDelivery' ? calcDeliveryTs(a) : a[sortField];
      let bv = sortField === 'vendor.companyName' ? b.vendor?.companyName : sortField === 'calculatedDelivery' ? calcDeliveryTs(b) : b[sortField];
      if (!av && !bv) return 0; if (!av) return sortDir === 'asc' ? 1 : -1; if (!bv) return sortDir === 'asc' ? -1 : 1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const handleExportExcel = () => {
    const exportData = filtered.map(m => ({
      Description: m.description,
      Vendor: m.vendor?.companyName || 'N/A',
      PO: m.purchaseOrder?.poNumber || 'N/A',
      Quantity: m.quantity,
      Unit: m.unit,
      'Unit Price': m.unitPrice || 0,
      'Total Price': m.quantity * (m.unitPrice || 0),
      Status: m.status,
      'System Category': m.systemCategory,
      'Shop Drawing Status': m.shopDrawingStatus,
      'Lead Time (Weeks)': m.leadTimeWeeks || 0,
      'Expected Delivery': calcDeliveryStr(m),
      Location: m.location || ''
    }));
    const dateStr = new Date().toISOString().split('T')[0];
    const projectName = activeProject ? activeProject.name.replace(/\s+/g, '_') : 'All_Projects';
    exportToExcel(exportData, `MATERIALS_LIST_${dateStr}_${projectName}`, 'Materials');
  };

  const handleExportPDF = () => {
    const columns = ['Description', 'Vendor', 'Qty', 'Status', 'Delivery'];
    const body = filtered.map(m => [
      m.description,
      m.vendor?.companyName || 'N/A',
      `${m.quantity} ${m.unit}`,
      m.status,
      calcDeliveryStr(m)
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    const projectName = activeProject ? activeProject.name.replace(/\s+/g, '_') : 'All_Projects';
    exportToPDF(body, columns, `MATERIALS_LIST_${dateStr}_${projectName}`, 'Materials Procurement Tracking');
  };

  const cols = [
    { label: 'Description', field: 'description' },
    { label: 'Vendor', field: 'vendor.companyName' },
    { label: 'Qty / Unit', field: 'quantity' },
    { label: 'Status', field: 'status' },
    { label: 'Expected By', field: 'calculatedDelivery' },
    { label: 'Shop Drawings', field: 'shopDrawingStatus' },
  ];

  return (
    <div className="max-w-[95rem] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <PackageOpen className="w-8 h-8 text-indigo-600 dark:text-indigo-500" /> Materials Tracking Array
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time procurement schedules and delivery forecasting.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportExcel} className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={handleExportPDF} className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm font-medium rounded-lg border border-red-200 dark:border-red-800 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          {canMutate && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors ml-2">
              <Plus className="w-4 h-4" /> New Material
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search Description..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
        </div>
        <div className="flex flex-wrap md:flex-nowrap gap-4">
          {[
            { val: statusFilter, set: setStatusFilter, opts: uniqueStatuses, ph: 'All Statuses' },
            { val: categoryFilter, set: setCategoryFilter, opts: uniqueCategories, ph: 'All Systems' },
          ].map(({ val, set, opts, ph }) => (
            <select key={ph} value={val} onChange={e => set(e.target.value)}
              className="flex-1 lg:w-40 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white cursor-pointer">
              <option value="ALL">{ph}</option>
              {opts.map(o => <option key={o as string} value={o as string}>{(o as string).replace(/_/g, ' ')}</option>)}
            </select>
          ))}
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center gap-3 border border-red-200"><AlertCircle className="w-5 h-5 flex-shrink-0" />{error}</div>}

      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800 uppercase text-[11px] tracking-wider">
              <tr>
                {cols.map(c => (
                  <th key={c.field} onClick={() => handleSort(c.field)} className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 group select-none">
                    <div className="flex items-center gap-2">{c.label} <ArrowUpDown className={`w-3 h-3 ${sortField === c.field ? 'text-indigo-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} /></div>
                  </th>
                ))}
                {(canMutate || canDelete) && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center">
                  <div className="animate-spin h-8 w-8 border-b-2 border-indigo-600 rounded-full mx-auto" />
                  <p className="text-slate-500 mt-4">Loading Materials...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                  <Box className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No Materials Found</p>
                  {canMutate && <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"><Plus className="w-4 h-4" /> Log First Material</button>}
                </td></tr>
              ) : filtered.map(mat => {
                const pastDue = isPastDue(mat);
                const deletable = !['DELIVERED', 'INSTALLED'].includes(mat.status);
                return (
                  <tr key={mat.id} className={`transition-colors group ${pastDue ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white max-w-[240px]">
                      <div className="truncate">{mat.description}</div>
                      <div className="text-xs font-normal text-slate-500 mt-1">{mat.systemCategory.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{mat.vendor?.companyName || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900 dark:text-white">{Number(mat.quantity).toLocaleString()}</span>
                      <span className="text-slate-500 ml-1">{mat.unit}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-extrabold rounded-full border ${statusBadge(mat.status)}`}>{mat.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center gap-2 ${pastDue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                        <CalendarClock className={`w-4 h-4 ${pastDue ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
                        {calcDeliveryStr(mat)}
                        {pastDue && <span className="text-[10px] uppercase bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded text-red-700 dark:text-red-300">LATE</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded border ${shopBadge(mat.shopDrawingStatus)}`}>{mat.shopDrawingStatus.replace(/_/g, ' ')}</span>
                    </td>
                    {(canMutate || canDelete) && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canMutate && <button onClick={() => openEdit(mat)} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>}
                          {canDelete && deletable && <button onClick={() => setDeleteTarget(mat)} className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SlideOver */}
      <SlideOver isOpen={slideOpen} onClose={() => setSlideOpen(false)} width="xl"
        title={editingMat ? 'Edit Material' : 'Log New Material'}
        subtitle={editingMat ? editingMat.description : 'Add a procurement item to a project'}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {!editingMat && (
            <div className="space-y-4">
              {/* PO — optional; auto-fills vendor when selected */}
              <FormField as="select" label="Purchase Order (optional)" value={form.poId} onChange={e => handlePOChange(e.target.value)}>
                <option value="">— No PO yet —</option>
                {pos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.poNumber}{p.vendorName ? ` — ${p.vendorName}` : ''}{p.projectName ? ` · ${p.projectName}` : ''}
                  </option>
                ))}
              </FormField>

              {/* Vendor — read-only if PO selected, manual dropdown otherwise */}
              {selectedPO ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Vendor</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    {selectedPO.vendorName || '—'}
                    <span className="ml-auto text-xs text-slate-400 italic">Inherited from PO</span>
                  </div>
                </div>
              ) : (
                <FormField as="select" label="Vendor (optional)" value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}>
                  <option value="">— No vendor yet —</option>
                  {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.companyName}</option>)}
                </FormField>
              )}
            </div>
          )}

          <FormField as="textarea" label="Description" required placeholder="Detailed material description..."
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} error={formErrors.description} />

          <div className="grid grid-cols-3 gap-4">
            <FormField as="input" type="number" label="Quantity" required placeholder="0"
              value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} error={formErrors.quantity} />
            <FormField as="input" label="Unit" required placeholder="EA, LM, m², etc."
              value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} error={formErrors.unit} />
            <FormField as="input" type="number" label="Unit Price ($)"
              value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} placeholder="0.00" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField as="select" label="System Category" value={form.systemCategory} onChange={e => setForm(f => ({ ...f, systemCategory: e.target.value }))}>
              {SYSTEM_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </FormField>
            <FormField as="select" label="Material Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {MATERIAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField as="select" label="Shop Drawing Status" value={form.shopDrawingStatus} onChange={e => setForm(f => ({ ...f, shopDrawingStatus: e.target.value }))}>
              {SHOP_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </FormField>
            <FormField as="input" type="number" label="Lead Time (weeks)" placeholder="e.g. 4"
              value={form.leadTimeWeeks} onChange={e => setForm(f => ({ ...f, leadTimeWeeks: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField as="input" type="date" label="Released Date" value={form.releasedDate}
              onChange={e => setForm(f => ({ ...f, releasedDate: e.target.value }))} />
            <FormField as="input" type="date" label="Expected Delivery" value={form.expectedDeliveryDate}
              onChange={e => setForm(f => ({ ...f, expectedDeliveryDate: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField as="input" label="Drawing Reference" placeholder="DWG-001"
              value={form.drawingReference} onChange={e => setForm(f => ({ ...f, drawingReference: e.target.value }))} />
            <FormField as="input" label="Site Location" placeholder="Zone A, Level 3..."
              value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>

          <FormField as="textarea" label="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." />

          {saveError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg border border-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{saveError}</div>}

          <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => setSlideOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingMat ? 'Save Changes' : 'Log Material'}
            </button>
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} isLoading={isDeleting}
        title="Delete Material" message={`Delete "${deleteTarget?.description}"? Materials with status DELIVERED or INSTALLED cannot be deleted.`} />
    </div>
  );
}
