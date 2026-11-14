import { directRelations } from '../generation/context.service';
import { EntityType } from './definitions/entity-definitions';
import { buildTraceability, TraceRec } from './traceability';

// Subconjunto del histórico de la demo (Videojuego Nexa Legends).
const data = (): Map<EntityType, TraceRec[]> =>
  new Map<EntityType, TraceRec[]>([
    [
      'requirements',
      [
        { _id: 'r6', code: 'REQ-006', title: 'Pago con criptomonedas', priority: 'Baja' },
        { _id: 'r7', code: 'REQ-007', title: 'Aplicación de promociones', priority: 'Alta' },
      ],
    ],
    [
      'user-stories',
      [
        { _id: 'h6', code: 'HU-006', title: 'Pagar con criptomonedas', requirements: ['REQ-006'], relatedRules: ['RN-010'] },
        { _id: 'h7', code: 'HU-007', title: 'Aprovechar promociones', requirements: ['REQ-007'], relatedRules: ['RN-006', 'RN-009'] },
      ],
    ],
    [
      'business-rules',
      [
        { _id: 'b6', code: 'RN-006', name: 'Descuento Premium', relatedRequirements: ['REQ-007'], criticality: 'Alta', type: 'Cálculo' },
        { _id: 'b8', code: 'RN-008', name: 'Vigencia tiempo limitado', relatedRequirements: ['REQ-007'] },
        { _id: 'b9', code: 'RN-009', name: 'No acumulables', relatedRequirements: ['REQ-007'] },
        { _id: 'b10', code: 'RN-010', name: 'Condiciones cripto', relatedRequirements: ['REQ-006'] },
      ],
    ],
    [
      'test-cases',
      [
        { _id: 'c3', code: 'CP-003', title: 'Descuento 20 %', requirements: ['REQ-007'], userStories: ['HU-007'], relatedRules: ['RN-006'], scenarioType: 'Positivo', executionStatus: 'Fallido', defects: ['DEF-001'] },
        { _id: 'c9', code: 'CP-009', title: 'Promo vencida', userStories: ['HU-007'], relatedRules: ['RN-008'], scenarioType: 'Negativo', executionStatus: 'Fallido' },
        { _id: 'c10', code: 'CP-010', title: 'Cripto Premium', requirements: ['REQ-006'], userStories: ['HU-006'], relatedRules: ['RN-099'], scenarioType: 'Positivo', executionStatus: 'Exitoso' },
      ],
    ],
    [
      'defects',
      [
        { _id: 'd1', code: 'DEF-001', title: 'Redondeo', testCases: ['CP-003'], requirements: ['REQ-007'], status: 'Resuelto', severity: 'Media' },
        { _id: 'd3', code: 'DEF-003', title: 'Promo vencida aplicada', testCases: ['CP-009'], status: 'En progreso', severity: 'Alta' },
      ],
    ],
  ]);

const codes = (t: ReturnType<typeof buildTraceability>, type: EntityType) =>
  t.groups.find((g) => g.type === type)!.items.map((i) => i.code);

describe('buildTraceability', () => {
  it('recorre las relaciones en ambos sentidos desde un requerimiento', () => {
    const t = buildTraceability(data(), 'requirements', 'REQ-007');
    expect(t.record).toEqual({ id: 'r7', type: 'requirements', code: 'REQ-007', title: 'Aplicación de promociones' });
    expect(codes(t, 'user-stories')).toEqual(['HU-007']);
    expect(codes(t, 'business-rules')).toEqual(['RN-006', 'RN-008', 'RN-009']);
    expect(codes(t, 'test-cases')).toEqual(['CP-003', 'CP-009']);
    expect(codes(t, 'defects')).toEqual(['DEF-001', 'DEF-003']);
    const cp9 = t.groups.find((g) => g.type === 'test-cases')!.items.find((i) => i.code === 'CP-009')!;
    expect(cp9).toMatchObject({ id: 'c9', relation: 'indirecta', via: 'HU-007', status: 'Fallido', detail: 'Negativo' });
    expect(t.scenarioCoverage).toEqual({ Positivo: 1, Negativo: 1, Alternativo: 0, Excepción: 0 });
    expect(t.alerts.map((a) => a.message)).toEqual([
      'Reglas de negocio sin casos de prueba: RN-009.',
      'Tipos de escenario sin casos: Alternativo, Excepción.',
      'Defectos pendientes de solución: DEF-003.',
    ]);
  });

  it('coincide con la cadena usada como contexto en la generación', () => {
    for (const [type, code] of [['requirements', 'REQ-007'], ['user-stories', 'HU-007'], ['requirements', 'REQ-006']] as const) {
      const t = buildTraceability(data(), type, code);
      const expected = directRelations(data() as never, code);
      for (const [rt, set] of expected) {
        if (rt === type) continue;
        expect({ code, rt, codes: codes(t, rt) }).toEqual({ code, rt, codes: [...set].sort() });
      }
    }
  });

  it('desde un caso de prueba muestra sus vínculos y avisa de relaciones inexistentes', () => {
    const t = buildTraceability(data(), 'test-cases', 'CP-010');
    expect(codes(t, 'requirements')).toEqual(['REQ-006']);
    expect(codes(t, 'user-stories')).toEqual(['HU-006']);
    expect(codes(t, 'business-rules')).toEqual([]);
    expect(t.alerts).toEqual([{ level: 'warning', message: 'Relaciones con registros que no existen en el proyecto: RN-099.' }]);
  });

  it('avisa cuando una regla no tiene casos y cuando un caso fallido no tiene defecto', () => {
    expect(buildTraceability(data(), 'business-rules', 'RN-010').alerts[0].message).toBe('Ningún caso de prueba cubre esta regla.');
    const t = buildTraceability(data(), 'business-rules', 'RN-008');
    expect(codes(t, 'test-cases')).toEqual(['CP-009']);
    expect(codes(t, 'defects')).toEqual(['DEF-003']);
    const d = data();
    d.get('defects')!.splice(1, 1);
    expect(buildTraceability(d, 'test-cases', 'CP-009').alerts[0].message).toBe('El caso falló y no tiene un defecto asociado.');
  });
});
