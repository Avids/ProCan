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
  responseDate?: string | null;
  status?: string;
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

export type ExportStatus = 'START' | 'GENERATING_COVER' | 'FETCHING_ATTACHMENTS' | 'MERGING_PDFS' | 'COMPLETING' | 'ERROR';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'DRAFT', SUBMITTED: 'SUBMITTED', ANSWERED: 'ANSWERED',
  CLOSED: 'CLOSED', UNDER_REVIEW: 'FOR REVIEW', APPROVED: 'APPROVED',
  REJECTED: 'REJECTED', REVISE_AND_RESUBMIT: 'REVISE & RESUBMIT',
};

const STATUS_COLOR = (status?: string): [number, number, number] => {
  const map: Record<string, [number, number, number]> = {
    DRAFT:               [107, 114, 128],
    SUBMITTED:           [37,  99,  235],
    ANSWERED:            [22,  163, 74],
    CLOSED:              [30,  41,  59],
    UNDER_REVIEW:        [180, 100, 10],
    APPROVED:            [21,  128, 61],
    REJECTED:            [185, 28,  28],
    REVISE_AND_RESUBMIT: [194, 65,  12],
  };
  return (status && map[status]) ? map[status] : [80, 80, 80];
};

export const exportProfessionalPDF = async (
  data: ExportData,
  includeAttachments: boolean = false,
  onStatus?: (status: ExportStatus) => void
) => {
  onStatus?.('START');

  // Letter page: 215.9mm × 279.4mm
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const PAGE_W  = doc.internal.pageSize.getWidth();  // ~215.9
  const PAGE_H  = doc.internal.pageSize.getHeight(); // ~279.4
  const ML      = 12;   // left/right margin
  const CW      = PAGE_W - ML * 2;  // content width ~191.9

  // Column widths that must sum exactly to CW
  const C0 = 28, C1 = 64, C2 = 26, C3 = CW - C0 - C1 - C2; // ~73.9

  // ── Fetch logo via backend proxy ──────────────────────────────────────────
  const fetchLogoBase64 = async (): Promise<string | null> => {
    try {
      const resp = await api.get('/settings/logo/proxy');
      return resp.data?.base64 || null;
    } catch { return null; }
  };

  onStatus?.('GENERATING_COVER');

  // ── 1. HEADER ZONE ────────────────────────────────────────────────────────
  const HEADER_H = 26;
  doc.setFillColor(252, 252, 252);
  doc.rect(0, 0, PAGE_W, HEADER_H, 'F');

  const base64Logo = data.company.logoUrl ? await fetchLogoBase64() : null;
  if (base64Logo) {
    try { doc.addImage(base64Logo, 'JPEG', ML, 4, 16, 16); } catch { /* skip */ }
  }
  const textX = base64Logo ? ML + 20 : ML;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(data.company.name, textX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  const addrParts = [
    data.company.address,
    [data.company.city, data.company.province, data.company.postalCode].filter(Boolean).join(', '),
    data.company.phone  ? `Tel: ${data.company.phone}`   : null,
    data.company.email  ? `Email: ${data.company.email}` : null,
  ].filter(Boolean);
  if (addrParts.length) doc.text(addrParts.join('   ·   '), textX, 17);

  let Y = HEADER_H;

  // ── 2. TITLE BANNER ───────────────────────────────────────────────────────
  const BANNER_H = 10;
  doc.setFillColor(30, 41, 59);
  doc.rect(0, Y, PAGE_W, BANNER_H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  const titleLabel = data.entityType === 'RFI'
    ? 'REQUEST FOR INFORMATION (RFI)'
    : 'SUBMITTAL TRANSMITTAL';
  doc.text(titleLabel, ML, Y + 7);
  doc.text(`${data.number}  /  Rev ${data.revision}`, PAGE_W - ML, Y + 7, { align: 'right' });

  Y += BANNER_H + 4;

  // ── 3. INFO TABLE — drawn 100% manually for perfect rounded corners ────────
  const ROW_H = 9;   // each row height in mm
  const ROWS  = 3;
  const tableStartY = Y;
  const totalTableH = ROWS * ROW_H;

  const LBG: [number, number, number] = [243, 244, 246]; // label background
  const X0 = ML, X1 = ML + C0, X2 = ML + C0 + C1, X3 = ML + C0 + C1 + C2;

  // Helper: fill a cell and write text inside it
  const fillCell = (
    x: number, y: number, w: number, h: number,
    text: string, bold: boolean, bg?: [number, number, number]
  ) => {
    if (bg) { doc.setFillColor(...bg); doc.rect(x, y, w, h, 'F'); }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    const clipped = doc.splitTextToSize(text, w - 5)[0]; // single line, clipped
    doc.text(clipped, x + 3, y + h / 2 + 1.5);
  };

  // ── Row backgrounds (fill first so lines draw on top) ──
  // Row 1
  fillCell(X0, tableStartY,          C0, ROW_H, 'Project:', true,  LBG);
  fillCell(X1, tableStartY,          C1, ROW_H, data.project, false);
  fillCell(X2, tableStartY,          C2, ROW_H, 'Date:',    true,  LBG);
  fillCell(X3, tableStartY,          C3, ROW_H, data.date,  false);
  // Row 2
  fillCell(X0, tableStartY + ROW_H,  C0, ROW_H, 'From:',   true,  LBG);
  fillCell(X1, tableStartY + ROW_H,  C1, ROW_H, data.fromName, false);
  fillCell(X2, tableStartY + ROW_H,  C2, ROW_H, 'To:',     true,  LBG);
  fillCell(X3, tableStartY + ROW_H,  C3, ROW_H, data.toName + (data.toCompany ? ` (${data.toCompany})` : ''), false);
  // Row 3 — Subject (label + bold value spanning rest)
  fillCell(X0, tableStartY + 2 * ROW_H, C0, ROW_H, 'Subject:', true, LBG);
  fillCell(X1, tableStartY + 2 * ROW_H, C1 + C2 + C3, ROW_H, data.title, true); // bold value

  // ── Internal grid lines ──
  doc.setDrawColor(210, 213, 218);
  doc.setLineWidth(0.15);
  // Horizontal separators
  doc.line(X0, tableStartY + ROW_H,     X0 + CW, tableStartY + ROW_H);
  doc.line(X0, tableStartY + 2 * ROW_H, X0 + CW, tableStartY + 2 * ROW_H);
  // Vertical separators
  doc.line(X1, tableStartY, X1, tableStartY + totalTableH);           // after col 0
  doc.line(X2, tableStartY, X2, tableStartY + 2 * ROW_H);            // after col 1 (rows 1–2 only)
  doc.line(X3, tableStartY, X3, tableStartY + 2 * ROW_H);            // after col 2 (rows 1–2 only)

  // ── Outer rounded border ──
  doc.setDrawColor(180, 185, 195);
  doc.setLineWidth(0.35);
  doc.roundedRect(X0, tableStartY, CW, totalTableH, 2, 2);

  // ── Status text below table: right-aligned, bold, no background ──────────
  Y = tableStartY + totalTableH + 2;
  if (data.status) {
    const statusLabel = STATUS_LABELS[data.status] || data.status;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(statusLabel, ML + CW, Y + 4, { align: 'right' });
    Y += 7;
  } else {
    Y += 5;
  }


  // ── 4. CONTENT SECTIONS ───────────────────────────────────────────────────
  const drawSection = (title: string, content: string | null | undefined, yPos: number, sideDate?: string | null): number => {
    if (!content?.trim()) return yPos;

    // Header bar
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(210, 213, 218);
    doc.setLineWidth(0.15);
    const headerH = 7;
    doc.roundedRect(ML, yPos, CW, headerH, 1.5, 1.5, 'FD');

    // Title left
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(title, ML + 3, yPos + 5);

    // Optional date right
    if (sideDate) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(sideDate, ML + CW - 3, yPos + 5, { align: 'right' });
    }

    yPos += headerH;

    // Content box
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(content, CW - 8);
    const boxH  = lines.length * 4.8 + 5;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(ML, yPos, CW, boxH, 1.5, 1.5, 'FD');
    doc.text(lines, ML + 4, yPos + 5);
    return yPos + boxH + 4;
  };

  const questionLabel = data.entityType === 'RFI' ? 'Question:' : 'Description:';
  Y = drawSection(questionLabel, data.description, Y);
  if (data.entityType === 'RFI' && data.response) {
    const respDateLabel = data.responseDate ? `Response Date: ${data.responseDate}` : undefined;
    Y = drawSection('Response:', data.response, Y, respDateLabel);
  }
  if (data.notes) {
    const noteDateLabel = data.responseDate ? `Return Date: ${data.responseDate}` : undefined;
    Y = drawSection('Notes:', data.notes, Y, noteDateLabel);
  }

  // ── 5. ATTACHMENTS LIST ───────────────────────────────────────────────────
  if (data.attachments.length > 0) {
    // Title on its own line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text('Attachments:', ML, Y + 5.5);
    Y += 8;   // advance past the title

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    data.attachments.forEach((a, i) => {
      const label      = a.label || a.filename || a.url;
      const displayUrl = a.kind === 'LINK' ? `  (${a.url})` : '';
      doc.text(`${i + 1}.  ${label}${displayUrl}`, ML + 4, Y + 4.5);
      Y += 5.5;
    });
    Y += 2;
  }

  // ── 6. FOOTER ─────────────────────────────────────────────────────────────
  const FOOTER_Y = PAGE_H - 10;
  const pageCount = doc.getNumberOfPages();
  for (let pg = 1; pg <= pageCount; pg++) {
    doc.setPage(pg);

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(ML, FOOTER_Y - 2, PAGE_W - ML, FOOTER_Y - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(`Page ${pg} of ${pageCount}   ·   Confidential`, ML, FOOTER_Y + 3);


    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, PAGE_W - ML, FOOTER_Y + 7.5, { align: 'right' });
  }

  // ── 7. MERGING LOGIC ──────────────────────────────────────────────────────
  const name = `${data.entityType}_${data.number}`
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .trim() || 'export';

  if (includeAttachments) {
    const isPdf = (a: any) => {
      if (a.kind !== 'FILE') return false;
      if (a.mimeType === 'application/pdf') return true;
      try { return new URL(a.url).pathname.toLowerCase().endsWith('.pdf'); }
      catch { return a.url.toLowerCase().split('?')[0].endsWith('.pdf'); }
    };
    const pdfAttachments = data.attachments.filter(isPdf);

    if (pdfAttachments.length === 0) {
      onStatus?.('COMPLETING');
      doc.save(`${name}.pdf`);
      return;
    }

    onStatus?.('FETCHING_ATTACHMENTS');
    const pdfBytes  = doc.output('arraybuffer');
    const resultPdf = await PDFDocument.create();
    const coverDoc  = await PDFDocument.load(pdfBytes);
    const coverPgs  = await resultPdf.copyPages(coverDoc, coverDoc.getPageIndices());
    coverPgs.forEach(p => resultPdf.addPage(p));

    onStatus?.('MERGING_PDFS');
    for (const attach of pdfAttachments) {
      try {
        const res  = await api.get(`/attachments/${attach.id}/proxy`, { responseType: 'arraybuffer' });
        const adoc = await PDFDocument.load(res.data);
        const apgs = await resultPdf.copyPages(adoc, adoc.getPageIndices());
        apgs.forEach(p => resultPdf.addPage(p));
      } catch (err) {
        console.error('Failed to merge attachment:', attach.label, err);
      }
    }

    const merged = await resultPdf.save();
    const blob   = new Blob([merged as any], { type: 'application/pdf' });
    const url    = URL.createObjectURL(blob);
    const link   = document.createElement('a');
    link.href     = url;
    link.download  = `${name}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onStatus?.('COMPLETING');
  } else {
    onStatus?.('COMPLETING');
    doc.save(`${name}.pdf`);
  }
};
