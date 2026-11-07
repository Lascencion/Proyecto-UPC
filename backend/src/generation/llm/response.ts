import { GeneratedCase, GenerationError, GenerationInput, SCENARIO_TYPES, TECHNIQUES, PRIORITIES } from './types';

export interface ValidatedResponse {
  cases: GeneratedCase[];
  observations: string;
  /** Casos descartados por estar incompletos. */
  discarded: number;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Valida y normaliza la respuesta del LLM: descarta casos incompletos, limita la
 * cantidad solicitada y conserva solo las fuentes que existen en el contexto.
 */
export function validateResponse(raw: unknown, input: GenerationInput): ValidatedResponse {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { cases?: unknown }).cases)) {
    throw new GenerationError('La respuesta del modelo no tiene la estructura esperada.');
  }
  const contextCodes = new Set(input.context.map((c) => c.code));
  const cases: GeneratedCase[] = [];
  let discarded = 0;
  for (const item of (raw as { cases: unknown[] }).cases) {
    const c = (item ?? {}) as Record<string, unknown>;
    const steps = (Array.isArray(c.steps) ? c.steps : [])
      .map((s) => ({ action: text((s as Record<string, unknown>)?.action), expectedResult: text((s as Record<string, unknown>)?.expectedResult) }))
      .filter((s) => s.action && s.expectedResult);
    const scenarioType = text(c.scenarioType);
    const ok = text(c.title) && text(c.expectedResult) && steps.length && (SCENARIO_TYPES as readonly string[]).includes(scenarioType);
    if (!ok || cases.length >= input.maxCases) {
      discarded += 1;
      continue;
    }
    const technique = text(c.technique);
    const priority = text(c.priority);
    cases.push({
      title: text(c.title),
      objective: text(c.objective),
      scenarioType,
      technique: (TECHNIQUES as readonly string[]).includes(technique) ? technique : '',
      priority: (PRIORITIES as readonly string[]).includes(priority) ? priority : 'Media',
      preconditions: text(c.preconditions),
      testData: text(c.testData),
      steps,
      expectedResult: text(c.expectedResult),
      sources: [...new Set((Array.isArray(c.sources) ? c.sources : []).map((s) => text(s).toUpperCase()))].filter((s) => contextCodes.has(s)),
    });
  }
  if (!cases.length) throw new GenerationError('El modelo no devolvió casos de prueba válidos.');
  return { cases, observations: text((raw as { observations?: unknown }).observations), discarded };
}
