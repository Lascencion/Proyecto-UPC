import { BUSINESS_RULE_DEFINITION, TEST_CASE_DEFINITION } from '../definitions/entity-definitions';
import { parseDate, toList, validateRecord } from './record-validator';

describe('validateRecord', () => {
  it('normaliza enumerados sin importar tildes ni mayúsculas', () => {
    const r = validateRecord(BUSINESS_RULE_DEFINITION, {
      code: ' rn-001 ',
      name: 'Límite diario',
      description: 'desc',
      type: 'validacion',
      criticality: 'ALTA',
      relatedRequirements: 'req-001; REQ-002;REQ-001',
    });
    expect(r.errors).toEqual([]);
    expect(r.value.code).toBe('RN-001');
    expect(r.value.type).toBe('Validación');
    expect(r.value.criticality).toBe('Alta');
    expect(r.value.relatedRequirements).toEqual(['REQ-001', 'REQ-002']);
  });

  it('reporta obligatorios y valores no permitidos', () => {
    const r = validateRecord(TEST_CASE_DEFINITION, { code: 'CP-1', scenarioType: 'Feliz' });
    const fields = r.errors.map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining(['title', 'requirement', 'scenarioType', 'steps', 'expectedResult', 'executionStatus']),
    );
  });

  it('valida y renumera pasos', () => {
    const r = validateRecord(TEST_CASE_DEFINITION, {
      code: 'CP-001',
      title: 't',
      requirement: 'REQ-001',
      scenarioType: 'Positivo',
      expectedResult: 'ok',
      executionStatus: 'Exitoso',
      steps: [
        { number: 3, action: 'c', expectedResult: 'rc' },
        { number: 1, action: 'a', expectedResult: 'ra' },
        { action: '', expectedResult: '' },
      ],
    });
    expect(r.errors).toEqual([]);
    expect(r.value.steps).toEqual([
      { number: 1, action: 'a', expectedResult: 'ra' },
      { number: 2, action: 'c', expectedResult: 'rc' },
    ]);
  });

  it('advierte si el código no usa el prefijo sugerido', () => {
    const r = validateRecord(BUSINESS_RULE_DEFINITION, { code: 'X-1', name: 'n', description: 'd' });
    expect(r.errors).toEqual([]);
    expect(r.warnings[0].field).toBe('code');
  });
});

describe('utilidades', () => {
  it('toList separa por punto y coma y saltos de línea', () => {
    expect(toList('a; b\n- c\n\n')).toEqual(['a', 'b', 'c']);
  });

  it('parseDate acepta varios formatos', () => {
    expect(parseDate('2025-03-10')?.toISOString()).toBe('2025-03-10T00:00:00.000Z');
    expect(parseDate('10/03/2025')?.toISOString()).toBe('2025-03-10T00:00:00.000Z');
    expect(parseDate('31/02/2025')).toBeNull();
    expect(parseDate('mañana')).toBeNull();
  });
});
