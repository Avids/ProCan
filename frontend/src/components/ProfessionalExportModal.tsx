import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { Loader2, CheckCircle2, AlertCircle, FileDown, Layers, Download } from 'lucide-react';
import { exportProfessionalPDF, ExportStatus } from '../utils/pdfExportUtils';
import api from '../lib/api';

interface ProfessionalExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  includeAttachments: boolean;
}

export default function ProfessionalExportModal({ isOpen, onClose, data, includeAttachments }: ProfessionalExportModalProps) {
  const [status, setStatus] = useState<ExportStatus>('START');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      handleExport();
    }
  }, [isOpen]);

  const handleExport = async () => {
    setStatus('START');
    setError(null);
    try {
      // 1. Fetch latest attachments before starting
      setStatus('FETCHING_ATTACHMENTS');
      const attachRes = await api.get('/attachments', { 
        params: { entityType: data.entityType.toLowerCase(), entityId: data.id } 
      });
      const combinedData = { ...data, attachments: attachRes.data };

      // 2. Start the export process
      await exportProfessionalPDF(combinedData, includeAttachments, (s) => setStatus(s));
    } catch (err: any) {
      console.error('Export failed', err);
      setStatus('ERROR');
      setError(err.message || 'An unexpected error occurred during export.');
    }
  };

  const steps = [
    { id: 'START', label: 'Initializing...', icon: Loader2 },
    { id: 'GENERATING_COVER', label: 'Generating Cover Page', icon: FileDown },
    { id: 'FETCHING_ATTACHMENTS', label: 'Fetching Attachments', icon: Download, condition: includeAttachments },
    { id: 'MERGING_PDFS', label: 'Merging Documents', icon: Layers, condition: includeAttachments },
    { id: 'COMPLETING', label: 'Finalizing Export', icon: CheckCircle2 },
  ].filter(s => s.condition !== false);

  const getStepStatus = (id: string) => {
    if (status === 'ERROR') return 'error';
    // When export is complete, ALL steps should be green
    if (status === 'COMPLETING') return 'complete';
    
    const currentIndex = steps.findIndex(s => s.id === status);
    const stepIndex = steps.findIndex(s => s.id === id);
    
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Professional PDF Export" maxWidth="max-w-md">
      <div className="space-y-6 py-2">
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg mb-6">
          <div className="relative">
             {status === 'COMPLETING' ? (
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center animate-bounce">
                   <Download className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
             ) : status === 'ERROR' ? (
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                   <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
             ) : (
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center overflow-hidden">
                   <Loader2 className="w-8 h-8 text-rose-600 dark:text-rose-400 animate-spin" />
                </div>
             )}
          </div>
          <p className="mt-4 text-sm font-medium text-slate-900 dark:text-white">
            {status === 'ERROR' ? 'Export Failed' : status === 'COMPLETING' ? 'Download Completed ✓' : 'Building Your Document...'}
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((step) => {
            const stepStatus = getStepStatus(step.id);
            const Icon = step.icon;
            
            return (
              <div key={step.id} className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  stepStatus === 'complete' ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' :
                  stepStatus === 'active' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' :
                  'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                }`}>
                  {stepStatus === 'complete' ? <CheckCircle2 className="w-5 h-5" /> : <Icon className={`w-5 h-5 ${stepStatus === 'active' ? 'animate-pulse' : ''}`} />}
                </div>
                <div className="flex-grow">
                  <p className={`text-sm font-medium transition-colors ${
                    stepStatus === 'pending' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'
                  }`}>
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {status === 'ERROR' && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
            <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed font-medium">
              {error}
            </p>
          </div>
        )}

        <div className="pt-4 flex justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              status === 'COMPLETING' 
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {status === 'COMPLETING' ? 'Done' : status === 'ERROR' ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
