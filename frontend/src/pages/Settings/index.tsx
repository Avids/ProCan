import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, Building2, Phone, Mail, Globe, MapPin, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface CompanySettings {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

const inputCls = 'w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white placeholder:text-slate-400';

export default function SettingsIndex() {
  const { user } = useAuth();
  const isManager = user?.role === 'COMPANY_MANAGER';

  const [form, setForm] = useState<CompanySettings>({
    id: 'singleton', name: '', address: '', city: '', province: '',
    postalCode: '', phone: '', email: '', website: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/settings/company')
      .then(res => setForm(res.data))
      .catch(() => setError('Could not load company settings.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!form.name.trim()) { setError('Company name is required.'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await api.put('/settings/company', form);
      setForm(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { setError('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const set = (key: keyof CompanySettings, val: string) => setForm(f => ({ ...f, [key]: val }));

  if (loading) return <div className="text-center py-20 text-slate-400">Loading settings…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Company Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your company info is used in PDF report headers across EVM, RFIs, Submittals, and more.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Company Identity</h2>
            <p className="text-xs text-slate-500">Appears in the header of all generated PDF documents.</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Company Name *</label>
          <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="ProCan Construction Inc." disabled={!isManager} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Address</span>
            </label>
            <input className={inputCls} value={form.address || ''} onChange={e => set('address', e.target.value)}
              placeholder="123 Construction Blvd" disabled={!isManager} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">City</label>
            <input className={inputCls} value={form.city || ''} onChange={e => set('city', e.target.value)}
              placeholder="Toronto" disabled={!isManager} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Province / State</label>
            <input className={inputCls} value={form.province || ''} onChange={e => set('province', e.target.value)}
              placeholder="Ontario" disabled={!isManager} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Postal / Zip Code</label>
            <input className={inputCls} value={form.postalCode || ''} onChange={e => set('postalCode', e.target.value)}
              placeholder="M1A 1A1" disabled={!isManager} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />Phone</span>
            </label>
            <input className={inputCls} value={form.phone || ''} onChange={e => set('phone', e.target.value)}
              placeholder="+1 (416) 000-0000" disabled={!isManager} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />Email</span>
            </label>
            <input className={inputCls} type="email" value={form.email || ''} onChange={e => set('email', e.target.value)}
              placeholder="info@company.com" disabled={!isManager} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              <span className="flex items-center gap-1"><Globe className="w-3 h-3" />Website</span>
            </label>
            <input className={inputCls} value={form.website || ''} onChange={e => set('website', e.target.value)}
              placeholder="https://www.company.com" disabled={!isManager} />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg text-sm border border-red-200 dark:border-red-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />Settings saved successfully.
          </div>
        )}

        {isManager && (
          <div className="flex justify-end pt-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        )}

        {!isManager && (
          <p className="text-xs text-slate-400 italic text-center">Only Company Managers can edit company settings.</p>
        )}
      </div>

      {/* PDF Preview */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5" />PDF Header Preview
        </p>
        <div className="bg-blue-700 rounded-xl px-5 py-3 text-white">
          <p className="text-base font-bold">{form.name || 'Your Company Name'}</p>
          <p className="text-xs text-blue-200 mt-0.5">
            {[form.address, form.city, form.province, form.postalCode].filter(Boolean).join(', ') || '123 Main St, City, Province'}
            {form.phone && ` · ${form.phone}`}
            {form.email && ` · ${form.email}`}
          </p>
        </div>
      </div>
    </div>
  );
}
