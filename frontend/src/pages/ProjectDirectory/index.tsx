import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { Users, Plus, Trash2, Mail, Phone, Contact2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import SlideOver from '../../components/ui/SlideOver';
import FormField from '../../components/ui/FormField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

interface Assignment {
  id: string;
  employeeId: string;
  positionInProject: string | null;
  moduleAccess: string;
  employee: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: string;
  };
}

const emptyForm = {
  employeeId: '',
  positionInProject: '',
  moduleAccess: 'ALL',
};

export default function ProjectDirectory() {
  const { user } = useAuth();
  const { activeProject } = useProject();
  
  const canMutate = ['COMPANY_MANAGER', 'PROJECT_MANAGER'].includes(user?.role || '');

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [slideOpen, setSlideOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activeProject) return;
    try {
      const [projRes, empRes] = await Promise.all([
        api.get(`/projects/${activeProject.id}`),
        api.get('/employees')
      ]);
      setAssignments(projRes.data.projectAssignments || []);
      setAvailableEmployees(empRes.data.filter((e: any) => e.isActive));
    } catch {
      setError('Failed to load project directory.');
    } finally {
      setIsLoading(false);
    }
  }, [activeProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!activeProject) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-in fade-in zoom-in duration-500">
        <Contact2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Project Required</h2>
        <p className="text-slate-500">Please select an Active Project to view its Team Directory.</p>
      </div>
    );
  }

  const openAssign = () => {
    setForm(emptyForm);
    setSaveError('');
    setSlideOpen(true);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) {
      setSaveError('Employee is required');
      return;
    }
    
    setIsSaving(true);
    setSaveError('');
    try {
      await api.post(`/projects/${activeProject.id}/assign`, form);
      setSlideOpen(false);
      await fetchData();
    } catch (err: any) {
      setSaveError(err.response?.data?.message || 'Failed to assign employee.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/projects/${activeProject.id}/assign/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchData();
    } catch (err: any) {
      setDeleteTarget(null);
      setError(err.response?.data?.message || 'Failed to remove team member.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter out employees that are already assigned to avoid duplicate assignments
  const unassignedEmployees = availableEmployees.filter(
    emp => !assignments.some(a => a.employeeId === emp.id)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Contact2 className="w-8 h-8 text-blue-600" /> Project Directory
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage team members and access control for this project.</p>
        </div>
        {canMutate && (
          <button onClick={openAssign} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> Add Team Member
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center gap-3 border border-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto"></div>
          <p className="text-slate-500 mt-4">Loading directory...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-16 text-center shadow-sm">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">No Team Members Assigned</h3>
          <p className="text-slate-500 mt-1 mb-4">Assign employees to give them access to this project's modules.</p>
          {canMutate && (
            <button onClick={openAssign} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm">
              Assign First Member
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map(assignment => (
            <div key={assignment.id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors relative group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                    {assignment.employee.firstName[0]}{assignment.employee.lastName[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      {assignment.employee.firstName} {assignment.employee.lastName}
                    </h3>
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                      {assignment.positionInProject || assignment.employee.role.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                {canMutate && (
                  <button 
                    onClick={() => setDeleteTarget(assignment)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove from project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="mt-5 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {assignment.employee.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <a href={`mailto:${assignment.employee.email}`} className="hover:text-blue-600 hover:underline truncate">{assignment.employee.email}</a>
                  </div>
                )}
                {assignment.employee.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{assignment.employee.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SlideOver for adding members */}
      <SlideOver isOpen={slideOpen} onClose={() => setSlideOpen(false)} width="md"
        title="Assign Team Member"
        subtitle="Grant project access to an existing employee">
        <form onSubmit={handleAssign} className="space-y-5">
          <FormField as="select" label="Select Employee" required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
            <option value="">-- Choose Employee --</option>
            {unassignedEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.role.replace('_', ' ')})</option>
            ))}
          </FormField>
          
          <FormField as="input" label="Position in Project" placeholder="e.g. Lead Coordinator, Foreman..."
            value={form.positionInProject} onChange={e => setForm(f => ({ ...f, positionInProject: e.target.value }))} />

          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveError}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => setSlideOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving || !form.employeeId} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Assign Member
            </button>
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog 
        isOpen={!!deleteTarget} 
        onClose={() => setDeleteTarget(null)} 
        onConfirm={handleRemove} 
        isLoading={isDeleting}
        title="Remove Team Member"
        message={`Remove ${deleteTarget?.employee?.firstName} from this project? They will immediately lose access to project records.`} 
      />
    </div>
  );
}
