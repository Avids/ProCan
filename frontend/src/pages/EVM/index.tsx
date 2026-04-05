import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import api from '../../lib/api';
import { Download, Upload, Save, BarChart3, Settings2, Sigma, FileDown } from 'lucide-react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine, Cell
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
type EvmState = {
  contractValue: number;
  bac: number;
  duration: number;
  costRate: number;
  planned: number[];
  actuals: { pct: number | null; ac: number | null }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────
const ABBREV_LIST = [
  ['BAC', 'Budget at Completion',        'Total planned budget (hours or cost)'],
  ['PV',  'Planned Value',               'Budgeted cost of work scheduled to date'],
  ['EV',  'Earned Value',                'Budgeted cost of work actually performed'],
  ['AC',  'Actual Cost',                 'Real cost incurred to date'],
  ['CPI', 'Cost Performance Index',      'EV ÷ AC. Value >1 means under budget'],
  ['SPI', 'Schedule Performance Index',  'EV ÷ PV. Value >1 means ahead of schedule'],
  ['CV',  'Cost Variance',               'EV − AC. Negative = over budget'],
  ['SV',  'Schedule Variance',           'EV − PV. Negative = behind schedule'],
  ['EAC', 'Estimate at Completion',      'Projected total cost at completion = BAC ÷ CPI'],
  ['ETC', 'Estimate to Complete',        'Remaining cost to finish = EAC − AC'],
  ['VAC', 'Variance at Completion',      'BAC − EAC. Negative = projected overrun'],
];

const EMPTY_STATE: EvmState = {
  contractValue: 0, bac: 1000, duration: 12, costRate: 75, planned: [], actuals: []
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt1 = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });
const fmt2 = (v: number | null) => v != null ? v.toFixed(2) : '—';
const sign = (v: number) => v >= 0 ? '+' : '';

