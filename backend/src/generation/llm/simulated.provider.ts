import { ContextItem, GeneratedCase, GenerationInput, GenerationOutput, LlmProvider, SCENARIO_TYPES } from './types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PLAN: Record<string, { technique: string; title: (r: string) => string; action: string; result: string; priority: string }> = {
  Positivo: {
    technique: 'Partición de equivalencia',
    title: (r) => `${r}: flujo exitoso con datos válidos`,
    action: 'Completar la operación con datos válidos',
    result: 'La operación se registra correctamente y se muestra la confirmación',
    priority: 'Alta',
  },
  Negativo: {
    technique: 'Partición de equivalencia',
    title: (r) => `${r}: datos inválidos son rechazados`,
    action: 'Intentar la operación con un dato inválido',
    result: 'El sistema rechaza la operación y muestra un mensaje claro',
    priority: 'Alta',
  },
  'Valor límite': {
    technique: 'Análisis de valores límite',
    title: (r) => `${r}: valor en el límite permitido`,
    action: 'Ejecutar la operación con el valor exacto del límite',
    result: 'El sistema aplica la regla correspondiente al valor límite',
    priority: 'Media',
  },
  Excepción: {
    technique: 'Conjetura de errores',
    title: (r) => `${r}: falla de un servicio externo`,
    action: 'Simular la falla o el tiempo de espera del servicio externo',
    result: 'El sistema informa el error y no deja la operación a medias',
    priority: 'Media',
  },
};

/**
 * Proveedor simulado: arma casos de ejemplo a partir del requerimiento y del contexto,
 * sin llamar a ningún LLM. Sirve para desarrollo, pruebas automatizadas y demostraciones
 * sin costo.
 */
export class SimulatedProvider implements LlmProvider {
  readonly name = 'simulado';

  constructor(private readonly delayMs = 1500) {}

  async generate(input: GenerationInput): Promise<GenerationOutput> {
    await sleep(this.delayMs);
    const types = input.scenarioTypes.filter((t) => (SCENARIO_TYPES as readonly string[]).includes(t));
    const rules = input.context.filter((c) => c.type === 'business-rules');
    const cases: GeneratedCase[] = [];
    for (let i = 0; i < input.maxCases && types.length; i++) {
      const type = types[i % types.length];
      const plan = PLAN[type];
      const rule: ContextItem | undefined = rules[i % Math.max(rules.length, 1)];
      const round = Math.floor(i / types.length);
      cases.push({
        title: `${plan.title(input.requirement.title)}${round ? ` (variante ${round + 1})` : ''}`,
        objective: `Verificar el comportamiento ${type.toLowerCase()} del requerimiento${rule ? ` considerando la regla «${rule.title}»` : ''}.`,
        scenarioType: type,
        technique: plan.technique,
        priority: plan.priority,
        preconditions: 'Usuario autenticado con una cuenta activa.',
        testData: 'Datos de prueba según el escenario.',
        steps: [
          { action: 'Ingresar a la funcionalidad del requerimiento', expectedResult: 'Se muestra la pantalla correspondiente' },
          { action: plan.action, expectedResult: plan.result },
        ],
        expectedResult: plan.result,
        sources: rule ? [rule.code] : [],
      });
    }
    return {
      cases,
      observations: 'Casos generados en modo simulado (sin LLM).',
      provider: this.name,
      model: 'simulado',
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
    };
  }
}
