import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Search, Plus, Calendar, DollarSign, Activity, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SlideOver from '../../components/ui/SlideOver';
import FormField from '../../components/ui/FormField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];

interface ProjectListItem {
  id: string; projectNumber: string; name: string; location: string | null;
  description: string | null; totalValue: number | null; durationMonths: number | null;
  laborHours: number | null; laborValue: number | null; materialCost: number | null;
  status: string; startDate: string | null; finishDate: string | null;
  _count?: { projectAssignments: number; materials: number; };
  projectAssignments?: { employeeId: string; positionInProject: string }[];
}

const statusColor = (s: string) => ({
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  PLANNING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  COMPLETED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  ON_HOLD: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800',
  ARCHIVED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
} as Record<string, string>)[s] || 'bg-slate-100 text-slate-700 border-slate-200';

const emptyForm = {
  projectNumber: '', name: '', location: '', description: '',
  generalContractorName: '', ownerName: '', architectName: '', engineerName: '',
  totalValue: '', durationMonths: '', laborHours: '', laborValue: '', materialCost: '', 
  managerId: '', startDate: '', finishDate: '', status: 'PLANNING'
};

export default function ProjectsIndex() {
  const { user } = useAuth();
  const canMutate = ['COMPANY_MANAGER', 'PROJECT_MANAGER'].includes(user?.role || '');
  const canDelete = user?.role === 'COMPANY_MANAGER';
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [employees, setEmployees] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [slideOpen, setSlideOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectListItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<typeof emptyForm>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatNumber = (val: string) => {
    const clean = String(val).replace(/[^0-9.]/g, '');
    if (!clean) return '';
    const parts = clean.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.slice(0, 2).join('.');
  };

  const handleNumChange = (field: keyof typeof emptyForm, val: string) => {
    setForm(f => ({ ...f, [field]: formatNumber(val) }));
  };

  const fetchProjects = useCallback(async () => {
    try {
      const [projRes, empRes] = await Promise.all([
        api.get('/projects'),
        api.get('/employees')
      ]);
      // Assuming get('/projects') can be modified to return basic assignment info, or we just do it via fetching the specific project. 
      // Actually backend /projects endpoint doesn't return projectAssignments by default we just fetch employees for the dropdown.
      setProjects(projRes.data);
      setEmployees(empRes.data.filter((e: any) => e.isActive));
    } catch { setError('Failed to fetch projects.'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const openCreate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(null); setForm(emptyForm); setFormErrors({}); setSaveError(''); setSlideOpen(true);
  };

  const openEdit = async (e: React.MouseEvent, project: ProjectListItem) => {
    e.stopPropagation();
    setIsLoading(true);
    let managerId = '';
    let fullProject: any = project;
    try {
      // Fetch full project details to get assignments and all fields
      const res = await api.get(`/projects/${project.id}`);
      fullProject = res.data;
      const pmAssignment = fullProject.projectAssignments?.find((a: any) => a.positionInProject === 'Project Manager');
      if (pmAssignment) managerId = pmAssignment.employeeId;
    } catch (err) { console.error('Failed to load full project details', err); }
    setIsLoading(false);

    setEditingProject(project);
    setForm({
      projectNumber: fullProject.projectNumber,
      name: fullProject.name || '',
      location: fullProject.location || '',
      description: fullProject.description || '',
      generalContractorName: fullProject.generalContractorName || '',
      ownerName: fullProject.ownerName || '',
      architectName: fullProject.architectName || '',
      engineerName: fullProject.engineerName || '',
      totalValue: fullProject.totalValue != null ? formatNumber(String(fullProject.totalValue)) : '',
      durationMonths: fullProject.durationMonths != null ? formatNumber(String(fullProject.durationMonths)) : '',
      laborHours: fullProject.laborHours != null ? formatNumber(String(fullProject.laborHours)) : '',
      laborValue: fullProject.laborValue != null ? formatNumber(String(fullProject.laborValue)) : '',
      materialCost: fullProject.materialCost != null ? formatNumber(String(fullProject.materialCost)) : '',
      managerId,
      startDate: fullProject.startDate?.split('T')[0] || '',
      finishDate: fullProject.finishDate?.split('T')[0] || '',
      status: fullProject.status
    });
    setFormErrors({}); setSaveError(''); setSlideOpen(true);
  };

  const validate = () => {
    const errors: Partial<typeof emptyForm> = {};
    if (!form.projectNumber.trim()) errors.projectNumber = 'Project number is required';
    if (!form.name.trim()) errors.name = 'Project name is required';
    if (!form.totalValue || isNaN(Number(form.totalValue.replace(/,/g, '')))) errors.totalValue = 'Valid contract value is required';
    if (!form.durationMonths || isNaN(Number(form.durationMonths.replace(/,/g, '')))) errors.durationMonths = 'Duration in months is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true); setSaveError('');
    try {
      const payload = { 
        ...form, 
        totalValue: Number(form.totalValue.replace(/,/g, '')), 
        durationMonths: Number(form.durationMonths.replace(/,/g, '')),
        laborHours: form.laborHours ? Number(form.laborHours.replace(/,/g, '')) : null,
        laborValue: form.laborValue ? Number(form.laborValue.replace(/,/g, '')) : null,
        materialCost: form.materialCost ? Number(form.materialCost.replace(/,/g, '')) : null,
      };
      if (!payload.managerId) delete (payload as any).managerId; // Send absent if empty
      
      if (editingProject) await api.patch(`/projects/${editingProject.id}`, payload);
      else await api.post('/projects', payload);
      setSlideOpen(false); await fetchProjects();
    } catch (err: any) { setSaveError(err.response?.data?.message || 'Failed to save project.'); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setIsDeleting(true);
    try {
      // Archive instead of delete to preserve history
      await api.patch(`/projects/${deleteTarget.id}`, { status: 'ARCHIVED' });
      setDeleteTarget(null); await fetchProjects();
    } catch (err: any) { setDeleteTarget(null); setError(err.response?.data?.message || 'Failed to archive project.'); }
    finally { setIsDeleting(false); }
  };

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.projectNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <FolderKanban className="w-8 h-8 text-blue-600" /> Projects Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Active directory of all construction site modules.</p>
        </div>
        {canMutate && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> New Project
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by Project Name or Number..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center gap-3 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Project ID</th>
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Value ($)</th>
                <th className="px-6 py-4 hidden md:table-cell">Start Date</th>
                <th className="px-6 py-4 text-right">Team</th>
                {(canMutate || canDelete) && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  <Activity className="w-8 h-8 animate-pulse text-blue-500 mx-auto mb-2" />
                  Loading project records...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  <FolderKanban className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No projects found</p>
                  {canMutate && <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"><Plus className="w-4 h-4" /> Create First Project</button>}
                </td></tr>
              ) : filtered.map(project => (
                <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)}
                  className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-white">{project.projectNumber}</td>
                  <td className="px-6 py-4 font-medium">{project.name}
                    {project.location && <div className="text-xs text-slate-400 font-normal mt-0.5">{project.location}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${statusColor(project.status)}`}>{project.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-slate-400" />{project.totalValue ? Number(project.totalValue).toLocaleString() : 'TBD'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500 hidden md:table-cell">
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4" />{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1">
                      {Array.from({ length: Math.min(project._count?.projectAssignments || 0, 3) }).map((_, i) => (
                        <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white dark:border-slate-950 shadow-sm -ml-2 first:ml-0" />
                      ))}
                      {(project._count?.projectAssignments || 0) > 3 && (
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-950 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 -ml-2">+{(project._count?.projectAssignments || 0) - 3}</div>
                      )}
                      {!project._count?.projectAssignments && <span className="text-xs text-slate-400">Unassigned</span>}
                    </div>
                  </td>
                  {(canMutate || canDelete) && (
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 transition-opacity">
                        {canMutate && (
                          <button onClick={e => openEdit(e, project)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={e => { e.stopPropagation(); setDeleteTarget(project); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete">
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
      <SlideOver isOpen={slideOpen} onClose={() => setSlideOpen(false)} width="lg"
        title={editingProject ? 'Edit Project' : 'New Project'}
        subtitle={editingProject ? editingProject.projectNumber : 'Create a new construction project'}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <FormField as="input" label="Project Number" required placeholder="e.g. PRJ-2024-001"
              value={form.projectNumber} onChange={e => setForm(f => ({ ...f, projectNumber: e.target.value }))}
              error={formErrors.projectNumber} disabled={!!editingProject} />
            <FormField as="select" label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </FormField>
          </div>
          <FormField as="input" label="Project Name" required placeholder="e.g. Alpha Tower Residential"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} error={formErrors.name} />
          <FormField as="input" label="Location" placeholder="City, Country"
            value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <FormField as="textarea" label="Description"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief project overview..." />
          <div className="grid grid-cols-2 gap-4">
             <FormField as="input" label="Owner Name" placeholder="e.g. Acme Corp"
              value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} />
             <FormField as="input" label="General Contractor" placeholder="e.g. BuildCo"
              value={form.generalContractorName} onChange={e => setForm(f => ({ ...f, generalContractorName: e.target.value }))} />
             <FormField as="input" label="Architect" placeholder="e.g. Design Studio"
              value={form.architectName} onChange={e => setForm(f => ({ ...f, architectName: e.target.value }))} />
             <FormField as="input" label="Engineer" placeholder="e.g. Engineering Ltd"
              value={form.engineerName} onChange={e => setForm(f => ({ ...f, engineerName: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <FormField as="input" type="text" label="Contract Value ($)" required placeholder="0.00"
              value={form.totalValue} onChange={(e: any) => handleNumChange('totalValue', e.target.value)} error={formErrors.totalValue} />
            <FormField as="input" type="text" label="Duration (months)" required placeholder="e.g. 12"
              value={form.durationMonths} onChange={(e: any) => handleNumChange('durationMonths', e.target.value)} error={formErrors.durationMonths} />
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Project Team</h3>
            
            <FormField as="select" label="Assign Project Manager" value={form.managerId} onChange={e => setForm(f => ({ ...f, managerId: e.target.value }))}>
              <option value="">-- No Manager Assigned --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <FormField as="input" type="date" label="Planned Start Date" value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            <FormField as="input" type="date" label="Planned Finish Date" value={form.finishDate}
              onChange={e => setForm(f => ({ ...f, finishDate: e.target.value }))} />
          </div>

          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveError}
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => setSlideOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingProject ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} isLoading={isDeleting}
        title="Archive Project"
        message={`Are you sure you want to archive project "${deleteTarget?.name}"? It will become in-active and hidden from the standard active views.`} />
    </div>
  );
}
