import React, { useState, useRef, useEffect } from 'react';
import { FileDown, ChevronDown, FileText, Files } from 'lucide-react';

interface ExportDropdownProps {
  onExportCover: () => void;
  onExportMerged: () => void;
  isLoading?: boolean;
}

export default function ExportDropdown({ onExportCover, onExportMerged, isLoading }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-[11px] font-bold rounded-lg border border-red-200 dark:border-red-800 transition-all hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
      >
        <FileDown className="w-3.5 h-3.5" />
        PDF EXPORT
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-1">
            <button
              onClick={() => { onExportCover(); setIsOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-[11px] uppercase tracking-wider">Cover Page Only</div>
                <div className="text-[10px] text-slate-500 font-normal">Professional summary</div>
              </div>
            </button>
            <button
              onClick={() => { onExportMerged(); setIsOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                <Files className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-[11px] uppercase tracking-wider">Full Document</div>
                <div className="text-[10px] text-slate-500 font-normal">Cover + PDF Attachments</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
