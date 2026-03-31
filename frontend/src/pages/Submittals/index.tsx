import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { FileText, Search, ArrowUpDown, AlertCircle, Filter, CalendarClock, History, Plus, Pencil, Trash2, GitBranch, FileSpreadsheet, FileDown, Download, Paperclip } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SlideOver from '../../components/ui/SlideOver';
import FormField from '../../components/ui/FormField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';

const SUBMITTAL_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISE_AND_RESUBMIT'];

interface Submittal {
  id: string; submittalNumber: string; revisionNumber: number; title: string; description: string | null;
  status: string; submittedDate: string | null; reviewDurationDays: number | null; dueDate: string | null; notes: string | null;
  attachment1Url: string | null; attachment2Url: string | null;
  project: { name: string; projectNumber: string } | null;
  createdBy: { firstName: string; lastName: string } | null;
}
interface ProjectOption { id: string; name: string; projectNumber: string; }

const statusColor = (s: string) => ({
  APPROVED: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800',
  REJECTED: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800',
  REVISE_AND_RESUBMIT: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800',
  SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800',
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
} as Record<string, string>)[s] || 'bg-slate-100 text-slate-700 border-slate-200';

const revBadgeColor = (rev: number) =>
  rev === 0
    ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
    : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800';

const emptyForm = { projectId: '', submittalNumber: '', revisionNumber: '0', title: '', description: '', status: 'DRAFT', submittedDate: '', reviewDurationDays: '', dueDate: '', notes: '' };

