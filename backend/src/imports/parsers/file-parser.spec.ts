import { getDefinition } from '../../knowledge/definitions/entity-definitions';
import { validateRecord } from '../../knowledge/validation/record-validator';
import { TEMPLATE_EXAMPLES } from '../../templates/template-examples';
import { TemplatesService } from '../../templates/templates.service';
import { parseFiles } from './file-parser';
import { ParseResult } from './parse.types';

const templates = new TemplatesService();
const expectedCounts = Object.fromEntries(Object.entries(TEMPLATE_EXAMPLES).map(([t, rows]) => [t, rows.length]));

function expectExamples(result: ParseResult) {
  const counts: Record<string, number> = {};
  for (const row of result.rows) counts[row.type] = (counts[row.type] ?? 0) + 1;
  expect(counts).toEqual(expectedCounts);
  expect(result.issues.filter((i) => i.level === 'error')).toEqual([]);
  for (const row of result.rows) {
    const { errors } = validateRecord(getDefinition(row.type)!, row.data);
    expect({ location: row.source.location, errors }).toEqual({ location: row.source.location, errors: [] });
    expect(row.moduleName).toBe('Compra de monedas virtuales');
  }
  const cp1 = result.rows.find((r) => r.data.code === 'CP-001')!;
  const { value } = validateRecord(getDefinition('test-cases')!, cp1.data);
  expect((value.steps as unknown[]).length).toBe(4);
  expect(value.relatedRules).toEqual(['RN-001']);
}

describe('parseFiles (ida y vuelta con las plantillas)', () => {
  it('lee la plantilla Excel', async () => {
    const file = await templates.excel();
    expectExamples(await parseFiles([{ originalname: file.fileName, buffer: file.buffer }]));
  });

  it('lee la plantilla Word', async () => {
    const file = await templates.word();
    const result = await parseFiles([{ originalname: file.fileName, buffer: file.buffer }]);
    expectExamples(result);
    const req = result.rows.find((r) => r.data.code === 'REQ-001')!;
    const { value } = validateRecord(getDefinition('requirements')!, req.data);
    expect((value.acceptanceCriteria as string[]).length).toBe(3);
  });

  it('lee las plantillas CSV (un archivo por tipo, pasos aparte)', async () => {
    const types = ['requirements', 'business-rules', 'test-cases', 'defects', 'test-case-steps'];
    const files = types.map((t) => templates.csv(t)).map((f) => ({ originalname: f.fileName, buffer: f.buffer }));
    expectExamples(await parseFiles(files));
  });

  it('identifica CSV por encabezados aunque el nombre no sea estándar y acepta coma como separador', async () => {
    const csv = 'Código,Título,Descripción,Prioridad\nREQ-9,"Compra, con coma",Desc,alta\n';
    const result = await parseFiles([{ originalname: 'datos.csv', buffer: Buffer.from(csv) }]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ type: 'requirements', data: { code: 'REQ-9', title: 'Compra, con coma' } });
  });

  it('informa formatos no soportados y pasos huérfanos', async () => {
    const steps = 'Código caso;N° paso;Acción;Resultado esperado\nCP-404;1;a;b\n';
    const result = await parseFiles([
      { originalname: 'viejo.xls', buffer: Buffer.from('x') },
      { originalname: 'PasosCasoPrueba.csv', buffer: Buffer.from(steps) },
    ]);
    expect(result.issues.map((i) => i.level)).toEqual(['error', 'warning']);
  });
});
