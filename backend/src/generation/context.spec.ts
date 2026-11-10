import { EntityType } from '../knowledge/definitions/entity-definitions';
import { directRelations, recordContent } from './context.service';

const all = new Map<EntityType, any[]>([
  ['requirements', [{ code: 'REQ-001' }, { code: 'REQ-002' }]],
  [
    'user-stories',
    [
      { code: 'HU-001', requirements: ['REQ-001'], relatedRules: ['RN-002'] },
      { code: 'HU-002', requirements: ['REQ-002'], relatedRules: [] },
    ],
  ],
  [
    'business-rules',
    [
      { code: 'RN-001', relatedRequirements: ['REQ-001'] },
      { code: 'RN-002', relatedRequirements: [] },
      { code: 'RN-003', relatedRequirements: ['REQ-002'] },
    ],
  ],
  [
    'test-cases',
    [
      { code: 'CP-001', requirements: ['REQ-001'], userStories: [] },
      { code: 'CP-002', requirements: [], userStories: ['HU-001'] },
      { code: 'CP-003', requirements: ['REQ-002'], userStories: ['HU-002'] },
    ],
  ],
  [
    'defects',
    [
      { code: 'DEF-001', testCases: ['CP-002'], requirements: [], userStories: [] },
      { code: 'DEF-002', testCases: [], requirements: [], userStories: ['HU-002'] },
    ],
  ],
]);

const codes = (m: Map<EntityType, Set<string>>, t: EntityType) => [...(m.get(t) ?? [])].sort();

describe('directRelations (trazabilidad)', () => {
  it('desde un requerimiento incluye sus historias y lo vinculado a ellas', () => {
    const m = directRelations(all, 'REQ-001');
    expect(codes(m, 'user-stories')).toEqual(['HU-001']);
    expect(codes(m, 'business-rules')).toEqual(['RN-001', 'RN-002']);
    expect(codes(m, 'test-cases')).toEqual(['CP-001', 'CP-002']);
    expect(codes(m, 'defects')).toEqual(['DEF-001']);
  });

  it('desde una historia incluye su requerimiento y lo vinculado a la historia', () => {
    const m = directRelations(all, 'HU-002');
    expect(codes(m, 'requirements')).toEqual(['REQ-002']);
    expect(codes(m, 'business-rules')).toEqual(['RN-003']);
    expect(codes(m, 'test-cases')).toEqual(['CP-003']);
    expect(codes(m, 'defects')).toEqual(['DEF-002']);
  });

  it('arma el texto de la historia en formato Como/Quiero/Para', () => {
    const text = recordContent('user-stories', {
      code: 'HU-001',
      title: 'Pagar con tarjeta',
      role: 'jugador',
      goal: 'pagar con tarjeta',
      benefit: 'recibir mis gemas',
      acceptanceCriteria: ['Pago aprobado acredita gemas'],
    });
    expect(text).toContain('Como jugador, quiero pagar con tarjeta, para recibir mis gemas');
    expect(text).toContain('Criterios de aceptación: Pago aprobado acredita gemas');
  });
});
