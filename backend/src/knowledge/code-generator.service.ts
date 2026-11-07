import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { CODE_DIGITS, EntityDefinition } from './definitions/entity-definitions';

interface Counter {
  _id: string;
  seq: number;
}

/** Secuencia de códigos: prefijo, colección donde viven y nombre del contador. */
export interface CodeSequence {
  prefix: string;
  collection: string;
  name: string;
}

export const sequenceOf = (def: EntityDefinition): CodeSequence => ({
  prefix: def.codePrefix,
  collection: def.collection,
  name: def.type,
});

/**
 * Genera los códigos correlativos (REQ-001, RN-001, GEN-001…) por proyecto. Usa un
 * contador atómico en la colección `counters`, de modo que dos usuarios que
 * registran a la vez nunca obtienen el mismo código.
 */
@Injectable()
export class CodeGeneratorService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private get counters() {
    return this.connection.collection<Counter>('counters');
  }

  private static format(seq: CodeSequence, n: number): string {
    return `${seq.prefix}-${String(n).padStart(CODE_DIGITS, '0')}`;
  }

  private static asSequence(target: EntityDefinition | CodeSequence): CodeSequence {
    return 'codePrefix' in target ? sequenceOf(target) : target;
  }

  /** Mayor correlativo ya usado en el proyecto (considera registros previos al contador). */
  private async maxExisting(seq: CodeSequence, projectId: Types.ObjectId): Promise<number> {
    const rx = new RegExp(`^${seq.prefix}-(\\d+)$`);
    const docs = await this.connection
      .collection(seq.collection)
      .find({ project: projectId, code: { $regex: rx } }, { projection: { code: 1 } })
      .toArray();
    return docs.reduce((max, d) => Math.max(max, Number(rx.exec(d.code as string)?.[1] ?? 0)), 0);
  }

  /** Código que recibiría el próximo registro (solo para mostrarlo; no lo reserva). */
  async preview(target: EntityDefinition | CodeSequence, projectId: Types.ObjectId): Promise<string> {
    const seq = CodeGeneratorService.asSequence(target);
    const counter = await this.counters.findOne({ _id: `${String(projectId)}:${seq.name}` });
    const last = counter ? counter.seq : await this.maxExisting(seq, projectId);
    return CodeGeneratorService.format(seq, last + 1);
  }

  /** Reserva y devuelve el siguiente código. */
  async next(target: EntityDefinition | CodeSequence, projectId: Types.ObjectId): Promise<string> {
    const seq = CodeGeneratorService.asSequence(target);
    const _id = `${String(projectId)}:${seq.name}`;
    let counter = await this.counters.findOneAndUpdate({ _id }, { $inc: { seq: 1 } }, { returnDocument: 'after' });
    if (!counter) {
      // Primer uso: el contador parte del mayor código existente.
      const start = await this.maxExisting(seq, projectId);
      try {
        await this.counters.insertOne({ _id, seq: start + 1 });
        return CodeGeneratorService.format(seq, start + 1);
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
        counter = await this.counters.findOneAndUpdate({ _id }, { $inc: { seq: 1 } }, { returnDocument: 'after' });
      }
    }
    return CodeGeneratorService.format(seq, counter!.seq);
  }
}
