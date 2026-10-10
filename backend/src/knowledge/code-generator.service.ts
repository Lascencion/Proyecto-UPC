import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { EntityDefinition, formatCode } from './definitions/entity-definitions';

interface Counter {
  _id: string;
  seq: number;
}

/**
 * Genera los códigos correlativos (REQ-001, RN-001…) por proyecto y tipo. Usa un
 * contador atómico en la colección `counters`, de modo que dos usuarios que
 * registran a la vez nunca obtienen el mismo código.
 */
@Injectable()
export class CodeGeneratorService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private get counters() {
    return this.connection.collection<Counter>('counters');
  }

  private key(def: EntityDefinition, projectId: Types.ObjectId): string {
    return `${String(projectId)}:${def.type}`;
  }

  /** Mayor correlativo ya usado en el proyecto (considera registros previos al contador). */
  private async maxExisting(def: EntityDefinition, projectId: Types.ObjectId): Promise<number> {
    const rx = new RegExp(`^${def.codePrefix}-(\\d+)$`);
    const docs = await this.connection
      .collection(def.collection)
      .find({ project: projectId, code: { $regex: rx } }, { projection: { code: 1 } })
      .toArray();
    return docs.reduce((max, d) => Math.max(max, Number(rx.exec(d.code as string)?.[1] ?? 0)), 0);
  }

  /** Código que recibiría el próximo registro (solo para mostrarlo; no lo reserva). */
  async preview(def: EntityDefinition, projectId: Types.ObjectId): Promise<string> {
    const counter = await this.counters.findOne({ _id: this.key(def, projectId) });
    const last = counter ? counter.seq : await this.maxExisting(def, projectId);
    return formatCode(def, last + 1);
  }

  /** Reserva y devuelve el siguiente código. */
  async next(def: EntityDefinition, projectId: Types.ObjectId): Promise<string> {
    const _id = this.key(def, projectId);
    let counter = await this.counters.findOneAndUpdate({ _id }, { $inc: { seq: 1 } }, { returnDocument: 'after' });
    if (!counter) {
      // Primer uso: el contador parte del mayor código existente.
      const start = await this.maxExisting(def, projectId);
      try {
        await this.counters.insertOne({ _id, seq: start + 1 });
        return formatCode(def, start + 1);
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
        counter = await this.counters.findOneAndUpdate({ _id }, { $inc: { seq: 1 } }, { returnDocument: 'after' });
      }
    }
    return formatCode(def, counter!.seq);
  }
}
