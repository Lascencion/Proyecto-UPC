import { buildUserPrompt, OUTPUT_SCHEMA } from './prompt';
import { validateResponse } from './response';
import { SimulatedProvider } from './simulated.provider';
import { GenerationError, GenerationInput } from './types';

const input: GenerationInput = {
  requirement: { code: 'REQ-049', title: 'Compra con cupón', description: 'Aplicar cupón al comprar monedas', acceptanceCriteria: ['Cupón vigente'] },
  context: [{ type: 'business-rules', code: 'RN-007', title: 'Vigencia de cupones', content: 'Un cupón vencido no se aplica.' }],
  scenarioTypes: ['Positivo', 'Negativo', 'Alternativo'],
  techniques: [],
  maxCases: 2,
  instructions: 'Priorizar cupones vencidos',
};

describe('prompt', () => {
  it('incluye requerimiento, contexto e indicaciones', () => {
    const p = buildUserPrompt(input);
    expect(p).toContain('codigo="REQ-049"');
    expect(p).toContain('<registro codigo="RN-007" tipo="Regla de negocio">');
    expect(p).toContain('Cantidad máxima de casos: 2');
    expect(p).toContain('Priorizar cupones vencidos');
  });

  it('el esquema exige todos los campos del caso', () => {
    expect(OUTPUT_SCHEMA.properties.cases.items.required).toContain('steps');
  });
});

describe('validateResponse', () => {
  const step = { action: 'a', expectedResult: 'b' };
  const base = { title: 't', objective: 'o', technique: 'Otra', priority: 'Alta', preconditions: '', testData: '', expectedResult: 'r' };

  it('descarta casos incompletos, respeta el máximo y filtra fuentes', () => {
    const res = validateResponse(
      {
        observations: ' ok ',
        cases: [
          { ...base, scenarioType: 'Positivo', steps: [step], sources: ['rn-007', 'RN-999'] },
          { ...base, scenarioType: 'Feliz', steps: [step], sources: [] },
          { ...base, scenarioType: 'Negativo', steps: [], sources: [] },
          { ...base, scenarioType: 'Negativo', steps: [step], sources: [] },
          { ...base, scenarioType: 'Excepción', steps: [step], sources: [] },
        ],
      },
      input,
    );
    expect(res.cases).toHaveLength(2);
    expect(res.cases[0].sources).toEqual(['RN-007']);
    expect(res.cases[0].technique).toBe('');
    expect(res.discarded).toBe(3);
    expect(res.observations).toBe('ok');
  });

  it('falla si no hay casos válidos', () => {
    expect(() => validateResponse({ cases: [] }, input)).toThrow(GenerationError);
    expect(() => validateResponse('texto', input)).toThrow(GenerationError);
  });
});

describe('SimulatedProvider', () => {
  it('genera casos de los tipos solicitados sin superar el máximo', async () => {
    const out = await new SimulatedProvider(0).generate({ ...input, maxCases: 4 });
    expect(out.cases.map((c) => c.scenarioType)).toEqual(['Positivo', 'Negativo', 'Alternativo', 'Positivo']);
    expect(out.cases[0].sources).toEqual(['RN-007']);
    expect(() => validateResponse(out, { ...input, maxCases: 4 })).not.toThrow();
  });
});
