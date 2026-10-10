import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import * as ExcelJS from 'exceljs';
import {
  ENTITY_DEFINITIONS,
  EntityDefinition,
  FieldDefinition,
  getDefinition,
  MODULE_COLUMN,
  REFERENCE_COLUMN,
  STEP_COLUMNS,
  TEST_CASE_DEFINITION,
} from '../knowledge/definitions/entity-definitions';
import { EXAMPLE_MODULE, TEMPLATE_EXAMPLES } from './template-examples';

export interface TemplateFile {
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

const HEADER_FILL = 'FF1F4E79';
const REQUIRED_FILL = 'FFC00000';

/** Columnas de la plantilla: campos (sin pasos) + módulo después del código. */
function templateColumns(def: EntityDefinition): { key: string; label: string; field?: FieldDefinition }[] {
  const fields = def.fields.filter((f) => f.type !== 'steps');
  return [
    { key: fields[0].key, label: REFERENCE_COLUMN.label, field: fields[0] },
    { key: MODULE_COLUMN.key, label: MODULE_COLUMN.label },
    ...fields.slice(1).map((f) => ({ key: f.key, label: f.label, field: f })),
  ];
}

const headerLabel = (c: { label: string; field?: FieldDefinition }) => (c.field?.required ? `${c.label} *` : c.label);

function exampleValue(example: Record<string, unknown>, key: string): string {
  if (key === MODULE_COLUMN.key) return EXAMPLE_MODULE;
  const v = example[key];
  if (Array.isArray(v)) return v.join('; ');
  return v === undefined || v === null ? '' : String(v);
}

function fieldHelp(field?: FieldDefinition): string {
  if (field?.type === 'code') {
    return 'Opcional. Referencia temporal (p. ej. REQ1) para relacionar registros de este archivo. El sistema asigna el código definitivo (REQ-001…) al confirmar la carga.';
  }
  if (!field) return 'Opcional. Nombre del módulo/flujo; si se deja vacío se usa el módulo elegido al cargar.';
  const parts = [field.required ? 'Obligatorio.' : 'Opcional.'];
  if (field.type === 'enum') parts.push(`Valores: ${field.options!.join(', ')}.`);
  if (field.type === 'date') parts.push('Formato AAAA-MM-DD o DD/MM/AAAA.');
  if (field.type === 'list') parts.push('Varios valores separados por ";".');
  if (field.type === 'refList') {
    parts.push('Referencias de este archivo o códigos ya registrados en el proyecto, separados por ";".');
  }
  if (field.help) parts.push(field.help);
  return parts.join(' ');
}

@Injectable()
export class TemplatesService {
  async excel(): Promise<TemplateFile> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema de generación de casos de prueba';
    this.instructionsSheet(wb);

    for (const def of ENTITY_DEFINITIONS) {
      const cols = templateColumns(def);
      const ws = wb.addWorksheet(def.sheetName);
      ws.columns = cols.map((c) => ({ header: headerLabel(c), key: c.key, width: c.field?.type === 'text' ? 45 : 22 }));
      for (const example of TEMPLATE_EXAMPLES[def.type]) {
        ws.addRow(Object.fromEntries(cols.map((c) => [c.key, exampleValue(example, c.key)])));
      }
      this.styleHeader(ws, cols.map((c) => !!c.field?.required));
      cols.forEach((c, i) => {
        ws.getRow(1).getCell(i + 1).note = fieldHelp(c.field);
        if (c.field?.type === 'enum') {
          const letter = ws.getColumn(i + 1).letter;
          for (let r = 2; r <= 500; r++) {
            ws.getCell(`${letter}${r}`).dataValidation = {
              type: 'list',
              allowBlank: !c.field.required,
              formulae: [`"${c.field.options!.join(',')}"`],
              showErrorMessage: true,
              errorTitle: 'Valor no permitido',
              error: `Valores permitidos: ${c.field.options!.join(', ')}`,
            };
          }
        }
      });
      ws.eachRow((row) => (row.alignment = { vertical: 'top', wrapText: true }));
    }

