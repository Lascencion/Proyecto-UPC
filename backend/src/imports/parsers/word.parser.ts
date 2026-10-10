import * as mammoth from 'mammoth';
import { HTMLElement, parse } from 'node-html-parser';
import { normalizeKey } from '../../common/utils/text';
import { ENTITY_DEFINITIONS, MODULE_COLUMN, STEP_COLUMNS } from '../../knowledge/definitions/entity-definitions';
import { ParsedRow, ParseResult } from './parse.types';
import { entityColumns } from './table-mapper';

function cellText(cell: HTMLElement): string {
  const paragraphs = cell.querySelectorAll('p');
  const text = paragraphs.length ? paragraphs.map((p) => p.text.trim()).join('\n') : cell.text;
  return text.replace(/ /g, ' ').trim();
}

function tableRows(table: HTMLElement): string[][] {
  // Solo filas directas de la tabla (evita mezclar tablas anidadas).
  return table
    .querySelectorAll('tr')
    .filter((tr) => tr.closest('table') === table)
    .map((tr) => tr.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement && ['TD', 'TH'].includes(n.tagName)).map(cellText));
}

const STEP_HEADERS = {
  number: [STEP_COLUMNS.number.label, ...STEP_COLUMNS.number.aliases].map(normalizeKey),
  action: [STEP_COLUMNS.action.label, ...STEP_COLUMNS.action.aliases].map(normalizeKey),
  expectedResult: [STEP_COLUMNS.expectedResult.label, ...STEP_COLUMNS.expectedResult.aliases].map(normalizeKey),
};

/**
 * Formato Word: cada registro es una tabla de dos columnas (Campo | Valor) cuya
 * primera fila es "Tipo | <Requerimiento / Regla de negocio / Caso de prueba / Defecto>".
 * Los pasos de un caso de prueba van en una tabla inmediatamente posterior con
 * encabezados "N° paso | Acción | Resultado esperado".
 */
export async function parseWord(fileName: string, buffer: Buffer, result: ParseResult): Promise<void> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const tables = parse(html).querySelectorAll('table').filter((t) => !t.parentNode?.closest('table'));
  let lastTestCase: ParsedRow | undefined;
  let recognized = 0;

  tables.forEach((table, index) => {
    const rows = tableRows(table).filter((r) => r.some((c) => c));
    if (!rows.length) return;
    const location = `Tabla ${index + 1}`;
    const header = rows[0].map(normalizeKey);

    // Tabla de pasos
    const actionCol = header.findIndex((h) => STEP_HEADERS.action.includes(h));
    const expectedCol = header.findIndex((h) => STEP_HEADERS.expectedResult.includes(h));
    if (actionCol >= 0 && expectedCol >= 0) {
      recognized++;
      if (!lastTestCase) {
        result.issues.push({ fileName, level: 'error', message: `${location}: tabla de pasos sin un caso de prueba anterior.` });
        return;
      }
      const numberCol = header.findIndex((h) => STEP_HEADERS.number.includes(h));
      const steps = rows.slice(1).map((r, i) => ({
        number: numberCol >= 0 ? Number(r[numberCol]) || i + 1 : i + 1,
        action: r[actionCol] ?? '',
        expectedResult: r[expectedCol] ?? '',
      }));
      const current = (lastTestCase.data.steps as unknown[]) ?? [];
      lastTestCase.data.steps = [...current, ...steps];
      return;
    }

    // Tabla de registro
    if (header[0] !== 'tipo') return; // tablas ajenas al formato (p. ej. instrucciones)
    recognized++;
    const typeName = normalizeKey(rows[0][1]);
    const def = ENTITY_DEFINITIONS.find((d) => [d.wordTypeLabel, d.label, d.labelPlural].map(normalizeKey).includes(typeName));
    if (!def) {
      result.issues.push({ fileName, level: 'error', message: `${location}: tipo "${rows[0][1] ?? ''}" no reconocido.` });
      return;
    }
    const map = new Map<string, string>();
    for (const c of entityColumns(def)) {
      for (const n of [c.label, c.key, ...(c.aliases ?? [])]) map.set(normalizeKey(n), c.key);
    }
    const data: Record<string, unknown> = {};
    let moduleName: string | undefined;
    const unknown: string[] = [];
    for (const [label, value] of rows.slice(1).map((r) => [r[0] ?? '', r.slice(1).join('\n').trim()])) {
      const key = map.get(normalizeKey(label));
      if (!key) {
        if (label) unknown.push(label);
        continue;
      }
      if (!value) continue;
      if (key === MODULE_COLUMN.key) moduleName = value;
      else data[key] = value;
    }
    if (unknown.length) {
      result.issues.push({ fileName, level: 'warning', message: `${location}: campos no reconocidos (se ignoraron): ${unknown.join(', ')}.` });
    }
    const row: ParsedRow = { type: def.type, source: { fileName, location }, data, moduleName };
    result.rows.push(row);
    lastTestCase = def.type === 'test-cases' ? row : undefined;
  });

  if (!recognized) {
    result.issues.push({
      fileName,
      level: 'error',
      message: 'No se encontraron tablas con el formato de la plantilla (primera fila "Tipo | …").',
    });
  }
}
