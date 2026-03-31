import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

const sanitizeFileName = (name: string) => {
  return name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_').trim();
};

/**
 * Exports data to an Excel file (.xlsx)
 * Uses XLSX.writeFile() — the library's own native file-write path.
 * This avoids blob: URLs and data: URIs entirely, both of which Chrome
 * blocks when the page is served from localhost.
 */
export const exportToExcel = (
  data: any[],
  fileName: string,
  sheetName: string = 'Sheet1'
) => {
  const sanitized = sanitizeFileName(fileName) + '.xlsx';
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, sanitized);
};

/**
 * Exports data to a PDF file (.pdf) with a table
 * Uses doc.save() — jsPDF's own native download trigger.
 * Same reasoning: no blob/anchor/data-URI involved.
 */
export const exportToPDF = (
  data: any[][],
  columns: string[],
  fileName: string,
  title: string
) => {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text(title, 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

  autoTable(doc, {
    head: [columns],
    body: data,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const sanitized = sanitizeFileName(fileName) + '.pdf';
  doc.save(sanitized);
};

/**
 * Exports a specific HTML element to a PDF (Detail view)
 */
export const exportDetailToPDF = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');

  const doc = new jsPDF('p', 'mm', 'a4');
  const imgProps = doc.getImageProperties(imgData);
  const pdfWidth = doc.internal.pageSize.getWidth();
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

  doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

  const sanitized = sanitizeFileName(fileName) + '.pdf';
  doc.save(sanitized);
};