export default function SubmittalsIndex() {
  const { user } = useAuth();
  const canMutate = ['COMPANY_MANAGER', 'PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COORDINATOR'].includes(user?.role || '');

  const [data, setData] = useState<Submittal[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [sortField, setSortField] = useState('submittalNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [slideOpen, setSlideOpen] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [editingSub, setEditingSub] = useState<Submittal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<typeof emptyForm>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Submittal | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [subRes, projRes] = await Promise.all([
        axios.get('http://localhost:3000/api/v1/submittals'),
        axios.get('http://localhost:3000/api/v1/projects')
      ]);
      setData(subRes.data);
      setProjects(projRes.data);
    } catch { setError('Failed to fetch Submittals.'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setEditingSub(null); setForm(emptyForm); setFormErrors({}); setSaveError(''); setSlideOpen(true);
  };
  const openEdit = (s: Submittal) => {
    setEditingSub(s);
    setForm({
      projectId: '', submittalNumber: s.submittalNumber, revisionNumber: String(s.revisionNumber ?? 0),
      title: s.title, description: s.description || '', status: s.status,
      submittedDate: s.submittedDate?.split('T')[0] || '',
      reviewDurationDays: s.reviewDurationDays != null ? String(s.reviewDurationDays) : '',
      dueDate: s.dueDate?.split('T')[0] || '', notes: s.notes || ''
    });
    setFormErrors({}); setSaveError(''); setSlideOpen(true);
  };

  // Logic to auto-calculate Due Date based on Submitted Date + Review Duration
  useEffect(() => {
    if (form.submittedDate && form.reviewDurationDays) {
      const days = parseInt(form.reviewDurationDays, 10);
      if (!isNaN(days)) {
        const start = new Date(form.submittedDate);
        start.setDate(start.getDate() + days);
        const calcDueDate = start.toISOString().split('T')[0];
        if (calcDueDate !== form.dueDate) {
          setForm(f => ({ ...f, dueDate: calcDueDate }));
        }
      }
    }
  }, [form.submittedDate, form.reviewDurationDays]);

  const validate = () => {
    const errors: Partial<typeof emptyForm> = {};
    if (!editingSub && !form.projectId) errors.projectId = 'Project is required';
    if (!form.submittalNumber.trim()) errors.submittalNumber = 'Submittal number is required';
    if (!form.title.trim()) errors.title = 'Title is required';
    if (form.revisionNumber === '' || isNaN(Number(form.revisionNumber)) || Number(form.revisionNumber) < 0)
      errors.revisionNumber = 'Revision must be 0 or greater';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
  };

  const uploadFile = async () => {
    if (!selectedFile) return null;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    const token = localStorage.getItem('token');
    try {
      const res = await axios.post('http://localhost:3000/api/v1/upload', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true); setSaveError('');
    try {
      let attachment1Url = editingSub?.attachment1Url || null;
      if (selectedFile) {
        const uploadedUrl = await uploadFile();
        if (uploadedUrl) attachment1Url = uploadedUrl;
        else { setIsSaving(false); return; }
      }

      const payload = { 
        ...form, 
        revisionNumber: Number(form.revisionNumber), 
        reviewDurationDays: form.reviewDurationDays ? Number(form.reviewDurationDays) : undefined,
        attachment1Url
      };
      if (editingSub) await axios.patch(`http://localhost:3000/api/v1/submittals/${editingSub.id}`, payload);
      else await axios.post('http://localhost:3000/api/v1/submittals', payload);
      setSlideOpen(false); setSelectedFile(null); await fetchAll();
    } catch (err: any) { setSaveError(err.response?.data?.message || 'Failed to save Submittal.'); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await axios.delete(`http://localhost:3000/api/v1/submittals/${deleteTarget.id}`);
      setDeleteTarget(null); await fetchAll();
    } catch (err: any) { setDeleteTarget(null); setError(err.response?.data?.message || 'Failed to delete.'); }
    finally { setIsDeleting(false); }
  };

  // Create a new revision of an existing submittal
  const handleRevise = async (sub: Submittal) => {
    setRevisingId(sub.id);
    try {
      await axios.post(`http://localhost:3000/api/v1/submittals/${sub.id}/revise`);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to create new revision for ${sub.submittalNumber}.`);
    } finally { setRevisingId(null); }
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const isOverdue = (s: Submittal) => s.dueDate && s.status !== 'APPROVED' && new Date(s.dueDate) < new Date();
  const uniqueProjects = Array.from(new Set(data.map(d => d.project?.name).filter(Boolean)));
  const uniqueStatuses = Array.from(new Set(data.map(d => d.status)));

  const filtered = data
    .filter(s =>
      (s.title.toLowerCase().includes(searchTerm.toLowerCase()) || s.submittalNumber.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === 'ALL' || s.status === statusFilter) &&
      (projectFilter === 'ALL' || s.project?.name === projectFilter))
    .sort((a: any, b: any) => {
      const av = sortField === 'revisionNumber' ? a.revisionNumber : a[sortField];
      const bv = sortField === 'revisionNumber' ? b.revisionNumber : b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

  const handleExportExcel = () => {
    const exportData = filtered.map(s => ({
      Number: s.submittalNumber,
      Revision: s.revisionNumber,
      Project: s.project?.name || 'N/A',
      Title: s.title,
      Status: s.status,
      'Submitted Date': s.submittedDate?.split('T')[0] || 'N/A',
      'Due Date': s.dueDate?.split('T')[0] || 'N/A',
      'Created By': `${s.createdBy?.firstName} ${s.createdBy?.lastName}`
    }));
    const dateStr = new Date().toISOString().split('T')[0];
    const projectName = (projectFilter === 'ALL' ? 'All_Projects' : projectFilter).replace(/\s+/g, '_');
    exportToExcel(exportData, `SUBMITTAL_LIST_${dateStr}_${projectName}`, 'Submittals');
  };

  const handleExportPDF = () => {
    const columns = ['Number', 'Rev', 'Project', 'Title', 'Status', 'Due Date'];
    const body = filtered.map(s => [
      s.submittalNumber,
      s.revisionNumber,
      s.project?.projectNumber || 'N/A',
      s.title,
      s.status,
      s.dueDate?.split('T')[0] || 'N/A'
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    const projectName = (projectFilter === 'ALL' ? 'All_Projects' : projectFilter).replace(/\s+/g, '_');
    exportToPDF(body, columns, `SUBMITTAL_LIST_${dateStr}_${projectName}`, 'Submittal Register');
  };

  const handleExportDetailPDF = (s: Submittal) => {
    const columns = ['Field', 'Details'];
    const body = [
      ['Submittal Number', s.submittalNumber],
      ['Revision', String(s.revisionNumber)],
      ['Project', `${s.project?.projectNumber} - ${s.project?.name}`],
      ['Title', s.title],
      ['Description', s.description || 'N/A'],
      ['Status', s.status],
      ['Submitted Date', s.submittedDate?.split('T')[0] || 'N/A'],
      ['Review Duration', `${s.reviewDurationDays || 0} days`],
      ['Due Date', s.dueDate?.split('T')[0] || 'N/A'],
      ['Notes', s.notes || 'N/A'],
      ['Created By', `${s.createdBy?.firstName} ${s.createdBy?.lastName}`]
    ];
    exportToPDF(body, columns, `SUBMITTAL_${s.submittalNumber}_R${s.revisionNumber}`, `Submittal Details: ${s.submittalNumber}`);
  };

  const cols = [
    { label: 'Submittal #', field: 'submittalNumber' },
    { label: 'Rev', field: 'revisionNumber' },
    { label: 'Project', field: 'project' },
    { label: 'Status', field: 'status' },
    { label: 'Submitted', field: 'submittedDate' },
    { label: 'Due Date', field: 'dueDate' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-amber-600 dark:text-amber-500" /> Submittals Engine
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Review vendor shop drawings, specs, and material data sheets.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportExcel} className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={handleExportPDF} className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm font-medium rounded-lg border border-red-200 dark:border-red-800 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          {canMutate && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors ml-2">
              <Plus className="w-4 h-4" /> New Submittal
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search Title or Submittal Number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white" />
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white cursor-pointer w-48">
              <option value="ALL">All Statuses</option>
              {uniqueStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white cursor-pointer w-44">
            <option value="ALL">All Projects</option>
            {uniqueProjects.map(p => <option key={p as string} value={p as string}>{p}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center gap-3 border border-red-200"><AlertCircle className="w-5 h-5 flex-shrink-0" />{error}</div>}

      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800 uppercase text-[11px] tracking-wider">
              <tr>
                {cols.map(c => (
                  <th key={c.field} onClick={() => handleSort(c.field)} className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 group select-none">
                    <div className="flex items-center gap-2">{c.label} <ArrowUpDown className={`w-3 h-3 ${sortField === c.field ? 'text-amber-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} /></div>
                  </th>
                ))}
                {canMutate && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center">
                  <div className="animate-spin h-8 w-8 border-b-2 border-amber-600 rounded-full mx-auto" />
                  <p className="text-slate-500 mt-4">Loading Submittals...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                  <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No Submittals Found</p>
                  {canMutate && <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors"><Plus className="w-4 h-4" /> Create First Submittal</button>}
                </td></tr>
              ) : filtered.map(sub => {
                const pastDue = isOverdue(sub);
                const isRevising = revisingId === sub.id;
                return (
                  <tr key={sub.id} className={`transition-colors group ${pastDue ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                    {/* Submittal # + title */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white">{sub.submittalNumber}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">{sub.title}</div>
                    </td>

                    {/* Revision # */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 rounded border ${revBadgeColor(sub.revisionNumber)}`}>
                        <History className="w-3 h-3" /> Rev {sub.revisionNumber}
                      </span>
                    </td>

                    {/* Project + submitted by */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{sub.project?.name || '—'}</div>
                      <div className="text-xs text-slate-500">{sub.createdBy ? `${sub.createdBy.firstName} ${sub.createdBy.lastName}` : '—'}</div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-widest rounded-full border ${statusColor(sub.status)}`}>
                        {sub.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Submitted Date */}
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                      {sub.submittedDate ? new Date(sub.submittedDate).toLocaleDateString() : '—'}
                    </td>

                    {/* Due Date */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center gap-2 ${pastDue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                        <CalendarClock className={`w-4 h-4 ${pastDue ? 'animate-pulse text-red-500' : 'text-slate-400'}`} />
                        {sub.dueDate ? new Date(sub.dueDate).toLocaleDateString() : 'TBD'}
                        {pastDue && <span className="text-[10px] uppercase bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded text-red-700 dark:text-red-300">LATE</span>}
                      </div>
                    </td>

                    {/* Actions */}
                    {canMutate && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* New Revision button */}
                          <button
                            onClick={() => handleRevise(sub)}
                            disabled={isRevising}
                            title={`Create Rev ${sub.revisionNumber + 1}`}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isRevising
                              ? <span className="w-3 h-3 border-2 border-amber-400/40 border-t-amber-600 rounded-full animate-spin" />
                              : <GitBranch className="w-3.5 h-3.5" />
                            }
                            Rev {sub.revisionNumber + 1}
                          </button>

                          {/* Attachment Link (Paperclip) */}
                          {sub.attachment1Url && (
                            <a href={`http://localhost:3000${sub.attachment1Url}`} target="_blank" rel="noreferrer" className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="View Attachment">
                              <Paperclip className="w-4 h-4" />
                            </a>
                          )}

                          {/* Individual PDF Export */}
                          <button onClick={() => handleExportDetailPDF(sub)} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Export PDF">
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Edit (only if latest revision) */}
                          {(() => {
                            const isLatest = data
                              .filter(d => d.submittalNumber === sub.submittalNumber)
                              .every(d => (d.revisionNumber ?? 0) <= (sub.revisionNumber ?? 0));
                            return isLatest && (
                              <button onClick={() => openEdit(sub)} className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors" title="Edit">
                                <Pencil className="w-4 h-4" />
                              </button>
                            );
                          })()}

                          {/* Delete (DRAFT only) */}
                          {sub.status === 'DRAFT' && (
                            <button onClick={() => setDeleteTarget(sub)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Create / Edit SlideOver */}
      <SlideOver isOpen={slideOpen} onClose={() => { setSlideOpen(false); setSelectedFile(null); }}
        title={editingSub ? 'Edit Submittal' : 'New Submittal'}
        subtitle={editingSub ? `${editingSub.submittalNumber} — Rev ${editingSub.revisionNumber}` : 'Create and track a new engineering submittal'}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {!editingSub && (
            <FormField as="select" label="Project" required value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} error={formErrors.projectId}>
              <option value="">— Select Project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>)}
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField as="input" label="Submittal Number" required placeholder="e.g. SUB-001"
              value={form.submittalNumber} onChange={e => setForm(f => ({ ...f, submittalNumber: e.target.value }))} error={formErrors.submittalNumber} />
            <FormField as="input" label="Revision #" value={form.revisionNumber} readOnly disabled hint="Increment via table" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField as="input" label="Title" required placeholder="Submittal title..." value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} error={formErrors.title} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField as="select" label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {SUBMITTAL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </FormField>
            <FormField as="input" type="number" label="Review Duration (days)" placeholder="e.g. 14"
              value={form.reviewDurationDays} onChange={e => setForm(f => ({ ...f, reviewDurationDays: e.target.value }))} />
          </div>

          <FormField as="textarea" label="Description" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..." />

          <div className="grid grid-cols-2 gap-4">
            <FormField as="input" type="date" label="Submitted Date" value={form.submittedDate}
              onChange={e => setForm(f => ({ ...f, submittedDate: e.target.value }))} />
            <FormField as="input" type="date" label="Due Date" value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </div>

          <FormField as="textarea" label="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Attachment (PDF, Image, etc.)</label>
            <div className="flex items-center gap-3">
              <input key={fileInputKey} type="file" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 dark:file:bg-amber-900/40 dark:file:text-amber-400" />
              {uploading && <span className="w-4 h-4 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />}
              {selectedFile && (
                <button type="button" onClick={() => { setSelectedFile(null); setFileInputKey(k => k + 1); }} className="text-[11px] font-bold text-red-600 hover:underline">Remove</button>
              )}
            </div>
            {editingSub?.attachment1Url && !selectedFile && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Download className="w-3 h-3" /> Current: <a href={`http://localhost:3000${editingSub.attachment1Url}`} target="_blank" rel="noreferrer" className="underline font-medium">View File</a>
              </p>
            )}
            {selectedFile && <p className="text-xs text-emerald-600 font-medium italic">New file selected: {selectedFile.name}</p>}
          </div>

          {saveError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg border border-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{saveError}</div>}

          <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => { setSlideOpen(false); setSelectedFile(null); setSaveError(''); setIsSaving(false); }} className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingSub ? 'Save Changes' : 'Create Submittal'}
            </button>
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} isLoading={isDeleting}
        title="Delete Submittal" message={`Delete "${deleteTarget?.submittalNumber}" Rev ${deleteTarget?.revisionNumber}? Only DRAFT submittals can be removed.`} />
    </div>
  );
}
