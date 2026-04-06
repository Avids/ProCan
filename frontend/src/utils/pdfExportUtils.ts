import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import api from '../lib/api';

interface ExportData {
  entityType: 'RFI' | 'SUBMITTAL';
  number: string;
  revision: number;
  title: string;
  date: string;
  project: string;
  fromName: string;
  fromPosition?: string;
  toName: string;
  toCompany?: string;
  description: string;
  response?: string | null;
  notes?: string | null;
  attachments: any[];
  company: {
    name: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
  };
}

export const exportProfessionalPDF = async (data: ExportData, includeAttachments: boolean = false) => {
  const doc = new jsPDF();
  const PAGE_WIDTH = doc.internal.pageSize.getWidth();
  const MARGIN = 15;

  // 1. Header (Logo & Company Info)
  let currentY = 15;
  if (data.company.logoUrl) {
    try {
      // Note: In a real app, you'd want to proxy this or ensure CORS. 
      // For now, we'll try to add it. If it fails, we skip.
      doc.addImage(data.company.logoUrl, 'JPEG', MARGIN, currentY, 25, 25);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(data.company.name, MARGIN + 30, currentY + 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      const companyDetails = [
        data.company.address,
        [data.company.city, data.company.province, data.company.postalCode].filter(Boolean).join(', '),
        data.company.phone ? `Tel: ${data.company.phone}` : null,
        data.company.email ? `Email: ${data.company.email}` : null
      ].filter(Boolean).join(' | ');
      doc.text(companyDetails, MARGIN + 30, currentY + 16);
      currentY += 30;
    } catch (e) {
      console.warn('Failed to load logo in PDF', e);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(data.company.name, MARGIN, currentY + 10);
      currentY += 20;
    }
  } else {
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(data.company.name, MARGIN, currentY + 10);
    currentY += 20;
  }

  doc.setDrawColor(200);
  doc.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY);
  currentY += 15;

  // 2. Document Title
  doc.setFontSize(24);
  doc.setTextColor(40);
  doc.text(data.entityType === 'RFI' ? 'REQUEST FOR INFORMATION' : 'SUBMITTAL', PAGE_WIDTH / 2, currentY, { align: 'center' });
  currentY += 15;

  // 3. Info Table
  const tableData = [
    ['Project:', data.project, 'Number:', data.number],
    ['Subject:', data.title, 'Revision:', `Rev ${data.revision}`],
    ['Date:', data.date, 'From:', data.fromName],
    ['To:', data.toName + (data.toCompany ? ` (${data.toCompany})` : ''), '', '']
  ];

  autoTable(doc, {
    body: tableData,
    startY: currentY,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30 },
      1: { cellWidth: 70 },
      2: { fontStyle: 'bold', cellWidth: 20 },
      3: { cellWidth: 50 },
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // 4. Description / Question
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(data.entityType === 'RFI' ? 'Question:' : 'Description:', MARGIN, currentY);
  currentY += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const descLines = doc.splitTextToSize(data.description || 'No description provided.', PAGE_WIDTH - 2 * MARGIN);
  doc.text(descLines, MARGIN, currentY);
  currentY += descLines.length * 5 + 10;

  // 5. Response (for RFI)
  if (data.entityType === 'RFI' && data.response) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Response:', MARGIN, currentY);
    currentY += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const respLines = doc.splitTextToSize(data.response, PAGE_WIDTH - 2 * MARGIN);
    doc.text(respLines, MARGIN, currentY);
    currentY += respLines.length * 5 + 10;
  }

  // 6. Notes (for Submittal)
  if (data.notes) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', MARGIN, currentY);
    currentY += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const noteLines = doc.splitTextToSize(data.notes, PAGE_WIDTH - 2 * MARGIN);
    doc.text(noteLines, MARGIN, currentY);
    currentY += noteLines.length * 5 + 10;
  }

  // 7. Attachments List
  if (data.attachments.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Attachments:', MARGIN, currentY);
    currentY += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    data.attachments.forEach((a, i) => {
      const label = a.label || a.filename || a.url;
      doc.text(`${i + 1}. ${label}`, MARGIN + 5, currentY);
      currentY += 5;
    });
  }

  // Footer - Page Number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  // 7. Merging Logic
  if (includeAttachments) {
    const pdfBytes = doc.output('arraybuffer');
    const resultPdf = await PDFDocument.create();
    const coverDoc = await PDFDocument.load(pdfBytes);
    const [coverPage] = await resultPdf.copyPages(coverDoc, [0]);
    resultPdf.addPage(coverPage);

    // Filter for PDF attachments only
    const pdfAttachments = data.attachments.filter(a => a.kind === 'FILE' && a.url.toLowerCase().endsWith('.pdf'));

    for (const attach of pdfAttachments) {
      try {
        const res = await fetch(attach.url);
        const bytes = await res.arrayBuffer();
        const attachDoc = await PDFDocument.load(bytes);
        const pages = await resultPdf.copyPages(attachDoc, attachDoc.getPageIndices());
        pages.forEach(p => resultPdf.addPage(p));
      } catch (e) {
        console.error('Failed to merge attachment:', attach.label, e);
      }
    }

    const mergedBytes = await resultPdf.save();
    const blob = new Blob([mergedBytes.buffer as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.entityType}_${data.number}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  } else {
    doc.save(`${data.entityType}_${data.number}.pdf`);
  }
};
