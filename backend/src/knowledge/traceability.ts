import { ENTITY_DEFINITIONS, EntityType, getDefinition } from './definitions/entity-definitions';

/**
 * Trazabilidad de un registro de la base de conocimiento (mejora de HU08).
 * Las relaciones se guardan en un solo sentido (p. ej. el caso de prueba apunta al
 * requerimiento); aquí se recorren en ambos sentidos para mostrar la cadena completa:
 * requerimiento ↔ historias ↔ reglas ↔ casos de prueba ↔ defectos.
 */

export type TraceRec = Record<string, any> & { _id?: unknown; code: string };

export interface TraceItem {
  id: string;
  type: EntityType;
  code: string;
  title: string;
  relation: 'directa' | 'indirecta';
  /** Registro directo a través del cual se llega (solo en las indirectas). */
  via?: string;
  /** Estado principal: estado de ejecución, estado del defecto o prioridad/criticidad. */
  status?: string;
  /** Dato complementario: tipo de escenario, severidad o tipo de regla. */
  detail?: string;
}

export interface TraceAlert {
  level: 'warning' | 'info';
  message: string;
}

export interface Traceability {
  record: { id: string; type: EntityType; code: string; title: string };
  groups: { type: EntityType; label: string; items: TraceItem[] }[];
  alerts: TraceAlert[];
  /** Casos de prueba de la cadena por tipo de escenario (requerimientos e historias). */
  scenarioCoverage?: Record<string, number>;
}

export const SCENARIO_TYPES = ['Positivo', 'Negativo', 'Alternativo', 'Excepción'];
const OPEN_DEFECT = ['Abierto', 'En progreso'];

/**
 * Relaciones indirectas que se siguen según el tipo de origen: desde un registro
 * directo de tipo `from` se agregan sus vecinos de tipo `to`. Para requerimientos e
 * historias coincide con la cadena que se usa como contexto en la generación.
 */
const EXPANSIONS: Record<EntityType, [EntityType, EntityType][]> = {
  requirements: [
    ['user-stories', 'business-rules'],
    ['user-stories', 'test-cases'],
    ['user-stories', 'defects'],
    ['test-cases', 'defects'],
  ],
  'user-stories': [
    ['requirements', 'business-rules'],
    ['test-cases', 'defects'],
  ],
  'business-rules': [['test-cases', 'defects']],
  'test-cases': [],
  defects: [],
};

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const key = (type: EntityType, code: string) => `${type}:${code}`;

function statusOf(type: EntityType, r: TraceRec): Pick<TraceItem, 'status' | 'detail'> {
  switch (type) {
    case 'test-cases':
      return { status: r.executionStatus, detail: r.scenarioType };
    case 'defects':
      return { status: r.status, detail: r.severity };
    case 'business-rules':
      return { status: r.criticality, detail: r.type };
    default:
      return { status: r.priority };
  }
}

