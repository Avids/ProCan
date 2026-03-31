import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCircle, MapPin, Building, CalendarDays, ShoppingBag, HardHat, FileText, AlertCircle } from 'lucide-react';

interface ProjectDetailData {
  id: string;
  projectNumber: string;
  name: string;
  location: string | null;
  totalValue: number | null;
  status: string;
  startDate: string | null;
  projectAssignments: {
    id: string;
    positionInProject: string | null;
    employee: { firstName: string; lastName: string; role: string; };
  }[];
  _count: {
    materials: number;
    rfis: number;
    submittals: number;
    purchaseOrders: number;
  };
  health?: { spi: number; cpi: number; };
  alerts?: { lateMaterialsCount: number; overdueSubmittalsCount: number; unansweredRFIsCount: number; };
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await api.get(`/projects/${id}`);
        setProject(res.data);
      } catch (err) {
        setError('Project Details could not be fetched.');
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchProject();
  }, [id]);

  if (isLoading) return <div className="text-slate-500 animate-pulse text-center mt-20">Loading project architecture...</div>;
  if (error || !project) return <div className="text-red-500 text-center mt-20">{error}</div>;

  const modules = [
    { label: 'Purchase Orders', value: project._count.purchaseOrders, icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Materials Ordered', value: project._count.materials, icon: Building, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    { label: 'Submittals Loaded', value: project._count.submittals, icon: FileText, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { label: 'Open RFIs', value: project._count.rfis, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
      
      {/* Back nav & Top Header */}
      <div>
         <button onClick={() => navigate('/projects')} className="text-sm text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Project Registry
         </button>
         
         <div className="bg-white dark:bg-slate-950 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative overflow-hidden">
            <div className="absolute right-[-5%] top-[-20%] w-64 h-64 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>
            
            <div className="z-10 relative">
               <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 mb-2 border border-slate-200 dark:border-slate-700">
                 {project.projectNumber}
               </span>
               <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                  {project.name}
               </h1>
               <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-slate-500 dark:text-slate-400">
                  {project.location && (
                    <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {project.location}</div>
                  )}
                  {project.startDate && (
                    <div className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Commenced {new Date(project.startDate).toLocaleDateString()}</div>
                  )}
               </div>
            </div>
            
            <div className="z-10 relative bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 w-full md:w-auto mt-4 md:mt-0">
               <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Contract Value</p>
               <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                 {project.totalValue ? `$${Number(project.totalValue).toLocaleString()}` : 'TBD'}
               </p>
            </div>
         </div>
         
         {project.health && project.alerts && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
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
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-400 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Critical Alerts</p>
                  <ul className="mt-2 text-sm font-medium text-orange-900 dark:text-orange-300 space-y-1">
                     {project.alerts.lateMaterialsCount > 0 && <li>• {project.alerts.lateMaterialsCount} Materials Past Due</li>}
                     {project.alerts.overdueSubmittalsCount > 0 && <li>• {project.alerts.overdueSubmittalsCount} Overdue Submittals</li>}
                     {project.alerts.unansweredRFIsCount > 0 && <li>• {project.alerts.unansweredRFIsCount} Unanswered RFIs (&gt; 7 Days)</li>}
                     {project.alerts.lateMaterialsCount === 0 && project.alerts.overdueSubmittalsCount === 0 && project.alerts.unansweredRFIsCount === 0 && (
                        <li className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">No Critical Blockers</li>
                     )}
                  </ul>
               </div>
            </div>
         )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* Team Directory */}
         <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <HardHat className="w-5 h-5 text-blue-500" />
              Assigned Personnel
            </h3>
            
            {project.projectAssignments.length === 0 ? (
               <p className="text-sm text-slate-500">No team members assigned.</p>
            ) : (
               <ul className="space-y-4">
                 {project.projectAssignments.map(assignment => (
                   <li key={assignment.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                         <UserCircle className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                         <p className="text-sm font-medium text-slate-900 dark:text-white">
                           {assignment.employee.firstName} {assignment.employee.lastName}
                         </p>
                         <p className="text-xs text-slate-500">
                           {assignment.positionInProject || assignment.employee.role.replace('_', ' ')}
                         </p>
                      </div>
                   </li>
                 ))}
               </ul>
            )}
         </div>

         {/* Project Modules Summary Grid */}
         <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            {modules.map(mod => {
               const Icon = mod.icon;
               return (
                 <div key={mod.label} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all cursor-pointer group">
                   <div className="flex items-center justify-between mb-4">
                     <div className={`p-2.5 rounded-xl ${mod.bg}`}>
                        <Icon className={`w-6 h-6 ${mod.color}`} />
                     </div>
                     <span className="text-2xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{mod.value}</span>
                   </div>
                   <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400">{mod.label}</h4>
                 </div>
               );
            })}
         </div>

      </div>
    </div>
  );
}
