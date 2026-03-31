import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { ShoppingCart, Search, ArrowUpDown, AlertCircle, FileText, Factory, Filter, Plus, Pencil, Trash2, FileSpreadsheet, FileDown, Download } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { useAuth } from '../../contexts/AuthContext';
import SlideOver from '../../components/ui/SlideOver';
import FormField from '../../components/ui/FormField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const PO_STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED'];

interface PurchaseOrder {
  id: string; poNumber: string; totalAmount: number | null; status: string;
  poDate: string | null; notes: string | null;
  vendor: { companyName: string } | null;
  project: { name: string; projectNumber?: string } | null;
}
interface VendorOption { id: string; companyName: string; }
interface ProjectOption { id: string; name: string; projectNumber: string; }

const emptyForm = {
  poNumber: '', vendorId: '', projectId: '', totalAmount: '',
  status: 'DRAFT', poDate: '', notes: ''
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ISSUED: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800',
    PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800',
    CANCELLED: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800',
    DRAFT: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  };
  return map[status] || map.DRAFT;
};

export default function PurchaseOrderIndex() {
  const { user } = useAuth();
  const canMutate = ['COMPANY_MANAGER', 'PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COORDINATOR'].includes(user?.role || '');
  const canDelete = ['COMPANY_MANAGER', 'PROJECT_MANAGER'].includes(user?.role || '');

  const [data, setData] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [sortField, setSortField] = useState('poDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [slideOpen, setSlideOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<typeof emptyForm>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [posRes, vendorsRes, projectsRes] = await Promise.all([
        api.get('/purchase-orders'),
        api.get('/vendors'),
        api.get('/projects'),
      ]);
      setData(posRes.data);
      setVendors(vendorsRes.data);
      setProjects(projectsRes.data);
    } catch {
      setError('Failed to load Purchase Orders.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setEditingPO(null);
    setForm({ ...emptyForm, poDate: new Date().toISOString().split('T')[0] });
    setFormErrors({});
    setSaveError('');
    setSlideOpen(true);
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditingPO(po);
    setForm({
      poNumber: po.poNumber,
      vendorId: '',
      projectId: '',
      totalAmount: String(po.totalAmount ?? ''),
      status: po.status,
      poDate: po.poDate ? po.poDate.split('T')[0] : '',
      notes: po.notes || ''
    });
    setFormErrors({});
    setSaveError('');
    setSlideOpen(true);
  };

  const validate = (): boolean => {
    const errors: Partial<typeof emptyForm> = {};
    if (!form.poNumber.trim()) errors.poNumber = 'PO Number is required';
    if (!editingPO && !form.vendorId) errors.vendorId = 'Vendor is required';
    if (!editingPO && !form.projectId) errors.projectId = 'Project is required';
    if (!form.totalAmount || isNaN(Number(form.totalAmount))) errors.totalAmount = 'Valid amount is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const payload = { ...form, totalAmount: Number(form.totalAmount) };
      if (editingPO) {
        await api.patch(`/purchase-orders/${editingPO.id}`, payload);
      } else {
        await api.post('/purchase-orders', payload);
      }
      setSlideOpen(false);
      await fetchAll();
    } catch (err: any) {
      setSaveError(err.response?.data?.message || 'Failed to save Purchase Order.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/purchase-orders/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchAll();
    } catch (err: any) {
      setDeleteTarget(null);
      setError(err.response?.data?.message || 'Failed to delete PO.');
    } finally {
      setIsDeleting(false);
    }
  };

  const uniqueProjects = Array.from(new Set(data.map(d => d.project?.name).filter(Boolean)));
  const uniqueStatuses = Array.from(new Set(data.map(d => d.status)));

  const filtered = data
    .filter(item => {
      return item.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (statusFilter === 'ALL' || item.status === statusFilter) &&
        (projectFilter === 'ALL' || item.project?.name === projectFilter);
    })
    .sort((a: any, b: any) => {
      let av = sortField.includes('.') ? (sortField === 'vendor.companyName' ? a.vendor?.companyName : a.project?.name) : a[sortField];
      let bv = sortField.includes('.') ? (sortField === 'vendor.companyName' ? b.vendor?.companyName : b.project?.name) : b[sortField];
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const cols = [
    { label: 'PO Number', field: 'poNumber' },
    { label: 'Vendor', field: 'vendor.companyName' },
    { label: 'Project', field: 'project.name' },
    { label: 'Date', field: 'poDate' },
    { label: 'Total Amount', field: 'totalAmount' },
    { label: 'Status', field: 'status' },
  ];

  const handleExportExcel = () => {
    const exportData = filtered.map(po => ({
      'PO Number': po.poNumber,
      Vendor: po.vendor?.companyName || '—',
      Project: po.project?.name || '—',
      Date: po.poDate ? po.poDate.split('T')[0] : '—',
      Amount: po.totalAmount || 0,
      Status: po.status
    }));
    const dateStr = new Date().toISOString().split('T')[0];
    const projectName = (projectFilter === 'ALL' ? 'All_Projects' : projectFilter).replace(/\s+/g, '_');
    exportToExcel(exportData, `PO_LIST_${dateStr}_${projectName}`, 'Purchase Orders');
  };

  const handleExportPDF = () => {
    const columns = ['PO #', 'Vendor', 'Project', 'Date', 'Amount', 'Status'];
    const body = filtered.map(po => [
      po.poNumber,
      po.vendor?.companyName || '',
      po.project?.name || '',
      po.poDate ? po.poDate.split('T')[0] : '',
      `$${(po.totalAmount || 0).toLocaleString()}`,
      po.status
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    const projectName = (projectFilter === 'ALL' ? 'All_Projects' : projectFilter).replace(/\s+/g, '_');
    exportToPDF(body, columns, `PO_LIST_${dateStr}_${projectName}`, 'Purchase Order Register');
  };

  const handleExportDetailPDF = (po: PurchaseOrder) => {
    const columns = ['Field', 'Details'];
    const body = [
      ['PO Number', po.poNumber],
      ['Vendor', po.vendor?.companyName || '—'],
      ['Project', po.project?.name || '—'],
      ['Date', po.poDate ? po.poDate.split('T')[0] : '—'],
      ['Amount', po.totalAmount != null ? `$${Number(po.totalAmount).toLocaleString()}` : '—'],
      ['Status', po.status],
      ['Notes', po.notes || '—']
    ];
    exportToPDF(body, columns, `PO_${po.poNumber}`, `Purchase Order: ${po.poNumber}`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-blue-600 dark:text-blue-500" />
            Purchase Orders Registry
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage vendor financial commitments and external orders.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportExcel} className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={handleExportPDF} className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm font-medium rounded-lg border border-red-200 dark:border-red-800 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          {canMutate && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
              <Plus className="w-4 h-4" /> New PO
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search PO Number..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="w-full sm:w-44 pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white cursor-pointer">
              <option value="ALL">All Statuses</option>
              {uniqueStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="relative">
            <Factory className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
              className="w-full sm:w-44 pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white cursor-pointer">
              <option value="ALL">All Projects</option>
              {uniqueProjects.map(p => <option key={p as string} value={p as string}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center gap-3 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800 uppercase text-[11px] tracking-wider">
              <tr>
                {cols.map(c => (
                  <th key={c.field} onClick={() => handleSort(c.field)}
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 group select-none">
                    <div className="flex items-center gap-2">
                      {c.label}
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortField === c.field ? 'text-blue-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
                    </div>
                  </th>
                ))}
                {(canMutate || canDelete) && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center">
                  <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto" />
                  <p className="text-slate-500 mt-4">Loading Purchase Orders...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                  <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No Purchase Orders Found</p>
                  {canMutate && <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"><Plus className="w-4 h-4" /> Create First PO</button>}
                </td></tr>
              ) : filtered.map(po => (
                <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">{po.poNumber}</td>
                  <td className="px-6 py-4 font-medium">{po.vendor?.companyName || '—'}</td>
                  <td className="px-6 py-4 text-slate-500">{po.project?.name || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{po.poDate ? new Date(po.poDate).toLocaleDateString() : '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-white">
                    {po.totalAmount != null ? `$${Number(po.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-bold rounded-md border ${statusBadge(po.status)}`}>
                      {po.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  {(canMutate || canDelete) && (
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleExportDetailPDF(po)} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Download PDF">
                          <Download className="w-4 h-4" />
                        </button>
                        {canMutate && (
                          <button onClick={() => openEdit(po)} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && ['DRAFT', 'CANCELLED'].includes(po.status) && (
                          <button onClick={() => setDeleteTarget(po)} className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SlideOver */}
      <SlideOver isOpen={slideOpen} onClose={() => setSlideOpen(false)}
        title={editingPO ? 'Edit Purchase Order' : 'New Purchase Order'}
        subtitle={editingPO ? `PO ${editingPO.poNumber}` : 'Create a new vendor financial commitment'}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField as="input" label="PO Number" required placeholder="e.g. PO-2024-001"
            value={form.poNumber} onChange={e => setForm(f => ({ ...f, poNumber: e.target.value }))}
            error={formErrors.poNumber} disabled={!!editingPO} />

          {!editingPO && (
            <>
              <FormField as="select" label="Vendor" required
                value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}
                error={formErrors.vendorId}>
                <option value="">— Select Vendor —</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.companyName}</option>)}
              </FormField>
              <FormField as="select" label="Project" required
                value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                error={formErrors.projectId}>
                <option value="">— Select Project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>)}
              </FormField>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField as="input" type="number" label="Total Amount ($)" required placeholder="0.00"
              value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
              error={formErrors.totalAmount} />
            <FormField as="input" type="date" label="PO Date"
              value={form.poDate} onChange={e => setForm(f => ({ ...f, poDate: e.target.value }))} />
          </div>

          <FormField as="select" label="Status" value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {PO_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </FormField>

          <FormField as="textarea" label="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." />

          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveError}
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => setSlideOpen(false)}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingPO ? 'Save Changes' : 'Create PO'}
            </button>
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} isLoading={isDeleting}
        title="Delete Purchase Order"
        message={`Are you sure you want to delete PO "${deleteTarget?.poNumber}"? Only DRAFT or CANCELLED POs can be permanently removed.`} />
    </div>
  );
}
