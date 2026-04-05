import { useState, useEffect } from 'react';
import api from '../../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import {
  Building2, PackageCheck, FileCheck, Clock, CheckCircle2, AlertCircle,
  BarChart3, FolderKanban, UserCircle, HardHat, MapPin, CalendarDays,
  ShoppingBag, Building, FileText, User, Ruler, Wrench, Timer, CalendarCheck
} from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MetricPayload {
  kpi: {
    totalContractValue: number;
    aggregateEV: number;
    avgSPI: number;
    avgCPI: number;
    materialsOnOrderValue: number;
    materialsDeliveredValue: number;
    submittalApprovalRate: number;
    avgRfiTime: number;
    activeProjectsCount: number;
  };
  charts: {
    projectHealthDistribution: any[];
    materialStatusBreakdown: any[];
    submittalStatus: any[];
  };
}

interface FullProjectData {
  id: string;
  projectNumber: string;
  name: string;
  location: string | null;
  totalValue: number | null;
  status: string;
  startDate: string | null;
  finishDate: string | null;
  durationMonths: number | null;
  metadata: Record<string, string> | null;
  projectAssignments: {
    id: string;
    positionInProject: string | null;
    employee: { firstName: string; lastName: string; role: string };
  }[];
  _count: { materials: number; rfis: number; submittals: number; purchaseOrders: number };
  health?: { spi: number; cpi: number };
  alerts?: { lateMaterialsCount: number; overdueSubmittalsCount: number; unansweredRFIsCount: number };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardIndex() {
  const { activeProject, availableProjects, setActiveProject } = useProject();
  const [metrics, setMetrics] = useState<MetricPayload | null>(null);
  const [project, setProject] = useState<FullProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!activeProject) return;

    setLoading(true);
    setError(false);

