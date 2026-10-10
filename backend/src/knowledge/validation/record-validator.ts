import { normalizeKey } from '../../common/utils/text';
import { EntityDefinition, FieldDefinition } from '../definitions/entity-definitions';

export interface FieldIssue {
  field: string;
  message: string;
}

export interface TestStep {
  number: number;
  action: string;
  expectedResult: string;
}

export interface ValidationResult {
  /** Valores normalizados listos para guardar. */
  value: Record<string, unknown>;
  errors: FieldIssue[];
  warnings: FieldIssue[];
}

const MAX_LENGTH: Partial<Record<FieldDefinition['type'], number>> = {
  code: 50,
  string: 300,
  ref: 50,
  text: 10000,
};

const isBlank = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

/** Convierte texto de celdas/campos a lista: separa por ";" o saltos de línea. */
export function toList(value: unknown): string[] {
  if (isBlank(value)) return [];
  const parts = Array.isArray(value) ? value.map((v) => String(v ?? '')) : String(value).split(/[;\n\r]+/);
  return parts.map((p) => p.replace(/^\s*[-•*]\s*/, '').trim()).filter((p) => p.length > 0);
}

/** Acepta Date, AAAA-MM-DD, DD/MM/AAAA o DD-MM-AAAA y número de serie de Excel. */
export function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const text = String(value ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (m) return buildDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (m) return buildDate(+m[3], +m[2], +m[1]);
  return null;
}

function buildDate(y: number, mo: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

function matchOption(field: FieldDefinition, value: string): string | undefined {
  const key = normalizeKey(value);
  return field.options?.find((o) => normalizeKey(o) === key);
}

function normalizeSteps(field: FieldDefinition, raw: unknown, errors: FieldIssue[]): TestStep[] {
  if (isBlank(raw)) return [];
  if (!Array.isArray(raw)) {
    errors.push({ field: field.key, message: 'Los pasos deben ser una lista.' });
    return [];
  }
  const steps: TestStep[] = [];
  raw.forEach((item, index) => {
    const step = (item ?? {}) as Partial<Record<keyof TestStep, unknown>>;
    const action = String(step.action ?? '').trim();
    const expectedResult = String(step.expectedResult ?? '').trim();
    if (!action && !expectedResult) return; // fila vacía
    if (!action) errors.push({ field: field.key, message: `Paso ${index + 1}: la acción es obligatoria.` });
    if (!expectedResult) {
      errors.push({ field: field.key, message: `Paso ${index + 1}: el resultado esperado es obligatorio.` });
    }
    steps.push({ number: Number(step.number) || index + 1, action, expectedResult });
  });
  // Ordena por número indicado y renumera de forma correlativa.
  return steps.sort((a, b) => a.number - b.number).map((s, i) => ({ ...s, number: i + 1 }));
}

/**
 * Valida y normaliza un registro según su definición. No consulta la base de
 * datos: las referencias a otros códigos se verifican aparte.
 */
export function validateRecord(def: EntityDefinition, input: Record<string, unknown>): ValidationResult {
  const value: Record<string, unknown> = {};
  const errors: FieldIssue[] = [];
  const warnings: FieldIssue[] = [];

  for (const field of def.fields) {
    const raw = input[field.key];
    const max = MAX_LENGTH[field.type];

    switch (field.type) {
      case 'code':
      case 'ref': {
        const code = isBlank(raw) ? '' : String(raw).trim().toUpperCase();
        if (code && /\s/.test(code)) {
          errors.push({ field: field.key, message: `${field.label}: no debe contener espacios.` });
        }
        value[field.key] = code || null;
        break;
      }
      case 'string':
      case 'text':
        value[field.key] = isBlank(raw) ? null : String(raw).trim();
        break;
      case 'enum': {
        if (isBlank(raw)) {
          value[field.key] = null;
          break;
        }
        const option = matchOption(field, String(raw));
        if (!option) {
          errors.push({
            field: field.key,
            message: `${field.label}: "${String(raw).trim()}" no es válido. Valores permitidos: ${field.options!.join(', ')}.`,
          });
        }
        value[field.key] = option ?? String(raw).trim();
        break;
      }
      case 'date': {
        if (isBlank(raw)) {
          value[field.key] = null;
          break;
        }
        const date = parseDate(raw);
        if (!date) {
          errors.push({ field: field.key, message: `${field.label}: "${String(raw)}" no es una fecha válida (use AAAA-MM-DD o DD/MM/AAAA).` });
        }
        // Si no es válida se conserva el texto original para que el usuario lo corrija.
        value[field.key] = date ?? String(raw).trim();
        break;
      }
      case 'list':
        value[field.key] = toList(raw);
        break;
      case 'refList':
        value[field.key] = [...new Set(toList(raw).map((c) => c.toUpperCase().replace(/\s+/g, '')))];
        break;
      case 'steps':
        value[field.key] = normalizeSteps(field, raw, errors);
        break;
    }

    if (field.required && isBlank(value[field.key])) {
      errors.push({ field: field.key, message: `${field.label} es obligatorio.` });
    }
    if (max && typeof value[field.key] === 'string' && (value[field.key] as string).length > max) {
      errors.push({ field: field.key, message: `${field.label} supera los ${max} caracteres.` });
    }
  }

  return { value, errors, warnings };
}

/** Lista las referencias (tipo + código) que contiene un registro normalizado. */
export function collectReferences(def: EntityDefinition, value: Record<string, unknown>) {
  const refs: { field: FieldDefinition; code: string }[] = [];
  for (const field of def.fields) {
    if (field.type === 'ref' && value[field.key]) refs.push({ field, code: value[field.key] as string });
    if (field.type === 'refList') {
      for (const code of (value[field.key] as string[]) ?? []) refs.push({ field, code });
    }
  }
  return refs;
}