export function buildTraceability(all: Map<EntityType, TraceRec[]>, type: EntityType, code: string): Traceability {
  const byKey = new Map<string, { type: EntityType; r: TraceRec }>();
  for (const def of ENTITY_DEFINITIONS) for (const r of all.get(def.type) ?? []) byKey.set(key(def.type, r.code), { type: def.type, r });

  // Grafo no dirigido a partir de los campos de relación (refList).
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  const dangling = new Map<string, Set<string>>(); // registro → códigos inexistentes
  for (const def of ENTITY_DEFINITIONS) {
    const refFields = def.fields.filter((f) => f.type === 'refList' && f.refType);
    for (const r of all.get(def.type) ?? []) {
      const from = key(def.type, r.code);
      for (const f of refFields) {
        for (const c of list(r[f.key])) {
          const to = key(f.refType!, c);
          if (!byKey.has(to)) {
            if (!dangling.has(from)) dangling.set(from, new Set());
            dangling.get(from)!.add(c);
            continue;
          }
          link(from, to);
          link(to, from);
        }
      }
    }
  }

  const selfKey = key(type, code);
  const self = byKey.get(selfKey);
  if (!self) throw new Error(`No existe ${code}`);
  const neighbors = (k: string) => [...(adj.get(k) ?? [])];

  const found = new Map<string, { relation: 'directa' | 'indirecta'; via?: string }>();
  for (const n of neighbors(selfKey)) found.set(n, { relation: 'directa' });
  for (const [from, to] of EXPANSIONS[type]) {
    // Las expansiones se aplican en orden: p. ej. los casos que llegan por una historia
    // aportan después sus defectos.
    for (const [k] of [...found]) {
      if (byKey.get(k)!.type !== from) continue;
      for (const n of neighbors(k)) {
        if (n === selfKey || found.has(n) || byKey.get(n)!.type !== to) continue;
        found.set(n, { relation: 'indirecta', via: byKey.get(k)!.r.code });
      }
    }
  }

  const titleOf = (t: EntityType, r: TraceRec) => String(r[getDefinition(t)!.titleField] ?? '');
  const groups = ENTITY_DEFINITIONS.map((def) => ({
    type: def.type,
    label: def.labelPlural,
    items: [...found]
      .filter(([k]) => byKey.get(k)!.type === def.type)
      .map(([k, info]) => {
        const { r } = byKey.get(k)!;
        return { id: String(r._id ?? ''), type: def.type, code: r.code, title: titleOf(def.type, r), ...info, ...statusOf(def.type, r) };
      })
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
  }));

  // ─── Alertas ───
  const alerts: TraceAlert[] = [];
  const itemsOf = (t: EntityType) => groups.find((g) => g.type === t)!.items;
  const cases = itemsOf('test-cases');
  const hasCase = (t: EntityType, c: string) => neighbors(key(t, c)).some((n) => byKey.get(n)!.type === 'test-cases');
  let scenarioCoverage: Record<string, number> | undefined;

  if (type === 'requirements' || type === 'user-stories') {
    if (!cases.length) alerts.push({ level: 'warning', message: 'No tiene casos de prueba asociados.' });
    const uncovered = itemsOf('business-rules').filter((r) => !hasCase('business-rules', r.code)).map((r) => r.code);
    if (uncovered.length) alerts.push({ level: 'warning', message: `Reglas de negocio sin casos de prueba: ${uncovered.join(', ')}.` });
    scenarioCoverage = Object.fromEntries(SCENARIO_TYPES.map((s) => [s, cases.filter((c) => c.detail === s).length]));
    const missing = SCENARIO_TYPES.filter((s) => !scenarioCoverage![s]);
    if (cases.length && missing.length) {
      alerts.push({ level: 'info', message: `Tipos de escenario sin casos: ${missing.join(', ')}.` });
    }
  }
  if (type === 'business-rules' && !cases.some((c) => c.relation === 'directa')) {
    alerts.push({ level: 'warning', message: 'Ningún caso de prueba cubre esta regla.' });
  }
  if (type === 'test-cases' && self.r.executionStatus === 'Fallido' && !itemsOf('defects').length) {
    alerts.push({ level: 'warning', message: 'El caso falló y no tiene un defecto asociado.' });
  }
  if (type === 'defects' && !cases.length) {
    alerts.push({ level: 'info', message: 'El defecto no está vinculado a ningún caso de prueba.' });
  }
  if (type !== 'defects') {
    const open = itemsOf('defects').filter((d) => OPEN_DEFECT.includes(d.status ?? '')).map((d) => d.code);
    if (open.length) alerts.push({ level: 'info', message: `Defectos pendientes de solución: ${open.join(', ')}.` });
  }
  const missingRefs = dangling.get(selfKey);
  if (missingRefs?.size) {
    alerts.push({ level: 'warning', message: `Relaciones con registros que no existen en el proyecto: ${[...missingRefs].join(', ')}.` });
  }

  return {
    record: { id: String(self.r._id ?? ''), type, code, title: titleOf(type, self.r) },
    groups,
    alerts,
    ...(scenarioCoverage ? { scenarioCoverage } : {}),
  };
}
