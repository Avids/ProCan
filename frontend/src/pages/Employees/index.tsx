import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { Users, Search, AlertCircle, Plus, Pencil, UserX, UserCheck, Shield, Briefcase } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SlideOver from '../../components/ui/SlideOver';
import FormField from '../../components/ui/FormField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const ROLES = ['COMPANY_MANAGER', 'PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COORDINATOR', 'ADMIN'];
const POSITIONS = ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COORDINATOR', 'QA_QC_ENGINEER', 'SAFETY_OFFICER', 'STOREKEEPER', 'ADMIN'];

interface Employee {
  id: string; firstName: string; lastName: string; email: string;
  phone: string | null; role: string; position: string; isActive: boolean; createdAt: string;
}

const roleColor = (r: string) => ({
  COMPANY_MANAGER: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-800',
  PROJECT_MANAGER: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800',
  PROJECT_ENGINEER: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-400 dark:border-cyan-800',
  SITE_SUPERVISOR: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800',
  COORDINATOR: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800',
  ADMIN: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
} as Record<string, string>)[r] || 'bg-slate-100 text-slate-700 border-slate-200';

const initials = (e: Employee) => `${e.firstName[0]}${e.lastName[0]}`.toUpperCase();

const avatarBg = (r: string) => ({
  COMPANY_MANAGER: 'from-violet-500 to-purple-600',
  PROJECT_MANAGER: 'from-blue-500 to-blue-700',
  PROJECT_ENGINEER: 'from-cyan-500 to-blue-600',
  SITE_SUPERVISOR: 'from-amber-400 to-orange-500',
  COORDINATOR: 'from-green-400 to-emerald-600',
  ADMIN: 'from-slate-400 to-slate-600',
} as Record<string, string>)[r] || 'from-slate-400 to-slate-600';

const emptyForm = {
  firstName: '', lastName: '', email: '', password: '', phone: '',
  role: 'PROJECT_ENGINEER', position: 'PROJECT_ENGINEER', isActive: 'true'
};

