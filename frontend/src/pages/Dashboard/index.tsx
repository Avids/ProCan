import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, Legend
} from 'recharts';
import { 
  Building2, PackageCheck, 
  FileCheck, Clock, CheckCircle2, AlertCircle, BarChart3
} from 'lucide-react';

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
  }
}

export default function DashboardIndex() {
  const [data, setData] = useState<MetricPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/dashboard/summary');
        setData(res.data);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return (
     <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-white"></div>
     </div>
  );

  if (error || !data) return (
     <div className="flex items-center justify-center min-h-[60vh] text-red-500 gap-2 font-medium">
        <AlertCircle /> Failed to connect to ProCan Analytical Engine.
     </div>
  );

  const { kpi, charts } = data;

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="max-w-[100rem] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Global Portfolio Overview</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time aggregations tracking financial health and project delivery.</p>
      </div>

      {/* KPI 8-Grid Array */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Active Contract Value</h3>
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-500">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(kpi.totalContractValue)}</p>
          <div className="mt-2 text-sm text-slate-500">{kpi.activeProjectsCount} Active Projects</div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Calculated Earned Value</h3>
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-500">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(kpi.aggregateEV)}</p>
          <div className="mt-2 text-sm text-slate-500">Simulated Algorithm Applied</div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-slate-50 dark:bg-slate-900/50 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
          <div className="flex items-center justify-between mb-4 relative">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Global SPI / CPI Indices</h3>
            <div className="text-slate-800 dark:text-slate-200 flex items-center gap-1 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs">
              INDEX 1.0 = TARGET
            </div>
          </div>
          <div className="flex items-baseline gap-4 relative">
            <div className="flex flex-col">
              <span className={`text-2xl font-black ${kpi.avgSPI >= 1.0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{kpi.avgSPI.toFixed(2)}</span>
              <span className="text-xs font-medium text-slate-400">SPI (Schedule)</span>
            </div>
            <div className="flex flex-col">
              <span className={`text-2xl font-black ${kpi.avgCPI >= 1.0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{kpi.avgCPI.toFixed(2)}</span>
              <span className="text-xs font-medium text-slate-400">CPI (Cost)</span>
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Materials In-Transit</h3>
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-500">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(kpi.materialsOnOrderValue)}</p>
          <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-1 font-medium">
             <CheckCircle2 className="w-3.5 h-3.5" /> {formatCurrency(kpi.materialsDeliveredValue)} Installed
          </div>
        </div>

        {/* KPI 5 */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Submittal Approval Rate</h3>
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-500">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-end gap-2">
             <p className="text-3xl font-bold text-slate-900 dark:text-white">{kpi.submittalApprovalRate.toFixed(1)}%</p>
             <span className="text-sm mb-1 text-slate-400">Approved</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-4">
             <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, kpi.submittalApprovalRate)}%` }}></div>
          </div>
        </div>

        {/* KPI 6 */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">RFI Avg Response Time</h3>
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-500">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{kpi.avgRfiTime.toFixed(1)}</p>
            <p className="text-slate-500 mb-1 font-medium">Days</p>
          </div>
          <div className="mt-2 text-sm text-slate-400">For completely resolved RFIs.</div>
        </div>
      </div>

      {/* Charting Tier */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* Donut Chart */}
         <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 text-center md:text-left">Global Project Health</h3>
            <p className="text-xs text-slate-500 mb-6 text-center md:text-left">Based on calculated SPI thresholds.</p>
            <div className="flex-1 min-h-[300px] w-full relative">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie
                        data={charts.projectHealthDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                     >
                        {charts.projectHealthDistribution.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                     </Pie>
                     <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                     />
                     <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
               </ResponsiveContainer>
               {/* Center Metric */}
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">{kpi.activeProjectsCount}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total</span>
               </div>
            </div>
         </div>

         {/* Bar Chart */}
         <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:col-span-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Firm-Wide Materials Logistics</h3>
            <p className="text-xs text-slate-500 mb-6">Aggregated tracking of all material workflows mapped across every vendor.</p>
            <div className="flex-1 w-full min-h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.materialStatusBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                     <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                     <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                     />
                     <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {
                           charts.materialStatusBreakdown.map((entry, index) => {
                              const colors = {
                                 'Ordered': '#3b82f6', 
                                 'Released': '#6366f1', 
                                 'Shipped': '#a855f7', 
                                 'Delivered': '#10b981', 
                                 'Rejected': '#ef4444'
                              };
                              return <Cell key={`cell-${index}`} fill={(colors as any)[entry.name] || '#94a3b8'} />;
                           })
                        }
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

      </div>

    </div>
  );
}
