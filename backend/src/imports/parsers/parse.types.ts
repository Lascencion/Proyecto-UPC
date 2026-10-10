import { EntityType } from '../../knowledge/definitions/entity-definitions';
import { TestStep } from '../../knowledge/validation/record-validator';

export type CellValue = string | number | boolean | Date | null;

export interface ParsedRow {
  type: EntityType;
  source: { fileName: string; location: string };
  data: Record<string, unknown>;
  /** Nombre del módulo indicado en el archivo (se resuelve contra el catálogo). */
  moduleName?: string;
}

/** Pasos que vienen en una hoja/archivo separado y se enlazan por código de caso. */
export interface ParsedStep extends TestStep {
  testCaseCode: string;
  location: string;
  fileName: string;
}

export interface FileIssue {
  fileName: string;
  level: 'error' | 'warning';
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  steps: ParsedStep[];
  issues: FileIssue[];
}

/** Tabla genérica (hoja de Excel o archivo CSV). */
export interface RawTable {
  fileName: string;
  /** Nombre de la hoja o del archivo, usado para identificar el tipo. */
  name: string;
  /** Prefijo para describir la ubicación de una fila (vacío: solo "Fila N"). */
  locationLabel: string;
  rows: CellValue[][];
}
