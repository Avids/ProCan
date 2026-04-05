import React, { useEffect, useState, useCallback } from 'react';
import api, { getAssetUrl } from '../../lib/api';
import { MessageSquare, Search, ArrowUpDown, AlertCircle, Filter, Timer, MessageCircle, Plus, Pencil, Trash2, FileSpreadsheet, FileDown, Download, Paperclip, History as HistoryIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import SlideOver from '../../components/ui/SlideOver';
import FormField from '../../components/ui/FormField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';

const RFI_STATUSES = ['DRAFT', 'SUBMITTED', 'ANSWERED', 'CLOSED'];

interface RFI {
  id: string; rfiNumber: string; revisionNumber: number; title: string; question: string; response: string | null;
  status: string; dateRaised: string; responseDate: string | null;
  attachment1Url: string | null; attachment2Url: string | null;
  project: { name: string; projectNumber: string } | null;
  raisedBy: { firstName: string; lastName: string } | null;
}

const statusColor = (s: string) => ({
  CLOSED: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  ANSWERED: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800',
  SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800',
  DRAFT: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800',
} as Record<string, string>)[s] || 'bg-slate-100 text-slate-700 border-slate-200';

const emptyForm = { rfiNumber: '', revisionNumber: '0', title: '', question: '', response: '', status: 'DRAFT', dateRaised: '', responseDate: '' };

export default function RFIsIndex() {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const canMutate = ['COMPANY_MANAGER', 'PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COORDINATOR'].includes(user?.role || '');

  const [data, setData] = useState<RFI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState('daysOpen');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [slideOpen, setSlideOpen] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [editingRFI, setEditingRFI] = useState<RFI | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<typeof emptyForm>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RFI | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchAll = useCallback(async () => {
    if (!activeProject) return;
    try {
      const res = await api.get(`/rfis?projectId=${activeProject.id}`);
      setData(res.data);
    } catch { setError('Failed to fetch RFIs.'); }
    finally { setIsLoading(false); }
  }, [activeProject]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!activeProject) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-in fade-in zoom-in duration-500">
        <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Project Required</h2>
        <p className="text-slate-500">Please select an Active Project from the top navigation bar to manage RFIs.</p>
      </div>
    );
  }

  const getDaysOpen = (rfi: RFI) => {
    const start = new Date(rfi.dateRaised).getTime();
    const end = rfi.responseDate ? new Date(rfi.responseDate).getTime() : (['CLOSED', 'ANSWERED'].includes(rfi.status) ? start : Date.now());
    return Math.max(0, Math.floor((end - start) / 86400000));
  };
  const isOverdue = (rfi: RFI) => !['CLOSED', 'ANSWERED'].includes(rfi.status) && getDaysOpen(rfi) > 7;
  const truncate = (s: string, n = 60) => s.length > n ? s.slice(0, n) + '...' : s;

  const openCreate = () => {
    setEditingRFI(null);
    setForm({ ...emptyForm, dateRaised: new Date().toISOString().split('T')[0] });
    setFormErrors({}); setSaveError(''); setSlideOpen(true);
  };
  const openEdit = (r: RFI) => {
    setEditingRFI(r);
    setForm({ 
      rfiNumber: r.rfiNumber, revisionNumber: String(r.revisionNumber ?? 0), 
      title: r.title, question: r.question, response: r.response || '', 
      status: r.status, dateRaised: r.dateRaised.split('T')[0], 
      responseDate: r.responseDate?.split('T')[0] || '' 
    });
    setFormErrors({}); setSaveError(''); setSlideOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
  };

  const uploadFile = async () => {
    if (!selectedFile) return null;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data.url;
    } catch (err: any) {
      console.error('File Upload Error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to upload file.';
      setSaveError(`Upload failed: ${msg}`);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const validate = () => {
    const errors: Partial<typeof emptyForm> = {};
    if (!form.rfiNumber.trim()) errors.rfiNumber = 'RFI Number is required';
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.question.trim()) errors.question = 'Question is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true); setSaveError('');
    try {
      let attachment1Url = editingRFI?.attachment1Url || null;
      if (selectedFile) {
        const uploadedUrl = await uploadFile();
        if (uploadedUrl) attachment1Url = uploadedUrl;
        else { setIsSaving(false); return; }
      }

      const payload = { 
        ...form, 
        projectId: activeProject?.id,
        revisionNumber: Number(form.revisionNumber),
        attachment1Url 
      };
      if (editingRFI) await api.patch(`/rfis/${editingRFI.id}`, payload);
      else await api.post('/rfis', payload);
      setSlideOpen(false); setSelectedFile(null); await fetchAll();
    } catch (err: any) { setSaveError(err.response?.data?.message || 'Failed to save RFI.'); }
    finally { setIsSaving(false); }
  };

  const handleRevise = async (rfi: RFI) => {
    setRevisingId(rfi.id);
    try {
      await api.post(`/rfis/${rfi.id}/revise`);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to create new revision for ${rfi.rfiNumber}.`);
    } finally { setRevisingId(null); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setIsDeleting(true);
    try { await api.delete(`/rfis/${deleteTarget.id}`); setDeleteTarget(null); await fetchAll(); }
    catch (err: any) { setDeleteTarget(null); setError(err.response?.data?.message || 'Failed to delete.'); }
    finally { setIsDeleting(false); }
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const uniqueProjects = Array.from(new Set(data.map(d => d.project?.name).filter(Boolean)));
  const uniqueStatuses = Array.from(new Set(data.map(d => d.status)));

  const filtered = data
    .filter(r => (r.question?.toLowerCase().includes(searchTerm.toLowerCase()) || r.rfiNumber.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === 'ALL' || r.status === statusFilter))
    .sort((a, b) => {
      let av: any = sortField === 'project' ? a.project?.name : sortField === 'daysOpen' ? getDaysOpen(a) : (a as any)[sortField];
      let bv: any = sortField === 'project' ? b.project?.name : sortField === 'daysOpen' ? getDaysOpen(b) : (b as any)[sortField];
      if (!av && !bv) return 0; if (!av) return 1; if (!bv) return -1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const handleExportExcel = () => {
    const exportData = filtered.map(r => ({
      Number: r.rfiNumber,
      Project: r.project?.name || 'N/A',
      Question: r.question,
      Status: r.status,
      'Date Raised': r.dateRaised.split('T')[0],
      'Days Open': getDaysOpen(r),
      'Raised By': `${r.raisedBy?.firstName} ${r.raisedBy?.lastName}`,
      Response: r.response || 'Pending'
    }));
    const dateStr = new Date().toISOString().split('T')[0];
    const projectName = activeProject ? activeProject.name.replace(/\s+/g, '_') : 'All_Projects';
    exportToExcel(exportData, `RFI_LIST_${dateStr}_${projectName}`, 'RFIs');
  };

  const handleExportPDF = () => {
    const columns = ['Number', 'Rev', 'Project', 'Title', 'Status', 'Days Open'];
    const body = filtered.map(r => [
      r.rfiNumber,
      r.revisionNumber,
      r.project?.projectNumber || 'N/A',
      r.title,
      r.status,
      getDaysOpen(r)
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    const projectName = activeProject ? activeProject.name.replace(/\s+/g, '_') : 'All_Projects';
    exportToPDF(body, columns, `RFI_LIST_${dateStr}_${projectName}`, 'RFI Register');
  };

  const handleExportDetailPDF = (r: RFI) => {
    const columns = ['Field', 'Details'];
    const body = [
      ['RFI Number', r.rfiNumber],
      ['Revision', String(r.revisionNumber)],
      ['Project', `${r.project?.projectNumber} - ${r.project?.name}`],
      ['Title', r.title],
      ['Status', r.status],
      ['Date Raised', r.dateRaised.split('T')[0]],
      ['Days Open', String(getDaysOpen(r))],
      ['Raised By', `${r.raisedBy?.firstName} ${r.raisedBy?.lastName}`],
      ['Question', r.question],
      ['Response', r.response || 'Awaiting response...'],
      ['Response Date', r.responseDate?.split('T')[0] || 'N/A']
    ];
    exportToPDF(body, columns, `RFI_${r.rfiNumber}`, `Request For Information: ${r.rfiNumber}`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-rose-600 dark:text-rose-500" /> Information Requests (RFIs)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage architectural bottlenecks and field inquiries securely.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportExcel} className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={handleExportPDF} className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm font-medium rounded-lg border border-red-200 dark:border-red-800 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          {canMutate && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors ml-2">
              <Plus className="w-4 h-4" /> New RFI
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search Question or RFI Number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500 dark:text-white" />
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500 dark:text-white cursor-pointer w-40">
              <option value="ALL">All Statuses</option>
              {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center gap-3 border border-red-200"><AlertCircle className="w-5 h-5 flex-shrink-0" />{error}</div>}

      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800 uppercase text-[11px] tracking-wider">
              <tr>
                {[{ l: 'RFI Overview', f: 'rfiNumber' }, { l: 'Rev', f: 'revisionNumber' }, { l: 'Status', f: 'status' }, { l: 'Days Open', f: 'daysOpen' }, { l: 'Action Dates', f: 'dateRaised' }].map(c => (
                  <th key={c.f} onClick={() => handleSort(c.f)} className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 group select-none">
                    <div className="flex items-center gap-2">{c.l} <ArrowUpDown className={`w-3 h-3 ${sortField === c.f ? 'text-rose-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} /></div>
                  </th>
                ))}
                {canMutate && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center">
                  <div className="animate-spin h-8 w-8 border-b-2 border-rose-600 rounded-full mx-auto" />
                  <p className="text-slate-500 mt-4">Loading RFIs...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                  <MessageCircle className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No RFIs Found</p>
                  {canMutate && <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700 transition-colors"><Plus className="w-4 h-4" /> Raise First RFI</button>}
                </td></tr>
              ) : filtered.map(rfi => {
                const overdue = isOverdue(rfi);
                const days = getDaysOpen(rfi);
                return (
                  <tr key={rfi.id} className={`transition-colors group ${overdue ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {rfi.rfiNumber}
                        {rfi.attachment1Url && <Paperclip className="w-3.5 h-3.5 text-rose-500 ml-1" />}
                      </div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{rfi.title}</div>
                      <div className="text-[10px] text-slate-500 italic truncate max-w-[200px] mt-0.5">"{truncate(rfi.question, 40)}"</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 rounded border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700`}>
                        Rev {rfi.revisionNumber ?? 0}
                      </span>
                      {rfi.raisedBy && <div className="text-xs text-slate-500 mt-1">{rfi.raisedBy.firstName} {rfi.raisedBy.lastName}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-widest rounded-full border ${statusColor(rfi.status)}`}>{rfi.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {['CLOSED', 'ANSWERED'].includes(rfi.status)
                        ? <div className="text-sm text-slate-400">{days} Days Total</div>
                        : <div className={`flex items-center gap-2 font-bold ${overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          <Timer className={`w-4 h-4 ${overdue ? 'animate-pulse text-red-500' : 'text-slate-400'}`} />
                          {days} Days {overdue && <span className="text-[10px] uppercase bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded text-red-700 dark:text-red-300">DELAYED</span>}
                        </div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                      <div className="font-medium text-slate-900 dark:text-slate-300 mb-1">Raised: {new Date(rfi.dateRaised).toLocaleDateString()}</div>
                      <div>{rfi.responseDate ? `Resolved: ${new Date(rfi.responseDate).toLocaleDateString()}` : 'Awaiting Response...'}</div>
                    </td>
                    {canMutate && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRevise(rfi)}
                            disabled={revisingId === rfi.id}
                            title={`Create Rev ${rfi.revisionNumber + 1}`}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {revisingId === rfi.id
                              ? <span className="w-3 h-3 border-2 border-rose-400/40 border-t-rose-600 rounded-full animate-spin" />
                              : <HistoryIcon className="w-3.5 h-3.5" />
                            }
                            Rev {(rfi.revisionNumber ?? 0) + 1}
                          </button>

                          {/* Attachment Link (Paperclip) */}
                          {rfi.attachment1Url && (
                            <a href={getAssetUrl(rfi.attachment1Url)} target="_blank" rel="noreferrer" className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="View Attachment">
                              <Paperclip className="w-4 h-4" />
                            </a>
                          )}
                          {rfi.attachment2Url && (
                            <a href={getAssetUrl(rfi.attachment2Url)} target="_blank" rel="noreferrer" className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="View Attachment">
                              <Paperclip className="w-4 h-4" />
                            </a>
                          )}

                          <button onClick={() => handleExportDetailPDF(rfi)} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Export PDF">
                            <Download className="w-4 h-4" />
                          </button>
                          {/* Edit (only latest rev) */}
                          {(() => {
                            const isLatest = data
                              .filter(d => d.rfiNumber === rfi.rfiNumber)
                              .every(d => (d.revisionNumber ?? 0) <= (rfi.revisionNumber ?? 0));
                            return isLatest && <button onClick={() => openEdit(rfi)} className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>;
                          })()}
                          <button onClick={() => setDeleteTarget(rfi)} className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
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

      <SlideOver isOpen={slideOpen} onClose={() => { setSlideOpen(false); setSelectedFile(null); }}
        title={editingRFI ? 'Edit RFI' : 'Raise New RFI'}
        subtitle={editingRFI ? `RFI ${editingRFI.rfiNumber}` : 'Submit a request for information'}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <FormField as="input" label="RFI Number" required placeholder="e.g. RFI-001"
              value={form.rfiNumber} onChange={e => setForm(f => ({ ...f, rfiNumber: e.target.value }))} error={formErrors.rfiNumber} />
            <FormField as="input" label="Revision #" value={form.revisionNumber} readOnly disabled hint="Increment via table" />
          </div>
          <FormField as="input" label="Title" required placeholder="Short descriptive title..."
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} error={formErrors.title} />
          <FormField as="select" label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {RFI_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </FormField>
          <FormField as="textarea" label="Question" required placeholder="Describe the information needed..."
            value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} error={formErrors.question} />
          {(editingRFI || form.status === 'ANSWERED') && (
            <FormField as="textarea" label="Response" placeholder="Answer or resolution..."
              value={form.response} onChange={e => setForm(f => ({ ...f, response: e.target.value }))} />
          )}
          <div className="grid grid-cols-2 gap-4">
            <FormField as="input" type="date" label="Date Raised" value={form.dateRaised}
              onChange={e => setForm(f => ({ ...f, dateRaised: e.target.value }))} />
            {(editingRFI || ['ANSWERED', 'CLOSED'].includes(form.status)) && (
              <FormField as="input" type="date" label="Response Date" value={form.responseDate}
                onChange={e => setForm(f => ({ ...f, responseDate: e.target.value }))} />
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Attachment (PDF, Image, etc.)</label>
            <div className="flex items-center gap-3">
              <input key={fileInputKey} type="file" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 dark:file:bg-rose-900/40 dark:file:text-rose-400" />
              {uploading && <span className="w-4 h-4 border-2 border-rose-600/30 border-t-rose-600 rounded-full animate-spin" />}
              {selectedFile && (
                <button type="button" onClick={() => { setSelectedFile(null); setFileInputKey(k => k + 1); }} className="text-[11px] font-bold text-rose-600 hover:underline">Remove</button>
              )}
            </div>
            {editingRFI?.attachment1Url && !selectedFile && (
              <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <Download className="w-3 h-3" /> Current: <a href={getAssetUrl(editingRFI.attachment1Url)} target="_blank" rel="noreferrer" className="underline font-medium">View File</a>
              </p>
            )}
            {selectedFile && <p className="text-xs text-emerald-600 font-medium italic">New file selected: {selectedFile.name}</p>}
          </div>

          {saveError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg border border-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{saveError}</div>}

          <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => { setSlideOpen(false); setSelectedFile(null); setSaveError(''); setIsSaving(false); }} className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingRFI ? 'Save Changes' : 'Raise RFI'}
            </button>
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} isLoading={isDeleting}
        title="Delete RFI" message={`Delete RFI "${deleteTarget?.rfiNumber}"? Rev ${deleteTarget?.revisionNumber ?? 0}. This action cannot be undone.`} />
    </div>
  );
}
