/**
 * PDF generation wrapper using PDFKit.
 * Phase 4 — Surat Jalan PDF.
 *
 * Avoids puppeteer (heavy + chromium dep). PDFKit is light, sync render.
 */

import PDFDocument from 'pdfkit';
import { logger } from '../config/logger.js';

export type PdfDocInput = {
  title: string;
  docNumber: string;
  meta: Array<{ label: string; value: string }>;
  headers: string[];
  rows: Array<Array<string>>;
  footer?: string;
};

/**
 * Render a generic table-style document to a PDF Buffer.
 */
export function renderSimplePdf(input: PdfDocInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text(input.title, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).text(`No: ${input.docNumber}`, { align: 'center' });
      doc.moveDown(1);

      // Meta block (label: value)
      doc.fontSize(10);
      for (const m of input.meta) {
        doc.text(`${m.label}: ${m.value}`, { continued: false });
      }
      doc.moveDown(1);

      // Table
      const colWidth = (doc.page.width - 100) / input.headers.length;
      const startX = 50;
      let y = doc.y;

      // Header row
      doc.font('Helvetica-Bold').fontSize(10);
      input.headers.forEach((h, i) => {
        doc.text(h, startX + i * colWidth, y, { width: colWidth, align: 'left' });
      });
      y += 20;
      doc.moveTo(startX, y - 5).lineTo(doc.page.width - 50, y - 5).stroke();
      doc.font('Helvetica').fontSize(9);

      // Data rows
      for (const row of input.rows) {
        if (y > doc.page.height - 100) {
          doc.addPage();
          y = 50;
        }
        row.forEach((cell, i) => {
          doc.text(String(cell), startX + i * colWidth, y, { width: colWidth, align: 'left' });
        });
        y += 18;
      }

      if (input.footer) {
        doc.moveDown(2);
        doc.fontSize(9).text(input.footer, { align: 'center' });
      }

      doc.end();
    } catch (err: any) {
      logger.error({ err }, 'renderSimplePdf failed');
      reject(err);
    }
  });
}