export default function EmployeesPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'COMPANY_MANAGER';

  const [data, setData] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [activeFilter, setActiveFilter] = useState('ACTIVE');

  const [slideOpen, setSlideOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<typeof emptyForm>>({});
  const [isSaving, setIsLoadingSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const res = await api.get('/employees');
      setData(res.data);
    } catch { setError('Failed to load employees.'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setEditingEmp(null); setForm(emptyForm); setFormErrors({}); setSaveError(''); setSlideOpen(true);
  };
  const openEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setForm({ firstName: emp.firstName, lastName: emp.lastName, email: emp.email, password: '', phone: emp.phone || '', role: emp.role, position: emp.position, isActive: String(emp.isActive) });
    setFormErrors({}); setSaveError(''); setSlideOpen(true);
  };

  const validate = () => {
    const errors: Partial<typeof emptyForm> = {};
    if (!form.firstName.trim()) errors.firstName = 'First name is required';
    if (!form.lastName.trim()) errors.lastName = 'Last name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Invalid email';
    if (!editingEmp && !form.password) errors.password = 'Password is required';
    if (!editingEmp && form.password && form.password.length < 8) errors.password = 'Minimum 8 characters';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoadingSaving(true); setSaveError('');
    try {
      const payload: any = { ...form, isActive: form.isActive === 'true' };
      if (editingEmp && !payload.password) delete payload.password;
      if (editingEmp) await api.patch(`/employees/${editingEmp.id}`, payload);
      else await api.post('/employees', payload);
      setSlideOpen(false); await fetchAll();
    } catch (err: any) { setSaveError(err.response?.data?.message || 'Failed to save employee.'); }
    finally { setIsLoadingSaving(false); }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return; setIsDeactivating(true);
    try {
      await api.delete(`/employees/${deactivateTarget.id}`);
      setDeactivateTarget(null); await fetchAll();
    } catch (err: any) { setDeactivateTarget(null); setError(err.response?.data?.message || 'Failed to deactivate.'); }
    finally { setIsDeactivating(false); }
  };

  const filtered = data.filter(emp => {
    const matchSearch = `${emp.firstName} ${emp.lastName} ${emp.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'ALL' || emp.role === roleFilter;
    const matchActive = activeFilter === 'ALL' || (activeFilter === 'ACTIVE' ? emp.isActive : !emp.isActive);
    return matchSearch && matchRole && matchActive;
  });

  const stats = {
    total: data.length,
    active: data.filter(e => e.isActive).length,
    managers: data.filter(e => ['COMPANY_MANAGER', 'PROJECT_MANAGER'].includes(e.role)).length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-violet-600 dark:text-violet-500" /> Team Directory
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage employees, roles, and system access.</p>
        </div>
        {isManager && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Employees', value: stats.total, icon: Users, color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20' },
          { label: 'Active Members', value: stats.active, icon: UserCheck, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Managers', value: stats.managers, icon: Shield, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:text-white" />
        </div>
        <div className="flex gap-3">
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:text-white cursor-pointer">
            <option value="ALL">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:text-white cursor-pointer">
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center gap-3 border border-red-200"><AlertCircle className="w-5 h-5 flex-shrink-0" />{error}</div>}

      {/* Employee Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-10 w-10 border-b-2 border-violet-600 rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-16 text-center">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No employees found</p>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your filters.</p>
          {isManager && <button onClick={openCreate} className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors"><Plus className="w-4 h-4" /> Add First Employee</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <div key={emp.id} className={`bg-white dark:bg-slate-950 border rounded-xl p-5 shadow-sm transition-all hover:shadow-md ${!emp.isActive ? 'opacity-60 border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800'}`}>
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatarBg(emp.role)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}>
                  {initials(emp)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate">{emp.firstName} {emp.lastName}</h3>
                      <p className="text-xs text-slate-500 truncate">{emp.email}</p>
                    </div>
                    {!emp.isActive && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-slate-700 flex-shrink-0">Inactive</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracked rounded border ${roleColor(emp.role)}`}>
                      <Shield className="w-3 h-3" /> {emp.role.replace(/_/g, ' ')}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded">
                      <Briefcase className="w-3 h-3" /> {emp.position.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {emp.phone && <p className="text-xs text-slate-400 mt-2">{emp.phone}</p>}
                </div>
              </div>

              {isManager && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button onClick={() => openEdit(emp)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  {emp.isActive && emp.id !== user?.id && (
                    <button onClick={() => setDeactivateTarget(emp)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg transition-colors">
                      <UserX className="w-3.5 h-3.5" /> Deactivate
                    </button>
                  )}
                  {!emp.isActive && (
                    <button onClick={() => { setEditingEmp(emp); setForm(f => ({ ...f, isActive: 'true' })); handleSubmit({ preventDefault: () => {} } as any); }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors">
                      <UserCheck className="w-3.5 h-3.5" /> Reactivate
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SlideOver */}
      <SlideOver isOpen={slideOpen} onClose={() => setSlideOpen(false)}
        title={editingEmp ? 'Edit Employee' : 'Add New Employee'}
        subtitle={editingEmp ? `${editingEmp.firstName} ${editingEmp.lastName}` : 'Register a new team member'}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <FormField as="input" label="First Name" required placeholder="John"
              value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} error={formErrors.firstName} />
            <FormField as="input" label="Last Name" required placeholder="Smith"
              value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} error={formErrors.lastName} />
          </div>
          <FormField as="input" type="email" label="Email Address" required placeholder="john.smith@company.com"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} error={formErrors.email} />

          {!editingEmp && (
            <FormField as="input" type="password" label="Initial Password" required placeholder="Min. 8 characters"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} error={formErrors.password}
              hint="The employee can change their password later" />
          )}

          <FormField as="input" type="tel" label="Phone" placeholder="+1 555 000 0000"
            value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />

          <div className="grid grid-cols-2 gap-4">
            <FormField as="select" label="System Role" required value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </FormField>
            <FormField as="select" label="Job Position" required value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
              {POSITIONS.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
            </FormField>
          </div>

          {editingEmp && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Account Status</p>
              <div className="flex gap-3">
                {['true', 'false'].map(v => (
                  <label key={v} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${form.isActive === v ? (v === 'true' ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400' : 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400') : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                    <input type="radio" name="isActive" value={v} checked={form.isActive === v} onChange={() => setForm(f => ({ ...f, isActive: v }))} className="sr-only" />
                    {v === 'true' ? <><UserCheck className="w-4 h-4" /> Active</> : <><UserX className="w-4 h-4" /> Inactive</>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveError}
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => setSlideOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingEmp ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog isOpen={!!deactivateTarget} onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate} isLoading={isDeactivating}
        title="Deactivate Employee" confirmLabel="Deactivate"
        message={`Deactivate ${deactivateTarget?.firstName} ${deactivateTarget?.lastName}? They will lose system access but their data will be preserved.`} />
    </div>
  );
}
