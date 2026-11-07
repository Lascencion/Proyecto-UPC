/** Contrato entre el módulo de generación y el proveedor del LLM. */

export const SCENARIO_TYPES = ['Positivo', 'Negativo', 'Valor límite', 'Excepción'] as const;
export const TECHNIQUES = [
  'Partición de equivalencia',
  'Análisis de valores límite',
  'Tabla de decisión',
  'Transición de estados',
  'Casos de uso',
  'Conjetura de errores',
] as const;
export const PRIORITIES = ['Alta', 'Media', 'Baja'] as const;

export interface ContextItem {
  type: 'requirements' | 'business-rules' | 'test-cases' | 'defects';
  code: string;
  title: string;
  /** Contenido resumido del registro que se envía al LLM. */
  content: string;
}

export interface GenerationInput {
  requirement: { code?: string; title: string; description: string; acceptanceCriteria: string[] };
  context: ContextItem[];
  scenarioTypes: string[];
  techniques: string[];
  maxCases: number;
  instructions?: string;
}

export interface GeneratedStep {
  action: string;
  expectedResult: string;
}

export interface GeneratedCase {
  title: string;
  objective: string;
  scenarioType: string;
  technique: string;
  priority: string;
  preconditions: string;
  testData: string;
  steps: GeneratedStep[];
  expectedResult: string;
  sources: string[];
}

export interface GenerationOutput {
  cases: GeneratedCase[];
  observations: string;
  provider: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

export interface LlmProvider {
  readonly name: string;
  generate(input: GenerationInput): Promise<GenerationOutput>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

/** Error con un mensaje apto para mostrar al usuario. */
export class GenerationError extends Error {}
