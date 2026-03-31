import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { Users, Search, ArrowUpDown, AlertCircle, Phone, Mail, Building2, Filter, Plus, Pencil, Trash2, FileSpreadsheet, FileDown } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { useAuth } from '../../contexts/AuthContext';
import SlideOver from '../../components/ui/SlideOver';
import FormField from '../../components/ui/FormField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const TRADES = ['STRUCTURAL', 'ARCHITECTURAL', 'MEP', 'CIVIL', 'FINISHES', 'OTHER'];

interface Vendor {
  id: string;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  isSubcontractor: boolean;
  tradeType: string;
}

const emptyForm = {
  companyName: '', contactPerson: '', phone: '', email: '',
  address: '', taxId: '', notes: '', isSubcontractor: false, tradeType: 'OTHER'
};

type FormData = typeof emptyForm;
type SortField = keyof Vendor;

export default function VendorsIndex() {
  const { user } = useAuth();
  const canEdit = ['COMPANY_MANAGER', 'PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COORDINATOR'].includes(user?.role || '');
  const canDelete = user?.role === 'COMPANY_MANAGER';

  const [data, setData] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [tradeFilter, setTradeFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('companyName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // SlideOver state
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<FormData>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchVendors = useCallback(async () => {
    try {
      const res = await api.get('/vendors');
      setData(res.data);
    } catch {
      setError('Failed to fetch the Vendor Directory.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const openCreate = () => {
    setEditingVendor(null);
    setForm(emptyForm);
    setFormErrors({});
    setSaveError('');
    setSlideOpen(true);
  };

  const openEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setForm({
      companyName: vendor.companyName,
      contactPerson: vendor.contactPerson || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      address: '', taxId: '', notes: '',
      isSubcontractor: vendor.isSubcontractor,
      tradeType: vendor.tradeType
    });
    setFormErrors({});
    setSaveError('');
    setSlideOpen(true);
  };

  const validate = (): boolean => {
    const errors: Partial<FormData> = {};
    if (!form.companyName.trim()) errors.companyName = 'Company name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Invalid email format';
    if (!form.phone.trim()) errors.phone = 'Phone is required';
    if (!form.contactPerson.trim()) errors.contactPerson = 'Contact person is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    setSaveError('');
    try {
      if (editingVendor) {
        await api.patch(`/vendors/${editingVendor.id}`, form);
      } else {
        await api.post('/vendors', form);
      }
      setSlideOpen(false);
      await fetchVendors();
    } catch (err: any) {
      setSaveError(err.response?.data?.message || 'Failed to save vendor.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/vendors/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchVendors();
    } catch (err: any) {
      setDeleteTarget(null);
      setError(err.response?.data?.message || 'Failed to delete vendor.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const uniqueTrades = Array.from(new Set(data.map(d => d.tradeType)));

  const filtered = data
    .filter(item => {
      const matchSearch = item.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.contactPerson || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchTrade = tradeFilter === 'ALL' || item.tradeType === tradeFilter;
      const matchType = typeFilter === 'ALL' ||
        (typeFilter === 'SUBCONTRACTOR' && item.isSubcontractor) ||
        (typeFilter === 'SUPPLIER' && !item.isSubcontractor);
      return matchSearch && matchTrade && matchType;
    })
    .sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (av === bv) return 0;
      if (av == null) return sortDir === 'asc' ? 1 : -1;
      if (bv == null) return sortDir === 'asc' ? -1 : 1;
      if (typeof av === 'boolean') return sortDir === 'asc' ? (av ? 1 : -1) : (av ? -1 : 1);
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

  const handleExportExcel = () => {
    const exportData = filtered.map(v => ({
      'Company Name': v.companyName,
      Type: v.isSubcontractor ? 'Subcontractor' : 'Supplier',
      Trade: v.tradeType,
      'Contact Person': v.contactPerson || 'N/A',
      Email: v.email || 'N/A',
      Phone: v.phone || 'N/A'
    }));
    const dateStr = new Date().toISOString().split('T')[0];
    exportToExcel(exportData, `VENDOR_LIST_${dateStr}`, 'Vendors');
  };

  const handleExportPDF = () => {
    const columns = ['Company', 'Type', 'Trade', 'Contact', 'Email'];
    const body = filtered.map(v => [
      v.companyName,
      v.isSubcontractor ? 'Sub' : 'Supplier',
      v.tradeType,
      v.contactPerson || '',
      v.email || ''
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    exportToPDF(body, columns, `VENDOR_LIST_${dateStr}`, 'Vendor Directory');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-500" />
            Vendor Directory
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage Subcontractors and Material Suppliers.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportExcel} className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={handleExportPDF} className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm font-medium rounded-lg border border-red-200 dark:border-red-800 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          {canEdit && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> New Vendor
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search Company or Contact Person..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="w-full sm:w-48 pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white cursor-pointer">
              <option value="ALL">All Types</option>
              <option value="SUBCONTRACTOR">Subcontractors</option>
              <option value="SUPPLIER">Suppliers</option>
            </select>
          </div>
          <select value={tradeFilter} onChange={e => setTradeFilter(e.target.value)}
            className="w-full sm:w-48 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white cursor-pointer">
            <option value="ALL">All Trades</option>
            {uniqueTrades.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800 uppercase text-[11px] tracking-wider">
              <tr>
                {[
                  { label: 'Company Name', field: 'companyName' as SortField },
                  { label: 'Type', field: 'isSubcontractor' as SortField },
                  { label: 'Trade', field: 'tradeType' as SortField },
                  { label: 'Contact Person', field: 'contactPerson' as SortField },
                  { label: 'Contact Info', field: 'email' as SortField },
                ].map(col => (
                  <th key={col.label}
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none"
                    onClick={() => handleSort(col.field)}>
                    <div className="flex items-center gap-2">
                      {col.label}
                      <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortField === col.field ? 'text-blue-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
                    </div>
                  </th>
                ))}
                {(canEdit || canDelete) && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                  <p className="text-slate-500 mt-4">Loading Vendor Directory...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                  <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No Vendors Found</p>
                  {canEdit && <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"><Plus className="w-4 h-4" /> Add First Vendor</button>}
                </td></tr>
              ) : (
                filtered.map(vendor => (
                  <tr key={vendor.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">{vendor.companyName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vendor.isSubcontractor
                        ? <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-400 dark:border-purple-800 uppercase tracking-wider">Subcontractor</span>
                        : <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800 uppercase tracking-wider">Supplier</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">{vendor.tradeType.replace('_', ' ')}</td>
                    <td className="px-6 py-4">{vendor.contactPerson || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        {vendor.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400" />{vendor.email}</div>}
                        {vendor.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" />{vendor.phone}</div>}
                        {!vendor.email && !vendor.phone && 'No Contact Data'}
                      </div>
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button onClick={() => openEdit(vendor)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => setDeleteTarget(vendor)}
                              className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Slide-Over */}
      <SlideOver
        isOpen={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editingVendor ? 'Edit Vendor' : 'Register New Vendor'}
        subtitle={editingVendor ? editingVendor.companyName : 'Add a subcontractor or supplier to the global directory'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField as="input" label="Company Name" required
            value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
            error={formErrors.companyName} placeholder="e.g. ACME Construction" />
          <FormField as="input" label="Contact Person" required
            value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))}
            error={formErrors.contactPerson} placeholder="Full name" />
          <div className="grid grid-cols-2 gap-4">
            <FormField as="input" type="email" label="Email" required
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              error={formErrors.email} placeholder="contact@vendor.com" />
            <FormField as="input" type="tel" label="Phone" required
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              error={formErrors.phone} placeholder="+1 555 000 0000" />
          </div>
          <FormField as="select" label="Trade Type" required
            value={form.tradeType} onChange={e => setForm(f => ({ ...f, tradeType: e.target.value }))}>
            {TRADES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </FormField>
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
            <input type="checkbox" id="isSub" checked={form.isSubcontractor}
              onChange={e => setForm(f => ({ ...f, isSubcontractor: e.target.checked }))}
              className="w-4 h-4 accent-purple-600" />
            <label htmlFor="isSub" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              This vendor is a <strong>Subcontractor</strong> (not just a material supplier)
            </label>
          </div>
          <FormField as="input" label="Address" value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, City, Country" />
          <FormField as="textarea" label="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any relevant notes..." />

          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
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
              {isSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {editingVendor ? 'Save Changes' : 'Register Vendor'}
            </button>
          </div>
        </form>
      </SlideOver>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Vendor"
        message={`Are you sure you want to delete "${deleteTarget?.companyName}"? This action cannot be undone. Vendors with active Purchase Orders cannot be deleted.`}
      />
    </div>
  );
}
