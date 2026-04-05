import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import api from '../../lib/api';
import { Download, Upload, Save, AlertCircle, BarChart3, Settings2, Sigma, Banknote } from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ComposedChart
} from 'recharts';

type EvmState = {
  contractValue: number;
  bac: number;
  duration: number;
  costRate: number;
  planned: number[];
  actuals: { pct: number | null, ac: number | null }[];
};

export default function EVMIndex() {
  const { activeProject } = useProject();
  const [activeTab, setActiveTab] = useState<'setup' | 'data' | 'dash' | 'cf'>('setup');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Data state
  const [evmState, setEvmState] = useState<EvmState>({
    contractValue: 0, bac: 1000, duration: 12, costRate: 75, planned: [], actuals: []
  });

  // Calculate Dash metrics dynamically
  const calcData = useMemo(() => {
    // Ported from EVM Dashboard prototype
    const rows = evmState.actuals || [];
    let lastValid = -1;
    rows.forEach((r, i) => { if (r.pct != null && r.ac != null) lastValid = i; });
    
    const labels: string[] = [];
    const pv: number[] = [], ev: number[] = [], ac: number[] = [];
    const spi: (number|null)[] = [], cpi: (number|null)[] = [];
    const sv: number[] = [], cv: number[] = [];
    
    for (let i = 0; i <= lastValid; i++) {
        labels.push('M' + (i + 1));
        const plannedPct = evmState.planned[i] || 0;
        const actualPct = rows[i]?.pct || 0;
        const actualCost = rows[i]?.ac || 0;

        const _pv = (plannedPct / 100) * evmState.bac;
        const _ev = (actualPct / 100) * evmState.bac;
        const _ac = actualCost;
        
        pv.push(Number(_pv.toFixed(1)));
        ev.push(Number(_ev.toFixed(1)));
        ac.push(Number(_ac.toFixed(1)));
        
        spi.push(_pv > 0 ? Number((_ev / _pv).toFixed(3)) : null);
        cpi.push(_ac > 0 ? Number((_ev / _ac).toFixed(3)) : null);
        
        sv.push(Number((_ev - _pv).toFixed(1)));
        cv.push(Number((_ev - _ac).toFixed(1)));
    }
    
    const n = pv.length;
    const curEV = n ? ev[n - 1] : 0;
    const curAC = n ? ac[n - 1] : 0;
    const curPV = n ? pv[n - 1] : 0;
    
    const curCPI = n && curAC > 0 ? curEV / curAC : 1;
    const curSPI = n && curPV > 0 ? curEV / curPV : 1;
    
    const eac = curCPI > 0 ? Number((evmState.bac / curCPI).toFixed(1)) : evmState.bac;
    const vac = Number((evmState.bac - eac).toFixed(1));
    const etc = Number((eac - curAC).toFixed(1));

    return {
       labels, pv, ev, ac, spi, cpi, cv, sv,
       kpis: {
          curEV, curAC, curPV, curCPI, curSPI, eac, vac, etc, 
          cv: n ? cv[n - 1] : 0, sv: n ? sv[n - 1] : 0, 
          bac: evmState.bac
       }
    };
  }, [evmState]);

  useEffect(() => {
    if (!activeProject) return;
    setLoading(true);
    api.get(`/projects/${activeProject.id}`)
       .then(res => {
         const p = res.data;
         // Try to pull evmData JSON object, or default to standard Project totalValue / duration
         if (p.evmData && Object.keys(p.evmData).length > 0) {
            setEvmState(p.evmData);
         } else {
            setEvmState({
               contractValue: p.totalValue || 0,
               duration: p.durationMonths || 12,
               bac: 1000, costRate: 75,
               planned: Array(p.durationMonths || 12).fill(0).map((_, i) => Math.round(((i + 1) / (p.durationMonths || 12)) * 100)),
               actuals: Array(p.durationMonths || 12).fill({ pct: null, ac: null })
            });
         }
       })
       .catch(err => console.error(err))
       .finally(() => setLoading(false));
  }, [activeProject]);

  const saveToCloud = async () => {
    if (!activeProject) return;
    setSaving(true);
    try {
      await api.patch(`/projects/${activeProject.id}`, { evmData: evmState });
      alert('EVM Configuration Saved to Cloud Database securely!');
    } catch (err) {
      alert('Failed to save to cloud.');
    } finally {
      setSaving(false);
    }
  };

  const handleLocalSave = () => {
    if (!activeProject) return;
    const payload = JSON.stringify({ _magic: 'EVM_DASHBOARD_V1', ...evmState }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `${activeProject.name.replace(/[^a-z0-9]/gi, '_')}_EV.evm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  };

  const handleLocalLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
        try {
            const raw = JSON.parse(ev.target?.result as string);
            if (raw._magic !== 'EVM_DASHBOARD_V1') throw new Error('Not an .evm file');
            delete raw._magic;
            setEvmState(raw);
            alert('Local .evm file loaded!');
        } catch (err: any) { alert(err.message); }
    };
    r.readAsText(file);
    e.target.value = '';
  };

  // Rendering
  if (!activeProject) return (
     <div className="py-20 text-center animate-in fade-in">
       <BarChart3 className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
       <h1 className="text-3xl font-bold text-slate-400">EVM Engine Isolated</h1>
       <p className="mt-2 text-slate-500">Select an active project overhead.</p>
     </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Earned Value Analytics</h1>
            <p className="text-slate-500">Financial forecasting tracking strictly for PM / Leadership.</p>
         </div>
         <div className="flex items-center gap-2">
            <button onClick={handleLocalSave} className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
               <Download className="w-4 h-4"/> Export .evm
            </button>
            <label className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
               <Upload className="w-4 h-4"/> Import .evm
               <input type="file" accept=".evm" className="hidden" onChange={handleLocalLoad} />
            </label>
            <button onClick={saveToCloud} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center gap-2 font-medium">
               <Save className="w-4 h-4"/> {saving ? 'Saving...' : 'Sync to Cloud'}
            </button>
         </div>
      </div>

      <div className="flex gap-2 p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg w-max">
         <button onClick={() => setActiveTab('setup')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'setup' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}>Setup Baseline</button>
         <button onClick={() => setActiveTab('data')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'data' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}>Monthly Actuals</button>
         <button onClick={() => setActiveTab('dash')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'dash' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}>EVM Dashboard</button>
      </div>

      {loading ? (
          <div className="py-20 text-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden p-6">
           {activeTab === 'setup' && (
              <div className="space-y-6">
                 <h2 className="text-xl font-bold flex items-center gap-2"><Settings2 className="w-5 h-5"/> Project Financial Setup</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                       <label className="block text-sm font-medium text-slate-500 mb-1">Contract Value ($)</label>
                       <input type="number" value={evmState.contractValue} onChange={e => setEvmState(s => ({ ...s, contractValue: Number(e.target.value) }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-slate-500 mb-1">Total Budget (BAC Hrs)</label>
                       <input type="number" value={evmState.bac} onChange={e => setEvmState(s => ({ ...s, bac: Number(e.target.value) }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-slate-500 mb-1">Duration (Months)</label>
                       <input type="number" value={evmState.duration} onChange={e => {
                          const nd = Number(e.target.value);
                          setEvmState(s => {
                             let newArr = [...s.planned];
                             if (nd > newArr.length) {
                                newArr = newArr.concat(Array(nd - newArr.length).fill(100));
                             } else {
                                newArr = newArr.slice(0, nd);
                             }
                             let newAct = [...s.actuals];
                             if (nd > newAct.length) {
                                newAct = newAct.concat(Array(nd - newAct.length).fill({ pct: null, ac: null }));
                             } else {
                                newAct = newAct.slice(0, nd);
                             }
                             return { ...s, duration: nd, planned: newArr, actuals: newAct };
                          });
                       }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-slate-500 mb-1">Avg Labor Rate ($/Hr)</label>
                       <input type="number" value={evmState.costRate} onChange={e => setEvmState(s => ({ ...s, costRate: Number(e.target.value) }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2" />
                    </div>
                 </div>

                 <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                    <h3 className="text-md font-bold mb-4">S-Curve Baseline (Cumulative Planned %)</h3>
                    <div className="flex flex-wrap gap-2">
                       {evmState.planned.map((val, i) => (
                          <div key={i} className="flex flex-col gap-1 w-20">
                             <label className="text-xs text-slate-500 text-center font-bold">M{i+1}</label>
                             <input type="number" min="0" max="100" value={val} onChange={e => {
                                const v = Number(e.target.value);
                                setEvmState(s => {
                                   const n = [...s.planned]; n[i] = v; return { ...s, planned: n };
                                });
                             }} className="w-full text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1 py-1 text-sm bg-transparent" />
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           )}

           {activeTab === 'data' && (
              <div className="space-y-6">
                 <h2 className="text-xl font-bold flex items-center gap-2"><Sigma className="w-5 h-5"/> Monthly Progress Overrides</h2>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                       <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                             <th className="py-3 px-4 font-bold text-sm text-slate-600">Month</th>
                             <th className="py-3 px-4 font-bold text-sm text-slate-600 text-right">Planned % (Cum)</th>
                             <th className="py-3 px-4 font-bold text-sm text-slate-600 text-right">Physical % (Cum)</th>
                             <th className="py-3 px-4 font-bold text-sm text-slate-600 text-right">Actual Hours (Cum)</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {evmState.actuals.map((act, i) => (
                             <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                <td className="py-2 px-4 font-medium">Month {i + 1}</td>
                                <td className="py-2 px-4 text-right text-slate-500">{evmState.planned[i]}%</td>
                                <td className="py-2 px-4 text-right">
                                   <input type="number" placeholder="-" value={act.pct == null ? '' : act.pct} onChange={e => {
                                      const v = e.target.value === '' ? null : Number(e.target.value);
                                      setEvmState(s => { const a = [...s.actuals]; a[i] = { ...a[i], pct: v }; return { ...s, actuals: a }; });
                                   }} className="w-24 text-right border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-transparent" />
                                </td>
                                <td className="py-2 px-4 text-right">
                                   <input type="number" placeholder="-" value={act.ac == null ? '' : act.ac} onChange={e => {
                                      const v = e.target.value === '' ? null : Number(e.target.value);
                                      setEvmState(s => { const a = [...s.actuals]; a[i] = { ...a[i], ac: v }; return { ...s, actuals: a }; });
                                   }} className="w-24 text-right border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-transparent" />
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           )}

           {activeTab === 'dash' && (
              <div className="space-y-6">
                 {calcData.labels.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">No actuals entered yet. Enter at least one month of actual data.</div>
                 ) : (
                    <>
                       {/* KPIs */}
                       <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {[
                             { k: 'Earned Value', v: calcData.kpis.curEV + 'h', c: 'text-blue-600' },
                             { k: 'Planned Value', v: calcData.kpis.curPV + 'h', c: 'text-slate-600' },
                             { k: 'Actual Cost', v: calcData.kpis.curAC + 'h', c: 'text-orange-500' },
                             { k: 'CPI', v: calcData.kpis.curCPI.toFixed(2), c: calcData.kpis.curCPI >= 1 ? 'text-emerald-500' : 'text-red-500' },
                             { k: 'SPI', v: calcData.kpis.curSPI.toFixed(2), c: calcData.kpis.curSPI >= 1 ? 'text-emerald-500' : 'text-red-500' },
                             { k: 'Est at Complete', v: calcData.kpis.eac + 'h', c: 'text-amber-600' },
                          ].map(k => (
                             <div key={k.k} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                                <div className="text-xs font-semibold text-slate-500 mb-1">{k.k}</div>
                                <div className={`text-xl font-bold ${k.c}`}>{k.v}</div>
                             </div>
                          ))}
                       </div>

                       {/* S-Curve Chart */}
                       <div className="h-80 w-full mt-6">
                          <h3 className="font-bold mb-4">S-Curve Target Variance Tracking</h3>
                          <ResponsiveContainer width="100%" height="100%">
                             <ComposedChart data={calcData.labels.map((l, i) => ({ name: l, PV: calcData.pv[i], EV: calcData.ev[i], AC: calcData.ac[i] }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                                <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} />
                                <YAxis tick={{fill: '#64748b', fontSize: 12}} />
                                <Tooltip contentStyle={{backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff'}} />
                                <Legend />
                                <Line type="monotone" dataKey="PV" stroke="#3b82f6" strokeWidth={3} dot={{r:4}} />
                                <Line type="monotone" dataKey="EV" stroke="#10b981" strokeWidth={3} dot={{r:4}} />
                                <Line type="monotone" dataKey="AC" stroke="#f97316" strokeDasharray="5 5" strokeWidth={3} dot={{r:4}} />
                             </ComposedChart>
                          </ResponsiveContainer>
                       </div>
                    </>
                 )}
              </div>
           )}
        </div>
      )}
    </div>
  );
}