    // Hoja de pasos
    const steps = wb.addWorksheet(STEP_COLUMNS.sheetName);
    const stepCols = [STEP_COLUMNS.testCaseCode, STEP_COLUMNS.number, STEP_COLUMNS.action, STEP_COLUMNS.expectedResult];
    steps.columns = stepCols.map((c) => ({ header: `${c.label} *`, key: c.key, width: c.key === 'number' ? 10 : 45 }));
    for (const tc of TEMPLATE_EXAMPLES['test-cases']) {
      for (const s of tc.steps as { number: number; action: string; expectedResult: string }[]) {
        steps.addRow({ testCaseCode: tc.code, ...s });
      }
    }
    this.styleHeader(steps, stepCols.map(() => true));

    return {
      fileName: 'plantilla_base_conocimiento.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await wb.xlsx.writeBuffer()),
    };
  }

  private styleHeader(ws: ExcelJS.Worksheet, required: boolean[]) {
    const header = ws.getRow(1);
    header.height = 30;
    header.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: required[col - 1] ? REQUIRED_FILL : HEADER_FILL } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private instructionsSheet(wb: ExcelJS.Workbook) {
    const ws = wb.addWorksheet('Instrucciones');
    ws.columns = [{ width: 28 }, { width: 110 }];
    const lines: [string, string][] = [
      ['Plantilla de carga masiva', 'Base de conocimiento para la generación de casos de prueba funcionales'],
      ['', ''],
      ['Cómo usarla', '1. Complete una fila por registro en la hoja correspondiente. Puede dejar vacías las hojas que no necesite.'],
      ['', '2. Las columnas en rojo y con * son obligatorias. Pase el cursor sobre un encabezado para ver su ayuda.'],
      ['', '3. Elimine las filas de ejemplo antes de cargar el archivo.'],
      ['', '4. No cambie los nombres de las hojas ni de los encabezados.'],
      ['', '5. Los pasos de los casos de prueba van en la hoja "PasosCasoPrueba", enlazados por el código del caso.'],
      ['', '6. La columna "Referencia" es temporal (p. ej. REQ1, RN1, CP1): sirve para relacionar registros de este archivo y debe ser única por hoja.'],
      ['', '7. El sistema asigna los códigos definitivos (REQ-001, RN-001…) al confirmar la carga y actualiza las relaciones.'],
      ['', '8. Para relacionar con registros ya guardados use su código (p. ej. REQ-001). Varios valores se separan con ";".'],
      ['', '9. El proyecto se elige al cargar el archivo. La columna "Módulo" es opcional: si se deja vacía se usa el módulo elegido al cargar.'],
      ['', ''],
      ['Hojas', ''],
      ...ENTITY_DEFINITIONS.map((d) => [d.sheetName, `${d.labelPlural} (código asignado: ${d.codePrefix}-001, ${d.codePrefix}-002…)`] as [string, string]),
      [STEP_COLUMNS.sheetName, 'Pasos de cada caso de prueba (un paso por fila)'],
    ];
    lines.forEach((l) => ws.addRow(l));
    ws.getRow(1).font = { bold: true, size: 14 };
    ws.getCell('A13').font = { bold: true };
    ws.getCell('A3').font = { bold: true };
  }

  csv(type: string): TemplateFile {
    const isSteps = type === 'test-case-steps';
    const def = getDefinition(type);
    if (!def && !isSteps) throw new NotFoundException('Tipo de plantilla no existe.');
    const quote = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines: string[][] = [];
    let fileName: string;
    if (isSteps) {
      lines.push([STEP_COLUMNS.testCaseCode.label, STEP_COLUMNS.number.label, STEP_COLUMNS.action.label, STEP_COLUMNS.expectedResult.label]);
      for (const tc of TEMPLATE_EXAMPLES['test-cases']) {
        for (const s of tc.steps as { number: number; action: string; expectedResult: string }[]) {
          lines.push([String(tc.code), String(s.number), s.action, s.expectedResult]);
        }
      }
      fileName = `${STEP_COLUMNS.sheetName}.csv`;
    } else {
      const cols = templateColumns(def!);
      lines.push(cols.map((c) => c.label));
      for (const example of TEMPLATE_EXAMPLES[def!.type]) lines.push(cols.map((c) => exampleValue(example, c.key)));
      fileName = `${def!.sheetName}.csv`;
    }
    // Separador ";" y BOM UTF-8 para que Excel en español lo abra correctamente.
    const text = '﻿' + lines.map((l) => l.map(quote).join(';')).join('\r\n') + '\r\n';
    return { fileName, contentType: 'text/csv; charset=utf-8', buffer: Buffer.from(text, 'utf8') };
  }

