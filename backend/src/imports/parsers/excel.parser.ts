import * as ExcelJS from 'exceljs';
import { CellValue, ParseResult, RawTable } from './parse.types';
import { mapTables } from './table-mapper';

/** Convierte el valor de una celda de exceljs (texto enriquecido, fórmulas, hipervínculos…) a un valor simple. */
export function excelCellValue(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    if ('formula' in value || 'sharedFormula' in value) return excelCellValue((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ('text' in value) return String((value as ExcelJS.CellHyperlinkValue).text);
    if ('error' in value) return null;
    return null;
  }
  return value as CellValue;
}

export async function parseExcel(fileName: string, buffer: Buffer, result: ParseResult): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const tables: RawTable[] = [];
  workbook.eachSheet((sheet) => {
    const rows: CellValue[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: CellValue[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = excelCellValue(cell.value);
      });
      rows[rowNumber - 1] = cells;
    });
    for (let i = 0; i < rows.length; i++) rows[i] = rows[i] ?? [];
    tables.push({ fileName, name: sheet.name, locationLabel: `Hoja "${sheet.name}"`, rows });
  });
  mapTables(tables, result);
}
