import { parse } from 'csv-parse/sync';
import { ParseResult } from './parse.types';
import { mapTables } from './table-mapper';

/** Decodifica en UTF-8 y, si hay caracteres inválidos, como Windows-1252 (CSV guardado desde Excel). */
export function decodeText(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8');
  const text = utf8.includes('�') ? new TextDecoder('windows-1252').decode(buffer) : utf8;
  return text.replace(/^﻿/, '');
}

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const candidates = [';', ',', '\t', '|'];
  return candidates
    .map((d) => ({ d, n: firstLine.split(d).length }))
    .sort((a, b) => b.n - a.n)[0].d;
}

export function parseCsv(fileName: string, buffer: Buffer, result: ParseResult): void {
  const text = decodeText(buffer);
  let rows: string[][];
  try {
    rows = parse(text, {
      delimiter: detectDelimiter(text),
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (e) {
    result.issues.push({ fileName, level: 'error', message: `No se pudo leer el CSV: ${(e as Error).message}` });
    return;
  }
  const baseName = fileName.replace(/\.[^.]+$/, '');
  // En CSV el archivo ya identifica la tabla: la ubicación es solo la fila.
  mapTables([{ fileName, name: baseName, locationLabel: '', rows }], result);
}
