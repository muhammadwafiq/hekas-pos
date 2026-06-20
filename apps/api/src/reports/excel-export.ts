/**
 * Excel export helper — multi-sheet workbook builder.
 * Returns a Buffer containing the .xlsx file.
 */

import ExcelJS from 'exceljs';

export interface ExcelSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
  title?: string;
  subtitle?: string;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F4E78' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

export async function buildExcel(sheets: ExcelSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HEKAS POS';
  workbook.created = new Date();
  workbook.modified = new Date();

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31)); // Excel limit

    let rowCursor = 1;

    if (sheet.title) {
      ws.mergeCells(rowCursor, 1, rowCursor, sheet.headers.length);
      const titleRow = ws.getRow(rowCursor);
      titleRow.getCell(1).value = sheet.title;
      titleRow.getCell(1).font = { bold: true, size: 14 };
      titleRow.getCell(1).alignment = { vertical: 'middle' };
      rowCursor++;
    }

    if (sheet.subtitle) {
      ws.mergeCells(rowCursor, 1, rowCursor, sheet.headers.length);
      const subRow = ws.getRow(rowCursor);
      subRow.getCell(1).value = sheet.subtitle;
      subRow.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF555555' } };
      rowCursor++;
    }

    // Header row
    const headerRow = ws.getRow(rowCursor);
    headerRow.values = sheet.headers;
    headerRow.font = HEADER_FONT;
    headerRow.fill = HEADER_FILL;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;
    rowCursor++;

    // Data rows
    for (const r of sheet.rows) {
      const row = ws.getRow(rowCursor);
      row.values = r;
      rowCursor++;
    }

    // Auto-fit width
    sheet.headers.forEach((h, idx) => {
      let max = h.length;
      for (const r of sheet.rows) {
        const v = r[idx];
        const s = v === null || v === undefined ? '' : String(v);
        if (s.length > max) max = s.length;
      }
      ws.getColumn(idx + 1).width = Math.min(Math.max(max + 2, 10), 50);
    });

    // Freeze pane below header
    const headerLine = sheet.title ? 3 : 2; // title+subtitle = 2 lines above header row, +1 header
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: headerLine }];
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
