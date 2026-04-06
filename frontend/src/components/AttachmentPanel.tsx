import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import {
  Paperclip, Link2, Upload, Plus, Trash2, FileText, FileImage,
  File, ExternalLink, AlertCircle, Loader2, X, Check
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type AttachmentEntityType = 'submittal' | 'rfi' | 'project_document';

interface AttachmentRecord {
  id: string;
  kind: 'FILE' | 'LINK';
  label: string | null;
  url: string;
  filename: string | null;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string };
}

interface AttachmentPanelProps {
  entityType: AttachmentEntityType;
  entityId: string;
  canMutate: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const FILE_LIMIT = 2;
const LINK_LIMIT = 3;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mime }: { mime: string | null }) {
  if (!mime) return <File className="w-4 h-4" />;
  if (mime.startsWith('image/')) return <FileImage className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AttachmentPanel({ entityType, entityId, canMutate }: AttachmentPanelProps) {
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Link form state
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [linkError, setLinkError] = useState('');

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await api.get('/attachments', { params: { entityType, entityId } });
      setAttachments(res.data);
    } catch { setError('Failed to load attachments'); }
    finally { setLoading(false); }
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const files = attachments.filter(a => a.kind === 'FILE');
  const links = attachments.filter(a => a.kind === 'LINK');
  const canAddFile = files.length < FILE_LIMIT;
  const canAddLink = links.length < LINK_LIMIT;

  // ── Upload file ───────────────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    if (!canAddFile) { setUploadError(`Maximum ${FILE_LIMIT} files allowed.`); return; }
    if (file.size > 50 * 1024 * 1024) { setUploadError('File must be under 50 MB.'); return; }

    setUploading(true); setUploadError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    formData.append('label', file.name);
    try {
      await api.post('/attachments/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await load();
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally { setUploading(false); }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
  };

  // ── Add link ─────────────────────────────────────────────────────────────
  const handleAddLink = async () => {
    if (!linkUrl.trim()) { setLinkError('URL is required.'); return; }
    try { new URL(linkUrl); } catch { setLinkError('Please enter a valid URL (include https://).'); return; }

    setSavingLink(true); setLinkError('');
    try {
      await api.post('/attachments/link', {
        entityType, entityId,
        url: linkUrl.trim(),
        label: linkLabel.trim() || linkUrl.trim(),
      });
      setLinkUrl(''); setLinkLabel(''); setShowLinkForm(false);
      await load();
    } catch (err: any) {
      setLinkError(err.response?.data?.error || 'Failed to save link.');
    } finally { setSavingLink(false); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this attachment?')) return;
    try {
      await api.delete(`/attachments/${id}`);
      setAttachments(prev => prev.filter(a => a.id !== id));
    } catch { alert('Failed to remove attachment.'); }
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 text-sm py-3">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading attachments…
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Section Header ── */}
      <div className="flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Attachments &amp; Links
        </span>
        <span className="text-xs text-slate-400">
          ({files.length}/{FILE_LIMIT} files · {links.length}/{LINK_LIMIT} links)
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-xs">
          <AlertCircle className="w-3.5 h-3.5" />{error}
        </div>
      )}

      {/* ── Files ── */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.id}
              className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 group">
              <div className="w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 flex-shrink-0">
                <FileIcon mime={f.mimeType} />
              </div>
              <div className="flex-1 min-w-0">
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 truncate block transition-colors">
                  {f.label || f.filename}
                </a>
                <div className="text-xs text-slate-400 flex gap-2">
                  {f.fileSize && <span>{formatBytes(f.fileSize)}</span>}
                  <span>· {f.uploadedBy.firstName} {f.uploadedBy.lastName}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="p-1 text-slate-400 hover:text-blue-600 transition-colors" title="Open">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {canMutate && (
                  <button onClick={() => handleDelete(f.id)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors" title="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Links ── */}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map(l => (
            <div key={l.id}
              className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 group">
              <div className="w-8 h-8 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 flex-shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <a href={l.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-violet-600 dark:hover:text-violet-400 truncate block transition-colors">
                  {l.label}
                </a>
                <div className="text-xs text-slate-400 truncate">{l.url}</div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={l.url} target="_blank" rel="noopener noreferrer"
                  className="p-1 text-slate-400 hover:text-violet-600 transition-colors" title="Open link">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {canMutate && (
                  <button onClick={() => handleDelete(l.id)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors" title="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {files.length === 0 && links.length === 0 && (
        <p className="text-xs text-slate-400 italic py-1">No attachments or links yet.</p>
      )}

      {/* ── Link form ── */}
      {showLinkForm && (
        <div className="p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg space-y-2">
          <p className="text-xs font-bold text-violet-700 dark:text-violet-400">Add External Link</p>
          <input
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white placeholder:text-slate-400"
            placeholder="https://sharepoint.com/file.pdf"
            value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddLink()}
            autoFocus
          />
          <input
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white placeholder:text-slate-400"
            placeholder="Display name (optional)"
            value={linkLabel} onChange={e => setLinkLabel(e.target.value)}
          />
          {linkError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{linkError}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleAddLink} disabled={savingLink}
              className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
              {savingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save Link
            </button>
            <button onClick={() => { setShowLinkForm(false); setLinkUrl(''); setLinkLabel(''); setLinkError(''); }}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-700 text-xs transition-colors flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Upload error ── */}
      {uploadError && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />{uploadError}
        </p>
      )}

      {/* ── Action buttons ── */}
      {canMutate && (
        <div className="flex flex-wrap gap-2 pt-1">

          {/* Upload File */}
          <label
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer
              ${canAddFile && !uploading
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed pointer-events-none'
              }`}
            onDragOver={e => { e.preventDefault(); if (canAddFile) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={canAddFile ? onDrop : undefined}
            title={!canAddFile ? `Maximum ${FILE_LIMIT} files reached` : 'Upload a file'}
          >
            {uploading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Upload className="w-3.5 h-3.5" />
            }
            {uploading ? 'Uploading…' : `Upload File (${files.length}/${FILE_LIMIT})`}
            {canAddFile && !uploading && (
              <input type="file" className="hidden" onChange={onInputChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.png,.jpg,.jpeg,.zip" />
            )}
          </label>

          {/* Add Link */}
          {!showLinkForm && (
            <button
              onClick={() => { if (canAddLink) { setShowLinkForm(true); setLinkError(''); } }}
              disabled={!canAddLink}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border
                ${canAddLink
                  ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                }`}
              title={!canAddLink ? `Maximum ${LINK_LIMIT} links reached` : 'Add external link'}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Link ({links.length}/{LINK_LIMIT})
            </button>
          )}
        </div>
      )}

      {/* Drag overlay hint */}
      {dragOver && (
        <div className="fixed inset-0 z-40 bg-blue-500/10 border-4 border-dashed border-blue-400 rounded-2xl pointer-events-none flex items-center justify-center">
          <p className="text-blue-600 font-bold text-lg">Drop file here</p>
        </div>
      )}
    </div>
  );
}
