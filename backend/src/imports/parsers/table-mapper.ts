import { normalizeKey } from '../../common/utils/text';
import {
  ENTITY_DEFINITIONS,
  EntityDefinition,
  MODULE_COLUMN,
  REFERENCE_COLUMN,
  STEP_COLUMNS,
} from '../../knowledge/definitions/entity-definitions';
import { CellValue, ParseResult, RawTable } from './parse.types';

type ColumnSpec = { key: string; label: string; aliases?: string[] };

/** Construye el mapa encabezado normalizado -> clave del campo. */
function headerMap(columns: ColumnSpec[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of columns) {
    for (const name of [c.label, c.key, ...(c.aliases ?? [])]) {
      const k = normalizeKey(name);
      if (!map.has(k)) map.set(k, c.key);
    }
  }
  return map;
}

/** Columnas de un tipo en los archivos: la de código es la referencia temporal del lote. */
export const entityColumns = (def: EntityDefinition): ColumnSpec[] => [
  ...def.fields
    .filter((f) => f.type !== 'steps')
    .map((f) => (f.type === 'code' ? { key: f.key, label: REFERENCE_COLUMN.label, aliases: REFERENCE_COLUMN.aliases } : f)),
  MODULE_COLUMN,
];

const STEP_SPECS: ColumnSpec[] = [
  STEP_COLUMNS.testCaseCode,
  STEP_COLUMNS.number,
  STEP_COLUMNS.action,
  STEP_COLUMNS.expectedResult,
];

const ENTITY_HEADER_MAPS = new Map(ENTITY_DEFINITIONS.map((d) => [d.type, headerMap(entityColumns(d))]));
const STEP_HEADER_MAP = headerMap(STEP_SPECS);

export function cellToString(value: CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

const isEmpty = (v: CellValue | undefined) => cellToString(v) === '';

type TableKind = { kind: 'entity'; def: EntityDefinition } | { kind: 'steps' } | { kind: 'skip' } | { kind: 'unknown' };

/** Identifica el contenido de una tabla por su nombre o, si no, por sus encabezados. */
export function identifyTable(name: string, headers: string[]): TableKind {
  const n = normalizeKey(name);
  if (n.includes('instruccion') || n.includes('leeme') || n.includes('catalogo')) return { kind: 'skip' };
  if (n.includes('paso')) return { kind: 'steps' };
  for (const def of ENTITY_DEFINITIONS) {
    const names = [def.sheetName, def.labelPlural, def.type].map(normalizeKey);
    if (names.some((x) => n.includes(x))) return { kind: 'entity', def };
  }
  // Por encabezados: el tipo con más columnas reconocidas (y que incluya sus obligatorios).
  const normalized = headers.map(normalizeKey);
  const stepHits = normalized.filter((h) => STEP_HEADER_MAP.has(h)).length;
  let best: { def: EntityDefinition; score: number } | undefined;
  for (const def of ENTITY_DEFINITIONS) {
    const map = ENTITY_HEADER_MAPS.get(def.type)!;
    const score = normalized.filter((h) => map.has(h)).length;
    if (!best || score > best.score) best = { def, score };
  }
  if (stepHits >= 3 && (!best || stepHits >= best.score)) return { kind: 'steps' };
  if (best && best.score >= 3) return { kind: 'entity', def: best.def };
  return { kind: 'unknown' };
}

/** Convierte tablas (hojas Excel o CSV) en filas de registros y pasos. */
export function mapTables(tables: RawTable[], result: ParseResult): void {
  for (const original of tables) {
    const table = { ...original, locationLabel: original.locationLabel || 'Archivo' };
    const headerIndex = table.rows.findIndex((r) => r.filter((c) => !isEmpty(c)).length >= 2);
    if (headerIndex < 0) {
      if (table.rows.some((r) => r.some((c) => !isEmpty(c)))) {
        result.issues.push({ fileName: table.fileName, level: 'warning', message: `${table.locationLabel}: no se encontró la fila de encabezados; se ignoró.` });
      }
      continue;
    }
    const headers = table.rows[headerIndex].map(cellToString);
    const kind = identifyTable(table.name, headers);
    if (kind.kind === 'skip') continue;
    if (kind.kind === 'unknown') {
      result.issues.push({
        fileName: table.fileName,
        level: 'error',
        message: `${table.locationLabel}: no se pudo identificar el tipo de información. Use los nombres de hoja/archivo y encabezados de la plantilla.`,
      });
      continue;
    }

    const map = kind.kind === 'steps' ? STEP_HEADER_MAP : ENTITY_HEADER_MAPS.get(kind.def.type)!;
    const columns = headers.map((h) => (h ? map.get(normalizeKey(h)) : undefined));
    const unknown = headers.filter((h, i) => h && !columns[i]);
    if (unknown.length) {
      result.issues.push({
        fileName: table.fileName,
        level: 'warning',
        message: `${table.locationLabel}: columnas no reconocidas (se ignoraron): ${unknown.join(', ')}.`,
      });
    }
    if (kind.kind === 'entity') {
      const missing = kind.def.fields.filter((f) => f.required && f.type !== 'steps' && !columns.includes(f.key));
      if (missing.length) {
        result.issues.push({
          fileName: table.fileName,
          level: 'warning',
          message: `${table.locationLabel}: faltan columnas obligatorias: ${missing.map((f) => f.label).join(', ')}.`,
        });
      }
    }

    for (let i = headerIndex + 1; i < table.rows.length; i++) {
      const cells = table.rows[i];
      if (!cells || cells.every(isEmpty)) continue;
      const record: Record<string, CellValue> = {};
      columns.forEach((key, c) => {
        if (key && !isEmpty(cells[c])) record[key] = cells[c] instanceof Date || typeof cells[c] === 'number' ? cells[c] : cellToString(cells[c]);
      });
      const location = original.locationLabel ? `${original.locationLabel}, fila ${i + 1}` : `Fila ${i + 1}`;
      if (kind.kind === 'steps') {
        result.steps.push({
          testCaseCode: cellToString(record.testCaseCode).toUpperCase(),
          number: Number(record.number) || 0,
          action: cellToString(record.action),
          expectedResult: cellToString(record.expectedResult),
          location,
          fileName: table.fileName,
        });
      } else {
        const { module, ...data } = record;
        result.rows.push({
          type: kind.def.type,
          source: { fileName: table.fileName, location },
          data,
          moduleName: module ? cellToString(module) : undefined,
        });
      }
    }
  }
}