// ─── Custom Legend ─────────────────────────────────────────────────────────────
function ChartLegend({ items }: { items: { color: string; label: string; dash?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-4 mb-3">
      {items.map(item => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
          <span
            className="inline-block rounded-sm"
            style={{
              width: 11, height: 11,
              background: item.color,
              opacity: item.dash ? 0.7 : 1
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EVMIndex() {
  const { activeProject } = useProject();
  const [activeTab, setActiveTab] = useState<'setup' | 'data' | 'dash'>('setup');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [evmState, setEvmState] = useState<EvmState>(EMPTY_STATE);

  // ── Calculate metrics ──────────────────────────────────────────────────────
  const calcData = useMemo(() => {
    const rows = evmState.actuals || [];
    let lastValid = -1;
    rows.forEach((r, i) => { if (r.pct != null && r.ac != null) lastValid = i; });

    const labels: string[] = [];
    const pv: number[] = [], ev: number[] = [], ac: number[] = [];
    const spi: (number | null)[] = [], cpi: (number | null)[] = [];
    const sv: number[] = [], cv: number[] = [];

    for (let i = 0; i <= lastValid; i++) {
      labels.push('M' + (i + 1));
      const plannedPct = evmState.planned[i] || 0;
      const actualPct  = rows[i]?.pct  || 0;
      const actualCost = rows[i]?.ac   || 0;

      const _pv = (plannedPct / 100) * evmState.bac;
      const _ev = (actualPct  / 100) * evmState.bac;
      const _ac = actualCost;

      pv.push(+_pv.toFixed(1));
      ev.push(+_ev.toFixed(1));
      ac.push(+_ac.toFixed(1));
      spi.push(_pv > 0 ? +(_ev / _pv).toFixed(3) : null);
      cpi.push(_ac > 0 ? +(_ev / _ac).toFixed(3) : null);
      sv.push(+(_ev - _pv).toFixed(1));
      cv.push(+(_ev - _ac).toFixed(1));
    }

    const n = pv.length;
    const curEV = n ? ev[n - 1] : 0;
    const curAC = n ? ac[n - 1] : 0;
    const curPV = n ? pv[n - 1] : 0;
    const curCPI = n && curAC > 0 ? curEV / curAC : 1;
    const curSPI = n && curPV > 0 ? curEV / curPV : 1;
    const eac = curCPI > 0 ? +(evmState.bac / curCPI).toFixed(1) : evmState.bac;
    const vac = +(evmState.bac - eac).toFixed(1);
    const etc = +(eac - curAC).toFixed(1);

    // Chart data arrays
    const sCurveData = labels.map((l, i) => ({ name: l, PV: pv[i], EV: ev[i], AC: ac[i] }));
    const indexData  = labels.map((l, i) => ({ name: l, CPI: cpi[i], SPI: spi[i], Target: 1.0 }));
    const varData    = labels.map((l, i) => ({ name: l, CV: cv[i], SV: sv[i] }));

    return {
      labels, pv, ev, ac, spi, cpi, cv, sv,
      sCurveData, indexData, varData,
      kpis: { curEV, curAC, curPV, curCPI, curSPI, eac, vac, etc, cv: n ? cv[n-1] : 0, sv: n ? sv[n-1] : 0, bac: evmState.bac }
    };
  }, [evmState]);

  // ── Load from API ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeProject) return;
    setLoading(true);
    api.get(`/projects/${activeProject.id}`)
      .then(res => {
        const p = res.data;
        if (p.evmData && Object.keys(p.evmData).length > 0) {
          setEvmState(p.evmData as EvmState);
        } else {
          const dur = p.durationMonths || 12;
          setEvmState({
            contractValue: p.totalValue || 0,
            duration: dur,
            bac: 1000,
            costRate: 75,
            planned: Array.from({ length: dur }, (_, i) => Math.round(((i + 1) / dur) * 100)),
            actuals: Array.from({ length: dur }, () => ({ pct: null, ac: null }))
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeProject]);

  // ── Sync to cloud ──────────────────────────────────────────────────────────
  const saveToCloud = async () => {
    if (!activeProject) return;
    setSaving(true);
    try {
      await api.patch(`/projects/${activeProject.id}`, { evmData: evmState });
      alert('EVM configuration saved to cloud!');
    } catch { alert('Failed to save to cloud.'); }
    finally { setSaving(false); }
  };

  // ── Local .evm export ──────────────────────────────────────────────────────
  const handleLocalSave = () => {
    if (!activeProject) return;
    const blob = new Blob([JSON.stringify({ _magic: 'EVM_DASHBOARD_V1', ...evmState }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${activeProject.name.replace(/[^a-z0-9]/gi, '_')}_EV.evm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // ── Local .evm import ──────────────────────────────────────────────────────
  const handleLocalLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        if (raw._magic !== 'EVM_DASHBOARD_V1') throw new Error('Not a valid .evm file');
        const { _magic, ...data } = raw;
        setEvmState(data as EvmState);
        alert('Local .evm file loaded!');
      } catch (err: any) { alert(err.message); }
    };
    r.readAsText(file);
    e.target.value = '';
  };

  // ── Duration change ────────────────────────────────────────────────────────
  const handleDurationChange = (nd: number) => {
    setEvmState(s => {
      const planned = [...s.planned];
      const actuals = [...s.actuals];
      if (nd > planned.length) {
        for (let i = planned.length; i < nd; i++) planned.push(100);
        for (let i = actuals.length; i < nd; i++) actuals.push({ pct: null, ac: null });
      } else {
        planned.splice(nd);
        actuals.splice(nd);
      }
      return { ...s, duration: nd, planned, actuals };
    });
  };

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const exportPDF = useCallback(async () => {
    const kpis = calcData.kpis;
    if (!kpis.bac || calcData.labels.length === 0) {
      alert('Enter at least one month of actual data first.'); return;
    }

    // Dynamic import – jspdf already installed
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth() - 28;
    const projectName = activeProject?.name ?? 'EVM Report';

    // ── Header helper ──
    const header = (title: string, sub: string) => {
      doc.setFillColor(24, 95, 165);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 18, 'F');
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255);
      doc.text(title, 14, 11);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 220, 255);
      doc.text(sub, 14, 16);
      doc.setTextColor(0);
    };

    const tableStyle = () => ({
      styles: { fontSize: 8 },
      headStyles: { fillColor: [24, 95, 165] as [number,number,number], textColor: 255, fontStyle: 'bold' as const },
      alternateRowStyles: { fillColor: [244, 248, 253] as [number,number,number] },
      margin: { left: 14, right: 14 }
    });

    // ── Page 1: KPIs + Detail table ──
    header(`${projectName} — EVM Dashboard`, `BAC: ${fmt1(kpis.bac)} hrs  |  Exported ${new Date().toLocaleDateString()}`);

    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(24, 95, 165); doc.text('Key Performance Indicators', 14, 26); doc.setTextColor(0);

    (autoTable as any)(doc, {
      startY: 30,
      body: [
        ['EV', fmt1(kpis.curEV) + ' h',  'PV',  fmt1(kpis.curPV) + ' h',  'AC',  fmt1(kpis.curAC) + ' h'],
        ['CPI', fmt2(kpis.curCPI),        'SPI', fmt2(kpis.curSPI),         'BAC', fmt1(kpis.bac)  + ' h'],
        ['CV',  sign(kpis.cv)  + fmt1(kpis.cv)  + ' h', 'SV', sign(kpis.sv)  + fmt1(kpis.sv) + ' h',  'EAC', fmt1(kpis.eac) + ' h'],
        ['VAC', sign(kpis.vac) + fmt1(kpis.vac) + ' h', 'ETC', fmt1(kpis.etc) + ' h', '', ''],
      ],
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' as const }, 2: { fontStyle: 'bold' as const }, 4: { fontStyle: 'bold' as const } },
      theme: 'grid',
      margin: { left: 14, right: 14 }
    });

    let y = (doc as any).lastAutoTable.finalY + 8;

    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(24, 95, 165); doc.text('Period Detail', 14, y); doc.setTextColor(0);

    (autoTable as any)(doc, {
      startY: y + 4,
      head: [['Month', 'PV (h)', 'EV (h)', 'AC (h)', 'SV (h)', 'CV (h)', 'SPI', 'CPI']],
      body: calcData.labels.map((l, i) => [
        l,
        calcData.pv[i]?.toFixed(1),
        calcData.ev[i]?.toFixed(1),
        calcData.ac[i]?.toFixed(1),
        sign(calcData.sv[i]) + calcData.sv[i]?.toFixed(1),
        sign(calcData.cv[i]) + calcData.cv[i]?.toFixed(1),
        calcData.spi[i]?.toFixed(2),
        calcData.cpi[i]?.toFixed(2),
      ]),
      ...tableStyle()
    });

    // ── Page 2: Abbreviations ──
    doc.addPage();
    header('Abbreviations & Definitions', 'EVM Dashboard reference');
    (autoTable as any)(doc, {
      startY: 26,
      head: [['Abbreviation', 'Full Name', 'Definition']],
      body: ABBREV_LIST,
      ...tableStyle(),
      columnStyles: { 0: { fontStyle: 'bold' as const, cellWidth: 22 }, 1: { cellWidth: 50 } }
    });

    doc.save(`${projectName.replace(/[^a-z0-9]/gi, '_')}_EVM_dashboard.pdf`);
  }, [calcData, activeProject]);

  // ── Guard: no project ──────────────────────────────────────────────────────
  if (!activeProject) return (
    <div className="py-24 text-center animate-in fade-in">
      <BarChart3 className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
      <h1 className="text-3xl font-bold text-slate-400">EVM Isolated</h1>
      <p className="mt-2 text-slate-500">Select an active project from the top navigation bar.</p>
    </div>
  );

  const hasData = calcData.labels.length > 0;

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'setup', label: 'Setup Baseline' },
    { key: 'data',  label: 'Monthly Actuals' },
    { key: 'dash',  label: 'EVM Dashboard' },
  ];

  const inputCls = 'w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const cardCls  = 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6';

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">

      {/* ── Top bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Earned Value Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Financial forecasting — visible to Project Manager &amp; Company Manager only.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleLocalSave} className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium text-sm">
            <Download className="w-4 h-4" /> Export .evm
          </button>
          <label className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium text-sm cursor-pointer">
            <Upload className="w-4 h-4" /> Import .evm
            <input type="file" accept=".evm" className="hidden" onChange={handleLocalLoad} />
          </label>
          {hasData && (
            <button onClick={exportPDF} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors flex items-center gap-2 font-medium text-sm">
              <FileDown className="w-4 h-4" /> Export PDF
            </button>
          )}
          <button onClick={saveToCloud} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center gap-2 font-medium text-sm disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Sync to Cloud'}
          </button>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-max">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === t.key ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <>
          {/* ══════════════ SETUP ══════════════ */}
          {activeTab === 'setup' && (
            <div className={cardCls + ' space-y-6'}>
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white"><Settings2 className="w-5 h-5" /> Project Financial Setup</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Contract Value ($)', key: 'contractValue' as const, type: 'number' },
                  { label: 'Budget at Completion — hrs (BAC)', key: 'bac' as const, type: 'number' },
                  { label: 'Avg Labour Rate ($/hr)', key: 'costRate' as const, type: 'number' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                    <input type={f.type} value={(evmState as any)[f.key]}
                      onChange={e => setEvmState(s => ({ ...s, [f.key]: Number(e.target.value) }))}
                      className={inputCls} />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Duration (Months)</label>
                  <input type="number" min={1} max={60} value={evmState.duration}
                    onChange={e => handleDurationChange(Number(e.target.value))}
                    className={inputCls} />
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">S-Curve Baseline — Monthly Planned % (Cumulative)</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setEvmState(s => ({ ...s, planned: s.planned.map((_, i) => Math.round(((i + 1) / s.duration) * 100)) }))}
                      className="px-3 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      Fill Linear
                    </button>
                    <button onClick={() => {
                      const sc = (v: number) => 1 / (1 + Math.exp(-8 * (v - 0.5)));
                      const s0 = sc(0), s1 = sc(1);
                      setEvmState(s => ({ ...s, planned: s.planned.map((_, i) => Math.round((sc((i + 1) / s.duration) - s0) / (s1 - s0) * 100)) }));
                    }} className="px-3 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      Fill S-Curve
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {evmState.planned.map((val, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <label className="text-[10px] font-bold text-slate-400">M{i + 1}</label>
                      <input type="number" min={0} max={100} value={val}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setEvmState(s => { const n = [...s.planned]; n[i] = v; return { ...s, planned: n }; });
                        }}
                        className="w-14 text-center text-sm border border-slate-200 dark:border-slate-700 rounded px-1 py-1 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <div className="w-14 h-1 bg-slate-200 dark:bg-slate-700 rounded-full">
                        <div className="h-1 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, val)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ DATA ══════════════ */}
          {activeTab === 'data' && (
            <div className={cardCls}>
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white mb-4"><Sigma className="w-5 h-5" /> Monthly Progress — Actuals Entry</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3 px-4 font-bold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider">Month</th>
                      <th className="py-3 px-4 font-bold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">Planned % (Cum)</th>
                      <th className="py-3 px-4 font-bold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">Physical % (Cum)</th>
                      <th className="py-3 px-4 font-bold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">Actual Hrs (Cum)</th>
                      <th className="py-3 px-4 font-bold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">EV Preview (h)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {evmState.actuals.map((act, i) => {
                      const evPreview = act.pct != null ? ((act.pct / 100) * evmState.bac).toFixed(1) : '';
                      return (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                          <td className="py-2 px-4 font-semibold text-slate-800 dark:text-slate-200">Month {i + 1}</td>
                          <td className="py-2 px-4 text-right text-slate-500">{evmState.planned[i]}%</td>
                          <td className="py-2 px-4 text-right">
                            <input type="number" placeholder="—" min={0} max={100}
                              value={act.pct ?? ''}
                              onChange={e => {
                                const v = e.target.value === '' ? null : Number(e.target.value);
                                setEvmState(s => { const a = [...s.actuals]; a[i] = { ...a[i], pct: v }; return { ...s, actuals: a }; });
                              }}
                              className="w-24 text-right border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </td>
                          <td className="py-2 px-4 text-right">
                            <input type="number" placeholder="—" min={0}
                              value={act.ac ?? ''}
                              onChange={e => {
                                const v = e.target.value === '' ? null : Number(e.target.value);
                                setEvmState(s => { const a = [...s.actuals]; a[i] = { ...a[i], ac: v }; return { ...s, actuals: a }; });
                              }}
                              className="w-28 text-right border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </td>
                          <td className="py-2 px-4 text-right text-slate-500 text-xs font-mono">{evPreview}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={() => setActiveTab('dash')}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors">
                  View Dashboard →
                </button>
              </div>
            </div>
          )}

          {/* ══════════════ DASHBOARD ══════════════ */}
          {activeTab === 'dash' && (
            <div className="space-y-6">
              {!hasData ? (
                <div className={cardCls + ' text-center py-14'}>
                  <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No actuals entered yet. Go to <strong>Monthly Actuals</strong> and enter at least one month of data.</p>
                </div>
              ) : (
                <>
                  {/* ── KPI Grid ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {[
                      { k: 'EV',  v: fmt1(calcData.kpis.curEV) + ' h',             color: '#3b82f6', neutral: true },
                      { k: 'PV',  v: fmt1(calcData.kpis.curPV) + ' h',             color: '#64748b', neutral: true },
                      { k: 'AC',  v: fmt1(calcData.kpis.curAC) + ' h',             color: '#f97316', neutral: true },
                      { k: 'CPI', v: fmt2(calcData.kpis.curCPI),                   color: calcData.kpis.curCPI >= 1 ? '#10b981' : '#ef4444', neutral: false },
                      { k: 'SPI', v: fmt2(calcData.kpis.curSPI),                   color: calcData.kpis.curSPI >= 1 ? '#10b981' : '#ef4444', neutral: false },
                      { k: 'CV',  v: sign(calcData.kpis.cv)  + fmt1(calcData.kpis.cv) + ' h',  color: calcData.kpis.cv  >= 0 ? '#10b981' : '#ef4444', neutral: false },
                      { k: 'SV',  v: sign(calcData.kpis.sv)  + fmt1(calcData.kpis.sv) + ' h',  color: calcData.kpis.sv  >= 0 ? '#10b981' : '#ef4444', neutral: false },
                      { k: 'EAC', v: fmt1(calcData.kpis.eac) + ' h',              color: '#f59e0b', neutral: true },
                      { k: 'VAC', v: sign(calcData.kpis.vac) + fmt1(calcData.kpis.vac) + ' h', color: calcData.kpis.vac >= 0 ? '#10b981' : '#ef4444', neutral: false },
                      { k: 'ETC', v: fmt1(calcData.kpis.etc) + ' h',              color: '#94a3b8', neutral: true },
                      { k: 'BAC', v: fmt1(calcData.kpis.bac) + ' h',              color: '#94a3b8', neutral: true },
                    ].map(kpi => (
                      <div key={kpi.k}
                        style={{ borderLeftColor: kpi.color }}
                        className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 border-l-4 rounded-xl shadow-sm">
                        <div className="text-xs font-semibold text-slate-500 mb-1">{kpi.k}</div>
                        <div className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── Chart 1: S-Curve ── */}
                  <div className={cardCls}>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Earned Value S-Curve</h3>
                    <ChartLegend items={[
                      { color: '#3b82f6', label: 'PV – planned value' },
                      { color: '#10b981', label: 'EV – earned value' },
                      { color: '#f97316', label: 'AC – actual cost', dash: true },
                    ]} />
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={calcData.sCurveData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.08} />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v.toLocaleString()} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                        <Line type="monotone" dataKey="PV" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} />
                        <Line type="monotone" dataKey="EV" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} />
                        <Line type="monotone" dataKey="AC" stroke="#f97316" strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 3, fill: '#f97316' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* ── Chart 2: Performance Indices ── */}
                  <div className={cardCls}>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Performance Indices</h3>
                    <ChartLegend items={[
                      { color: '#10b981', label: 'CPI' },
                      { color: '#3b82f6', label: 'SPI' },
                      { color: '#b4b2a9', label: '1.0 target', dash: true },
                    ]} />
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={calcData.indexData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.08} />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0.4, 'auto']} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(2)} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} formatter={(v: any) => v != null ? v.toFixed(2) : '—'} />
                        <ReferenceLine y={1} stroke="#b4b2a9" strokeDasharray="4 3" />
                        <Line type="monotone" dataKey="CPI" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} />
                        <Line type="monotone" dataKey="SPI" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* ── Chart 3: Variance ── */}
                  <div className={cardCls}>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Variance (CV &amp; SV)</h3>
                    <ChartLegend items={[
                      { color: '#10b981', label: 'CV – cost variance' },
                      { color: '#3b82f6', label: 'SV – schedule variance' },
                    ]} />
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={calcData.varData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.08} />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v.toLocaleString()} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                        <ReferenceLine y={0} stroke="#475569" strokeOpacity={0.4} />
                        <Bar dataKey="CV" radius={[3, 3, 0, 0]}>
                          {calcData.varData.map((entry, i) => (
                            <Cell key={i} fill={entry.CV >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(217,79,79,0.7)'} />
                          ))}
                        </Bar>
                        <Bar dataKey="SV" radius={[3, 3, 0, 0]}>
                          {calcData.varData.map((entry, i) => (
                            <Cell key={i} fill={entry.SV >= 0 ? 'rgba(59,130,246,0.7)' : 'rgba(186,117,23,0.7)'} />
                          ))}
                        </Bar>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* ── Period Detail Table ── */}
                  <div className={cardCls}>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">Period Detail</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            {['Month','PV','EV','AC','SV','CV','SPI','CPI'].map(h => (
                              <th key={h} className={`py-3 px-3 font-bold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider ${h !== 'Month' ? 'text-right' : ''}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {calcData.labels.map((l, i) => {
                            const sv = calcData.sv[i], cv = calcData.cv[i];
                            const spi = calcData.spi[i], cpi = calcData.cpi[i];
                            return (
                              <tr key={l} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                                <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{l}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">{fmt1(calcData.pv[i])}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">{fmt1(calcData.ev[i])}</td>
                                <td className="py-2 px-3 text-right font-mono text-orange-500">{fmt1(calcData.ac[i])}</td>
                                <td className={`py-2 px-3 text-right font-mono font-semibold ${sv >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{sign(sv)}{fmt1(sv)}</td>
                                <td className={`py-2 px-3 text-right font-mono font-semibold ${cv >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{sign(cv)}{fmt1(cv)}</td>
                                <td className={`py-2 px-3 text-right font-mono font-semibold ${(spi ?? 0) >= 1 ? 'text-emerald-500' : 'text-red-500'}`}>{fmt2(spi)}</td>
                                <td className={`py-2 px-3 text-right font-mono font-semibold ${(cpi ?? 0) >= 1 ? 'text-emerald-500' : 'text-red-500'}`}>{fmt2(cpi)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ══════════════ ABBREVIATIONS ══════════════ */}
      <div className="bg-[#185FA5] rounded-2xl overflow-hidden shadow-lg">
        <div className="px-6 py-4">
          <h2 className="text-white text-base font-bold">Abbreviations &amp; Definitions</h2>
          <p className="text-blue-200 text-xs mt-0.5">EVM Dashboard reference</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0d4a8a]">
                <th className="py-3 px-5 text-left font-bold text-xs text-blue-100 uppercase tracking-wider w-28">Abbreviation</th>
                <th className="py-3 px-5 text-left font-bold text-xs text-blue-100 uppercase tracking-wider w-48">Full Name</th>
                <th className="py-3 px-5 text-left font-bold text-xs text-blue-100 uppercase tracking-wider">Definition</th>
              </tr>
            </thead>
            <tbody>
              {ABBREV_LIST.map(([abbr, name, def], i) => (
                <tr key={abbr} className={i % 2 === 0 ? 'bg-white/10' : 'bg-white/5'}>
                  <td className="py-2.5 px-5 font-bold text-white">{abbr}</td>
                  <td className="py-2.5 px-5 text-blue-100">{name}</td>
                  <td className="py-2.5 px-5 text-blue-200 text-xs">{def}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
