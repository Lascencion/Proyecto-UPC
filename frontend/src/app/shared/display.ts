import { FieldDefinition, RowStatus, TestStep } from '../core/models';

/** Representación en texto de un valor para tablas y vistas. */
export function displayValue(field: Pick<FieldDefinition, 'type'>, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (field.type) {
    case 'date': {
      const text = String(value);
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : text;
    }
    case 'list':
    case 'refList':
      return Array.isArray(value) && value.length ? value.join('; ') : Array.isArray(value) ? '—' : String(value);
    case 'steps':
      return Array.isArray(value) ? `${(value as TestStep[]).length} paso(s)` : '—';
    default:
      return String(value);
  }
}

export const ROW_STATUS_LABELS: Record<RowStatus, string> = {
  valid: 'Válido',
  warning: 'Advertencia',
  error: 'Error',
  excluded: 'Excluido',
};

export const BATCH_STATUS_LABELS: Record<string, string> = {
  EN_REVISION: 'En revisión',
  CONFIRMADO: 'Confirmado',
  CANCELADO: 'Cancelado',
};

export const ROW_RESULT_LABELS: Record<string, string> = {
  created: 'Creado',
  failed: 'Falló',
};

/** Fecha de hoy en formato AAAA-MM-DD (hora local). */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