  async word(): Promise<TemplateFile> {
    const border = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
    const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
    const cell = (text: string, opts: { bold?: boolean; fill?: string; width?: number; color?: string } = {}) =>
      new TableCell({
        width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
        shading: opts.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
        children: (text || '').split('\n').map(
          (line) => new Paragraph({ children: [new TextRun({ text: line, bold: opts.bold, color: opts.color })] }),
        ),
      });

    const recordTable = (def: EntityDefinition, example: Record<string, unknown>) =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders,
        rows: [
          new TableRow({
            children: [
              cell('Tipo', { bold: true, fill: '1F4E79', width: 30, color: 'FFFFFF' }),
              cell(def.wordTypeLabel, { bold: true, fill: '1F4E79', width: 70, color: 'FFFFFF' }),
            ],
          }),
          ...templateColumns(def).map(
            (c) =>
              new TableRow({
                children: [
                  cell(headerLabel(c), { bold: true, fill: 'DCE6F1', width: 30 }),
                  cell(Array.isArray(example[c.key]) ? (example[c.key] as string[]).join('\n') : exampleValue(example, c.key), { width: 70 }),
                ],
              }),
          ),
        ],
      });

    const stepsTable = (steps: { number: number; action: string; expectedResult: string }[]) =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders,
        rows: [
          new TableRow({
            children: [
              cell(STEP_COLUMNS.number.label, { bold: true, fill: 'DCE6F1', width: 12 }),
              cell(STEP_COLUMNS.action.label, { bold: true, fill: 'DCE6F1', width: 44 }),
              cell(STEP_COLUMNS.expectedResult.label, { bold: true, fill: 'DCE6F1', width: 44 }),
            ],
          }),
          ...steps.map(
            (s) => new TableRow({ children: [cell(String(s.number)), cell(s.action), cell(s.expectedResult)] }),
          ),
        ],
      });

    const p = (text: string, opts: { bold?: boolean } = {}) => new Paragraph({ children: [new TextRun({ text, bold: opts.bold })] });
    const children: (Paragraph | Table)[] = [
      new Paragraph({ text: 'Plantilla de carga masiva - Base de conocimiento', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: 'Instrucciones', heading: HeadingLevel.HEADING_1 }),
      p('1. Cada registro es una tabla de dos columnas (Campo | Valor). La primera fila indica el tipo: Requerimiento, Regla de negocio, Caso de prueba o Defecto.'),
      p('2. Los campos marcados con * son obligatorios. No cambie los nombres de la primera columna.'),
      p('3. Los pasos de un caso de prueba van en una tabla inmediatamente después de su tabla, con las columnas "N° paso | Acción | Resultado esperado".'),
      p('4. En listas (criterios de aceptación, registros relacionados) escriba un valor por línea o sepárelos con ";".'),
      p('5. "Referencia" es temporal (p. ej. REQ1): sirve para relacionar registros de este documento. El sistema asigna los códigos definitivos (REQ-001…) al confirmar la carga. Para relacionar con registros ya guardados use su código.'),
      p('6. Para agregar registros copie y pegue una tabla del mismo tipo. Elimine los ejemplos antes de cargar el archivo.'),
      p('7. El proyecto se elige al cargar el archivo; el campo "Módulo" es opcional.'),
    ];
    for (const def of ENTITY_DEFINITIONS) {
      children.push(new Paragraph({ text: def.labelPlural, heading: HeadingLevel.HEADING_1 }));
      const help = templateColumns(def)
        .filter((c) => c.field?.type === 'enum')
        .map((c) => `${c.label}: ${c.field!.options!.join(', ')}`);
      if (help.length) children.push(p(`Valores permitidos — ${help.join(' | ')}`));
      for (const example of TEMPLATE_EXAMPLES[def.type]) {
        children.push(recordTable(def, example));
        if (def.type === TEST_CASE_DEFINITION.type) {
          children.push(p(''), stepsTable(example.steps as { number: number; action: string; expectedResult: string }[]));
        }
        children.push(p(''));
      }
    }

    const doc = new Document({ creator: 'Sistema de generación de casos de prueba', sections: [{ children }] });
    return {
      fileName: 'plantilla_base_conocimiento.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: await Packer.toBuffer(doc),
    };
  }
}
