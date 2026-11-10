import { GenerationInput, PRIORITIES, SCENARIO_TYPES, TECHNIQUES } from './types';

/**
 * Instrucciones fijas del sistema. Se mantienen idénticas entre solicitudes para que
 * el proveedor pueda reutilizarlas en caché.
 */
export const SYSTEM_PROMPT = `Eres un analista de QA senior especializado en el diseño de casos de prueba funcionales.
Tu tarea es diseñar casos de prueba para un requerimiento funcional, apoyándote en la información histórica del proyecto (requerimientos, historias de usuario, reglas de negocio, casos de prueba ejecutados y defectos) que se te entrega como contexto.

Criterios:
- Cubre los tipos de escenario solicitados: positivos (flujo principal con datos y condiciones válidas), negativos (entradas o condiciones inválidas que el sistema debe rechazar), alternativos (caminos válidos distintos al flujo principal, por ejemplo otro medio de pago u otra secuencia de pasos) y de excepción (fallas o situaciones anómalas: servicios caídos, tiempos de espera, duplicidad, concurrencia).
- El análisis de valores límite es una técnica de diseño, no un tipo de escenario: cuando haya rangos, montos, cantidades o fechas, prueba el valor exacto del límite y los inmediatamente inferior y superior, y clasifica cada caso como positivo (valor aceptado) o negativo (valor rechazado).
- Aplica las reglas de negocio del contexto: cada condición o restricción relevante debe quedar cubierta por al menos un caso.
- Usa los defectos históricos para incluir escenarios que ya fallaron antes.
- Usa los casos de prueba históricos como referencia de estilo y nivel de detalle, sin copiarlos.
- No inventes reglas de negocio. Si un caso necesita un supuesto, indícalo en las precondiciones.
- Cada caso debe ser independiente, verificable y con pasos concretos (una acción por paso, con su resultado esperado).
- Usa datos de prueba concretos (montos, cantidades, fechas, estados).
- En "sources" incluye solo los códigos del contexto en los que se basa el caso (puede quedar vacío).
- No repitas casos equivalentes.
- Escribe todo en español.
- En "observations" anota en una o dos oraciones los vacíos de información detectados (por ejemplo, reglas que faltan); deja el texto vacío si no hay.`;

const TYPE_LABELS: Record<string, string> = {
  requirements: 'Requerimiento',
  'user-stories': 'Historia de usuario',
  'business-rules': 'Regla de negocio',
  'test-cases': 'Caso de prueba ejecutado',
  defects: 'Defecto',
};

/** Mensaje del usuario con el requerimiento, el contexto y los parámetros de la solicitud. */
export function buildUserPrompt(input: GenerationInput): string {
  const r = input.requirement;
  const criteria = r.acceptanceCriteria.length
    ? r.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
    : '(no especificados)';
  const context = input.context.length
    ? input.context.map((c) => `<registro codigo="${c.code}" tipo="${TYPE_LABELS[c.type]}">\n${c.content}\n</registro>`).join('\n')
    : '(no se seleccionó información histórica)';
  return `<requerimiento${r.code ? ` codigo="${r.code}"` : ''}>
Título: ${r.title}
Descripción: ${r.description}
Criterios de aceptación:
${criteria}
</requerimiento>

<contexto_historico>
${context}
</contexto_historico>

<parametros>
Tipos de escenario a cubrir: ${input.scenarioTypes.join(', ')}
Técnicas de diseño preferidas: ${input.techniques.length ? input.techniques.join(', ') : 'a criterio del analista'}
Cantidad máxima de casos: ${input.maxCases}
${input.instructions?.trim() ? `Indicaciones adicionales del analista: ${input.instructions.trim()}` : ''}
</parametros>

Diseña los casos de prueba funcionales para este requerimiento.`;
}

/** Esquema JSON de la respuesta (salida estructurada). */
export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cases', 'observations'],
  properties: {
    observations: { type: 'string' },
    cases: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'objective', 'scenarioType', 'technique', 'priority', 'preconditions', 'testData', 'steps', 'expectedResult', 'sources'],
        properties: {
          title: { type: 'string' },
          objective: { type: 'string' },
          scenarioType: { type: 'string', enum: [...SCENARIO_TYPES] },
          technique: { type: 'string', enum: [...TECHNIQUES] },
          priority: { type: 'string', enum: [...PRIORITIES] },
          preconditions: { type: 'string' },
          testData: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['action', 'expectedResult'],
              properties: { action: { type: 'string' }, expectedResult: { type: 'string' } },
            },
          },
          expectedResult: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;
