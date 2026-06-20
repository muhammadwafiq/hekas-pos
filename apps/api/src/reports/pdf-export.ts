/**
 * PDF export helper — single-section summary report.
 * Returns a Buffer containing the .pdf file.
 * Suitable for print-friendly executive reports.
 */

import PDFDocument from 'pdfkit';

export interface PdfSection {
  heading: string;
  rows: { label: string; value: string }[];
}

export interface PdfReportInput {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
}

export function buildPdf(input: PdfReportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 60, left: 50, right: 50 },
      info: { Title: input.title, Author: 'HEKAS POS' },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(input.title, { align: 'center' });
    if (input.subtitle) {
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .font('Helvetica-Oblique')
        .fillColor('#555555')
        .text(input.subtitle, { align: 'center' });
      doc.fillColor('black');
    }
    doc.moveDown(1);

    for (const section of input.sections) {
      // Heading
      doc.fontSize(12).font('Helvetica-Bold').text(section.heading);
      doc.moveDown(0.3);
      // Underline
      const startX = doc.x;
      const yLine = doc.y;
      doc
        .strokeColor('#1F4E78')
        .lineWidth(1)
        .moveTo(startX, yLine)
        .lineTo(doc.page.width - 50, yLine)
        .stroke();
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(10);

      const labelWidth = 280;
      const startRowX = doc.x;
      for (const row of section.rows) {
        const y = doc.y;
        doc.text(row.label, startRowX, y, { width: labelWidth });
        doc.text(row.value, startRowX + labelWidth, y, {
          width: doc.page.width - 50 - 50 - labelWidth,
          align: 'right',
        });
        doc.moveDown(0.2);
      }
      doc.moveDown(0.6);
    }

    // Footer: page number on every page
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const pageNum = i + 1;
      const pageCount = range.count;
      doc
        .fontSize(8)
        .font('Helvetica-Oblique')
        .fillColor('#888888')
        .text(
          `Halaman ${pageNum} dari ${pageCount}`,
          50,
          doc.page.height - 40,
          { align: 'center', width: doc.page.width - 100 },
        );
      doc.fillColor('black');
    }

    doc.end();
  });
}
