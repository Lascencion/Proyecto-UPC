import { normalizeKey } from '../../common/utils/text';
import { parseCsv } from './csv.parser';
import { parseExcel } from './excel.parser';
import { ParseResult } from './parse.types';
import { parseWord } from './word.parser';

export const SUPPORTED_EXTENSIONS = ['.xlsx', '.csv', '.docx'];

export interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
}

/** Lee varios archivos y enlaza los pasos de hojas/archivos separados con su caso de prueba. */
export async function parseFiles(files: UploadedFileLike[]): Promise<ParseResult> {
  const result: ParseResult = { rows: [], steps: [], issues: [] };
  for (const file of files) {
    const name = file.originalname;
    const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
    try {
      if (ext === '.xlsx') await parseExcel(name, file.buffer, result);
      else if (ext === '.csv') parseCsv(name, file.buffer, result);
      else if (ext === '.docx') await parseWord(name, file.buffer, result);
      else {
        result.issues.push({
          fileName: name,
          level: 'error',
          message: `Formato no soportado. Use ${SUPPORTED_EXTENSIONS.join(', ')} (los formatos antiguos .xls/.doc deben guardarse como .xlsx/.docx).`,
        });
      }
    } catch (e) {
      result.issues.push({ fileName: name, level: 'error', message: `No se pudo leer el archivo: ${(e as Error).message}` });
    }
  }

  // Enlaza pasos (hoja PasosCasoPrueba / CSV de pasos) con sus casos de prueba.
  const testCases = new Map(
    result.rows
      .filter((r) => r.type === 'test-cases' && r.data.code)
      .map((r) => [normalizeKey(r.data.code), r] as const),
  );
  for (const step of result.steps) {
    const target = testCases.get(normalizeKey(step.testCaseCode));
    if (!target) {
      result.issues.push({
        fileName: step.fileName,
        level: 'warning',
        message: `${step.location}: el paso referencia al caso "${step.testCaseCode || '(vacío)'}", que no está en los archivos cargados; se ignoró.`,
      });
      continue;
    }
    target.data.steps = [...((target.data.steps as unknown[]) ?? []), step];
  }
  return result;
}