    Promise.all([
      api.get(`/dashboard/summary?projectId=${activeProject.id}`),
      api.get(`/projects/${activeProject.id}`),
    ])
      .then(([summaryRes, projectRes]) => {
        setMetrics(summaryRes.data);
        setProject(projectRes.data);
      })
      .catch(err => { console.error(err); setError(true); })
      .finally(() => setLoading(false));
  }, [activeProject]);

  // ── No project selected ────────────────────────────────────────────────────
  if (!activeProject) return (
    <div className="max-w-4xl mx-auto py-20 animate-in fade-in zoom-in duration-500">
      <div className="text-center mb-12">
        <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6 transform rotate-3">
          <Building2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Welcome to ProCan</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 mt-3 max-w-xl mx-auto">
          Select a project below to enter your dedicated workspace and begin managing logs, field issues, and analytics.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
        {availableProjects.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            You are not assigned to any projects. Contact your administrator.
          </div>
        ) : (
          availableProjects.map(proj => (
            <button key={proj.id} onClick={() => setActiveProject(proj)}
              className="flex flex-col text-left bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group">
              <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 transition-colors mb-4">
                <FolderKanban className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors line-clamp-1">{proj.name}</h3>
              <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-wider">{proj.projectNumber}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-white" />
    </div>
  );

  if (error || !metrics || !project) return (
    <div className="flex items-center justify-center min-h-[60vh] text-red-500 gap-2 font-medium">
      <AlertCircle /> Failed to connect to ProCan Analytical Engine.
    </div>
  );

  const { kpi, charts } = metrics;
  const meta = project.metadata || {};

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const modules = [
    { label: 'Purchase Orders',  value: project._count.purchaseOrders, icon: ShoppingBag, color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Materials Ordered', value: project._count.materials,      icon: Building,    color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
    { label: 'Submittals Loaded', value: project._count.submittals,     icon: FileText,    color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/30' },
    { label: 'Open RFIs',         value: project._count.rfis,           icon: AlertCircle, color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/30' },
  ];

  const infoFields = [
    { icon: User,         label: 'Owner',              value: meta.ownerName },
    { icon: HardHat,      label: 'General Contractor',  value: meta.generalContractorName },
    { icon: Ruler,        label: 'Architect',            value: meta.architectName },
    { icon: Wrench,       label: 'Engineer',             value: meta.engineerName },
    { icon: CalendarDays, label: 'Start Date',           value: project.startDate ? new Date(project.startDate).toLocaleDateString() : null },
    { icon: Timer,        label: 'Duration',             value: project.durationMonths ? `${project.durationMonths} months` : null },
    { icon: CalendarCheck,label: 'Planned Finish',       value: project.finishDate ? new Date(project.finishDate).toLocaleDateString() : null },
  ] as { icon: any; label: string; value: string | null | undefined }[];

  return (
    <div className="max-w-[100rem] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Hero Header Card (from ProjectDetail) ── */}
      <div className="bg-white dark:bg-slate-950 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative overflow-hidden">
        <div className="absolute right-[-5%] top-[-20%] w-64 h-64 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="z-10 relative">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 mb-2 border border-slate-200 dark:border-slate-700">
            {project.projectNumber}
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-500 dark:text-slate-400">
            {project.location && (
              <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{project.location}</div>
            )}
            {project.startDate && (
              <div className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />Commenced {new Date(project.startDate).toLocaleDateString()}</div>
            )}
          </div>
        </div>
        <div className="z-10 relative bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 w-full md:w-auto mt-4 md:mt-0 flex-shrink-0">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Contract Value</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {project.totalValue ? formatCurrency(project.totalValue) : 'TBD'}
          </p>
        </div>
      </div>

      {/* ── SPI / CPI / Alerts row ── */}
      {project.health && project.alerts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-5 rounded-2xl border flex flex-col justify-center ${project.health.spi >= 1.0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Schedule Status (SPI)</p>
            <p className={`text-2xl font-bold mt-1 ${project.health.spi >= 1.0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              {project.health.spi >= 1.0 ? 'Ahead / On Track' : 'Behind Schedule'} ({project.health.spi.toFixed(2)})
            </p>
          </div>
          <div className={`p-5 rounded-2xl border flex flex-col justify-center ${project.health.cpi >= 1.0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Budget Status (CPI)</p>
            <p className={`text-2xl font-bold mt-1 ${project.health.cpi >= 1.0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              {project.health.cpi >= 1.0 ? 'Under / On Budget' : 'Over Budget'} ({project.health.cpi.toFixed(2)})
            </p>
          </div>
          <div className="p-5 rounded-2xl border bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 flex flex-col justify-center">
            <p className="text-sm font-semibold text-orange-800 dark:text-orange-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />Critical Alerts
            </p>
            <ul className="mt-2 text-sm font-medium text-orange-900 dark:text-orange-300 space-y-1">
              {project.alerts.lateMaterialsCount > 0     && <li>• {project.alerts.lateMaterialsCount} Materials Past Due</li>}
              {project.alerts.overdueSubmittalsCount > 0 && <li>• {project.alerts.overdueSubmittalsCount} Overdue Submittals</li>}
              {project.alerts.unansweredRFIsCount > 0    && <li>• {project.alerts.unansweredRFIsCount} Unanswered RFIs (&gt; 7 Days)</li>}
              {project.alerts.lateMaterialsCount === 0 && project.alerts.overdueSubmittalsCount === 0 && project.alerts.unansweredRFIsCount === 0 && (
                <li className="text-emerald-600 dark:text-emerald-400">No Critical Blockers</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* ── Team + Module Counts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assigned Personnel */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <HardHat className="w-5 h-5 text-blue-500" />Assigned Personnel
          </h3>
          {project.projectAssignments.length === 0 ? (
            <p className="text-sm text-slate-500">No team members assigned.</p>
          ) : (
            <ul className="space-y-4">
              {project.projectAssignments.map(a => (
                <li key={a.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <UserCircle className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{a.employee.firstName} {a.employee.lastName}</p>
                    <p className="text-xs text-slate-500">{a.positionInProject || a.employee.role.replace('_', ' ')}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Module Counts 2×2 */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {modules.map(mod => {
            const Icon = mod.icon;
            return (
              <div key={mod.label} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-xl ${mod.bg}`}>
                    <Icon className={`w-6 h-6 ${mod.color}`} />
                  </div>
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">{mod.value}</span>
                </div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">{mod.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Project Info Strip ── */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Project Parties &amp; Schedule</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-5">
          {infoFields.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <Icon className="w-3.5 h-3.5" />{label}
              </div>
              <div className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">
                {value || <span className="text-slate-400 italic text-xs font-normal">Not set</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Analytics KPI Grid ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Project Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            {
              label: 'Contract Value', value: formatCurrency(kpi.totalContractValue),
              sub: `${kpi.activeProjectsCount} Active`,
              icon: Building2, iconBg: 'bg-blue-100 dark:bg-blue-900/40', iconColor: 'text-blue-600 dark:text-blue-500'
            },
            {
              label: 'Earned Value', value: formatCurrency(kpi.aggregateEV),
              sub: 'Simulated from schedule',
              icon: BarChart3, iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-500'
            },
            {
              label: 'Materials In-Transit', value: formatCurrency(kpi.materialsOnOrderValue),
              sub: `${formatCurrency(kpi.materialsDeliveredValue)} Installed`,
              icon: PackageCheck, iconBg: 'bg-amber-100 dark:bg-amber-900/40', iconColor: 'text-amber-600 dark:text-amber-500'
            },
            {
              label: 'Submittal Approval', value: `${kpi.submittalApprovalRate.toFixed(1)}%`,
              sub: 'Approved',
              icon: FileCheck, iconBg: 'bg-indigo-100 dark:bg-indigo-900/40', iconColor: 'text-indigo-600 dark:text-indigo-500'
            },
            {
              label: 'RFI Avg Response', value: `${kpi.avgRfiTime.toFixed(1)} days`,
              sub: 'Resolved RFIs',
              icon: Clock, iconBg: 'bg-rose-100 dark:bg-rose-900/40', iconColor: 'text-rose-600 dark:text-rose-500'
            },
            {
              label: 'SPI / CPI',
              value: `${kpi.avgSPI.toFixed(2)} / ${kpi.avgCPI.toFixed(2)}`,
              sub: '1.0 = on target',
              icon: CheckCircle2,
              iconBg: kpi.avgSPI >= 1 && kpi.avgCPI >= 1 ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40',
              iconColor: kpi.avgSPI >= 1 && kpi.avgCPI >= 1 ? 'text-emerald-600' : 'text-red-500'
            },
          ].map(kpiCard => {
            const Icon = kpiCard.icon;
            return (
              <div key={kpiCard.label} className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight">{kpiCard.label}</p>
                  <div className={`w-8 h-8 rounded-full ${kpiCard.iconBg} flex items-center justify-center ${kpiCard.iconColor} flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{kpiCard.value}</p>
                <p className="text-xs text-slate-500 mt-1">{kpiCard.sub}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Project Health Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Based on calculated SPI thresholds.</p>
          <div className="flex-1 min-h-[280px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.projectHealthDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  {charts.projectHealthDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
              <span className="text-3xl font-black text-slate-900 dark:text-white">{kpi.activeProjectsCount}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total</span>
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:col-span-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Materials Logistics</h3>
          <p className="text-xs text-slate-500 mb-4">Aggregated material workflows across all vendors.</p>
          <div className="flex-1 w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.materialStatusBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {charts.materialStatusBreakdown.map((entry, i) => {
                    const colors: Record<string, string> = {
                      'Ordered': '#3b82f6', 'Released': '#6366f1', 'Shipped': '#a855f7',
                      'Delivered': '#10b981', 'Rejected': '#ef4444'
                    };
                    return <Cell key={i} fill={colors[entry.name] || '#94a3b8'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
