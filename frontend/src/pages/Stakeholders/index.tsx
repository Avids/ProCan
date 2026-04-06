import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Building2, Plus, Pencil, Trash2, Users, Phone, Mail, MapPin,
  ChevronDown, ChevronUp, UserPlus, Star, Search, AlertCircle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type StakeholderType =
  | 'OWNER' | 'GENERAL_CONTRACTOR' | 'ARCHITECT' | 'ENGINEER'
  | 'SUBCONTRACTOR' | 'CONSULTANT' | 'AUTHORITY' | 'OTHER';

interface Contact {
  id: string;
  firstName: string; lastName: string;
  position: string | null; email: string | null; phone: string | null;
  isPrimary: boolean;
}

interface Stakeholder {
  id: string;
  name: string; type: StakeholderType;
  address: string | null; city: string | null;
  phone: string | null; email: string | null; notes: string | null;
  contacts: Contact[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<StakeholderType, string> = {
  OWNER: 'Owner', GENERAL_CONTRACTOR: 'General Contractor',
  ARCHITECT: 'Architect', ENGINEER: 'Engineer',
  SUBCONTRACTOR: 'Subcontractor', CONSULTANT: 'Consultant',
  AUTHORITY: 'Authority / AHJ', OTHER: 'Other',
};

const TYPE_COLORS: Record<StakeholderType, string> = {
  OWNER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  GENERAL_CONTRACTOR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  ARCHITECT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  ENGINEER: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  SUBCONTRACTOR: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  CONSULTANT: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  AUTHORITY: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  OTHER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const emptyStakeholder = { name: '', type: 'OTHER' as StakeholderType, address: '', city: '', phone: '', email: '', notes: '' };
const emptyContact = { firstName: '', lastName: '', position: '', email: '', phone: '', isPrimary: false };

const inputCls = 'w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white';
const cardCls = 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm';

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StakeholdersIndex() {
  const { user } = useAuth();
  const canMutate = ['COMPANY_MANAGER', 'PROJECT_MANAGER'].includes(user?.role || '');

  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Slide-over state
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Stakeholder | null>(null);
  const [form, setForm] = useState(emptyStakeholder);
  const [saving, setSaving] = useState(false);
  const [slideError, setSlideError] = useState('');

  // Contact form state (inline)
  const [contactForm, setContactForm] = useState<{ stakeholderId: string; contactId: string | null; data: typeof emptyContact } | null>(null);
  const [contactSaving, setContactSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/stakeholders');
      setStakeholders(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyStakeholder); setSlideError(''); setSlideOpen(true); };
  const openEdit = (s: Stakeholder) => { setEditing(s); setForm({ name: s.name, type: s.type, address: s.address || '', city: s.city || '', phone: s.phone || '', email: s.email || '', notes: s.notes || '' }); setSlideError(''); setSlideOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { setSlideError('Company name is required.'); return; }
    setSaving(true); setSlideError('');
    try {
      if (editing) {
        await api.patch(`/stakeholders/${editing.id}`, form);
      } else {
        await api.post('/stakeholders', form);
      }
      setSlideOpen(false);
      await load();
    } catch { setSlideError('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!window.confirm('Delete this stakeholder and all their contacts?')) return;
    await api.delete(`/stakeholders/${id}`);
    setStakeholders(s => s.filter(x => x.id !== id));
  };

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const openAddContact = (stakeholderId: string) =>
    setContactForm({ stakeholderId, contactId: null, data: { ...emptyContact } });

  const openEditContact = (stakeholderId: string, c: Contact) =>
    setContactForm({ stakeholderId, contactId: c.id, data: { firstName: c.firstName, lastName: c.lastName, position: c.position || '', email: c.email || '', phone: c.phone || '', isPrimary: c.isPrimary } });

  const saveContact = async () => {
    if (!contactForm) return;
    if (!contactForm.data.firstName || !contactForm.data.lastName) return;
    setContactSaving(true);
    try {
      if (contactForm.contactId) {
        await api.patch(`/stakeholders/${contactForm.stakeholderId}/contacts/${contactForm.contactId}`, contactForm.data);
      } else {
        await api.post(`/stakeholders/${contactForm.stakeholderId}/contacts`, contactForm.data);
      }
      setContactForm(null);
      await load();
    } catch { alert('Failed to save contact.'); }
    finally { setContactSaving(false); }
  };

  const delContact = async (stakeholderId: string, cid: string) => {
    if (!window.confirm('Remove this contact?')) return;
    await api.delete(`/stakeholders/${stakeholderId}/contacts/${cid}`);
    await load();
  };

  const filtered = stakeholders.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    TYPE_LABELS[s.type].toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Stakeholders</h1>
          <p className="text-sm text-slate-500 mt-1">Manage project parties — owners, contractors, consultants, and their contacts.</p>
        </div>
        {canMutate && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Stakeholder
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search by name or type..."
          className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading stakeholders...</div>
      ) : filtered.length === 0 ? (
        <div className={cardCls + ' py-16 text-center'}>
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">{search ? 'No matches found.' : 'No stakeholders yet.'}</p>
          {canMutate && !search && (
            <button onClick={openCreate} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
              Add First Stakeholder
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const isExp = expanded.has(s.id);
            const primary = s.contacts.find(c => c.isPrimary) || s.contacts[0];
            return (
              <div key={s.id} className={cardCls + ' overflow-hidden'}>
                {/* Row */}
                <div className="p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">{s.name}</h2>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${TYPE_COLORS[s.type]}`}>
                        {TYPE_LABELS[s.type]}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {(s.city || s.address) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[s.city, s.address].filter(Boolean).join(', ')}</span>}
                      {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
                      {s.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>}
                    </div>
                    {primary && (
                      <div className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{primary.firstName} {primary.lastName}</span>
                        {primary.position && <span>· {primary.position}</span>}
                        {s.contacts.length > 1 && <span className="text-slate-400">+{s.contacts.length - 1} more</span>}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleExpand(s.id)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title={isExp ? 'Collapse' : 'Expand contacts'}>
                      {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {canMutate && (
                      <>
                        <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => del(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>

                {/* Contacts expanded panel */}
                {isExp && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contacts</span>
                      {canMutate && (
                        <button onClick={() => openAddContact(s.id)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                          <UserPlus className="w-3.5 h-3.5" /> Add Contact
                        </button>
                      )}
                    </div>

                    {s.contacts.length === 0 && <p className="text-sm text-slate-400 italic">No contacts added yet.</p>}

                    {s.contacts.map(c => (
                      <div key={c.id} className="flex items-start gap-3 bg-white dark:bg-slate-950 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-500">
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">{c.firstName} {c.lastName}</span>
                            {c.isPrimary && <span title="Primary contact"><Star className="w-3 h-3 text-amber-500" style={{ fill: '#f59e0b' }} /></span>}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                            {c.position && <span>{c.position}</span>}
                            {c.email && <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" />{c.email}</span>}
                            {c.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{c.phone}</span>}
                          </div>
                        </div>
                        {canMutate && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => openEditContact(s.id, c)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => delContact(s.id, c.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Inline contact form */}
                    {contactForm?.stakeholderId === s.id && (
                      <div className="bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-bold text-blue-600 mb-2">{contactForm.contactId ? 'Edit Contact' : 'New Contact'}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">First Name *</label>
                            <input className={inputCls} value={contactForm.data.firstName}
                              onChange={e => setContactForm(f => f ? { ...f, data: { ...f.data, firstName: e.target.value } } : f)} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Last Name *</label>
                            <input className={inputCls} value={contactForm.data.lastName}
                              onChange={e => setContactForm(f => f ? { ...f, data: { ...f.data, lastName: e.target.value } } : f)} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Position / Title</label>
                            <input className={inputCls} value={contactForm.data.position}
                              onChange={e => setContactForm(f => f ? { ...f, data: { ...f.data, position: e.target.value } } : f)} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                            <input className={inputCls} value={contactForm.data.phone}
                              onChange={e => setContactForm(f => f ? { ...f, data: { ...f.data, phone: e.target.value } } : f)} />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                            <input className={inputCls} type="email" value={contactForm.data.email}
                              onChange={e => setContactForm(f => f ? { ...f, data: { ...f.data, email: e.target.value } } : f)} />
                          </div>
                          <div className="col-span-2 flex items-center gap-2">
                            <input type="checkbox" id="isPrimary" checked={contactForm.data.isPrimary}
                              onChange={e => setContactForm(f => f ? { ...f, data: { ...f.data, isPrimary: e.target.checked } } : f)}
                              className="rounded" />
                            <label htmlFor="isPrimary" className="text-sm text-slate-600 dark:text-slate-400">Primary contact</label>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={saveContact} disabled={contactSaving}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                            {contactSaving ? 'Saving…' : 'Save Contact'}
                          </button>
                          <button onClick={() => setContactForm(null)} className="px-3 py-1.5 text-slate-500 hover:text-slate-700 text-xs">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Stakeholder Slide-Over ── */}
      {slideOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setSlideOpen(false)} />
          <div className="w-full max-w-md bg-white dark:bg-slate-950 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Stakeholder' : 'New Stakeholder'}
              </h2>
              <button onClick={() => setSlideOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Company Name *</label>
                <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Construction Ltd." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Type</label>
                <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as StakeholderType }))}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Address</label>
                <input className={inputCls} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">City</label>
                <input className={inputCls} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Toronto" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Phone</label>
                <input className={inputCls} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (416) 000-0000" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                <input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@company.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes</label>
                <textarea className={inputCls} rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
              </div>
              {slideError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg text-sm border border-red-200 dark:border-red-800">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{slideError}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3">
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Stakeholder'}
              </button>
              <button onClick={() => setSlideOpen(false)} className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
