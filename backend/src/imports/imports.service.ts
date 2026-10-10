import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CatalogsService } from '../catalogs/catalogs.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { toObjectId } from '../common/utils/object-id';
import { normalizeKey } from '../common/utils/text';
import { EntityType, getDefinition } from '../knowledge/definitions/entity-definitions';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { collectReferences, FieldIssue, validateRecord } from '../knowledge/validation/record-validator';
import { CreateImportDto, UpdateRowDto } from './dto/import.dto';
import { ImportBatch, ImportBatchDocument, ImportRow, ImportRowDocument, RowStatus } from './import.schemas';
import { parseFiles, UploadedFileLike } from './parsers/file-parser';

export const MAX_ROWS_PER_BATCH = 5000;

@Injectable()
export class ImportsService {
  constructor(
    @InjectModel(ImportBatch.name) private readonly batches: Model<ImportBatch>,
    @InjectModel(ImportRow.name) private readonly rows: Model<ImportRow>,
    private readonly knowledge: KnowledgeService,
    private readonly catalogs: CatalogsService,
  ) {}

  /** Lee los archivos, crea el lote en revisión y valida sus filas. */
  async create(files: UploadedFileLike[], dto: CreateImportDto, user: AuthUser) {
    if (!files?.length) throw new BadRequestException('Adjunte al menos un archivo.');
    const scope = await this.knowledge.resolveScope(dto.project, dto.defaultModule);
    const parsed = await parseFiles(files);
    if (parsed.rows.length > MAX_ROWS_PER_BATCH) {
      throw new BadRequestException(`El lote supera el máximo de ${MAX_ROWS_PER_BATCH} registros; divídalo en varios archivos.`);
    }
    if (!parsed.rows.length) {
      throw new BadRequestException({
        message: 'No se encontraron registros en los archivos. Revise que usen el formato de la plantilla.',
        issues: parsed.issues,
      });
    }
    const batch = await this.batches.create({
      project: scope.project,
      defaultModule: scope.module,
      files: files.map((f) => ({ name: f.originalname, size: f.buffer.length })),
      duplicateStrategy: dto.duplicateStrategy ?? 'skip',
      issues: parsed.issues,
      createdBy: toObjectId(user.id),
    });
    await this.rows.insertMany(
      parsed.rows.map((r, index) => ({
        batch: batch._id,
        index,
        type: r.type,
        source: r.source,
        data: r.data,
        moduleName: r.moduleName,
        duplicateAction: batch.duplicateStrategy,
      })),
    );
    await this.revalidate(batch);
    return this.get(String(batch._id));
  }

  async list(projectId?: string) {
    const filter = projectId ? { project: toObjectId(projectId, 'proyecto') } : {};
    const docs = await this.batches
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate([
        { path: 'project', select: 'name' },
        { path: 'createdBy', select: 'name' },
      ])
      .lean();
    return docs.map((d) => this.serializeBatch(d));
  }

  async get(id: string) {
    const batch = await this.batches
      .findById(toObjectId(id, 'lote'))
      .populate([
        { path: 'project', select: 'name' },
        { path: 'defaultModule', select: 'name' },
        { path: 'createdBy', select: 'name' },
        { path: 'confirmedBy', select: 'name' },
      ])
      .lean();
    if (!batch) throw new NotFoundException('Lote de carga no encontrado.');
    const rows = await this.rows.find({ batch: batch._id }).sort({ index: 1 }).lean();
    return {
      batch: this.serializeBatch(batch),
      rows: rows.map(({ _id, __v, batch: _b, module, ...r }) => ({ id: String(_id), ...r, module: module ? String(module) : null })),
    };
  }

  private serializeBatch(doc: Record<string, any>) {
    const ref = (v: any) => (v && v._id ? { id: String(v._id), name: v.name } : null);
    const { _id, __v, project, defaultModule, createdBy, confirmedBy, ...rest } = doc;
    return {
      id: String(_id),
      ...rest,
      project: ref(project),
      defaultModule: ref(defaultModule),
      createdBy: ref(createdBy),
      confirmedBy: ref(confirmedBy),
    };
  }

  private async getEditableBatch(id: string): Promise<ImportBatchDocument> {
    const batch = await this.batches.findById(toObjectId(id, 'lote'));
    if (!batch) throw new NotFoundException('Lote de carga no encontrado.');
    if (batch.status !== 'EN_REVISION') throw new BadRequestException('El lote ya fue confirmado o cancelado.');
    return batch;
  }

  async updateBatch(id: string, duplicateStrategy: 'skip' | 'update') {
    const batch = await this.getEditableBatch(id);
    batch.duplicateStrategy = duplicateStrategy;
    await batch.save();
    await this.rows.updateMany({ batch: batch._id }, { duplicateAction: duplicateStrategy });
    await this.revalidate(batch);
    return this.get(id);
  }

  async updateRow(id: string, rowId: string, dto: UpdateRowDto) {
    const batch = await this.getEditableBatch(id);
    const row = await this.rows.findOne({ _id: toObjectId(rowId, 'fila'), batch: batch._id });
    if (!row) throw new NotFoundException('Fila no encontrada.');
    if (dto.data) {
      const def = getDefinition(row.type)!;
      // Solo se aceptan claves de la definición del tipo.
      row.data = Object.fromEntries(def.fields.map((f) => [f.key, dto.data![f.key]]));
      row.markModified('data');
    }
    if (dto.module) {
      row.module = toObjectId(dto.module, 'módulo');
      row.moduleName = undefined;
    }
    if (dto.excluded !== undefined) row.excluded = dto.excluded;
    if (dto.duplicateAction) row.duplicateAction = dto.duplicateAction;
    await row.save();
    await this.revalidate(batch);
    return this.get(id);
  }

  /**
   * Valida todas las filas del lote: campos, módulo, códigos repetidos dentro del
   * lote, códigos ya existentes en el proyecto y referencias entre registros.
   */
  async revalidate(batch: ImportBatchDocument): Promise<void> {
    const rows = await this.rows.find({ batch: batch._id }).sort({ index: 1 });
    const existing = await this.knowledge.existingCodes(batch.project);
    const modules = await this.catalogs.listModules(String(batch.project));
    const moduleIds = new Set(modules.map((m) => m.id));
    const moduleByName = new Map(modules.map((m) => [normalizeKey(m.name), m.id]));

    type Work = { row: ImportRowDocument; errors: FieldIssue[]; warnings: FieldIssue[]; value: Record<string, unknown> };
    const work: Work[] = [];
    const batchCodes = new Map<EntityType, Map<string, number[]>>();

    for (const row of rows) {
      if (row.excluded) continue;
      const def = getDefinition(row.type)!;
      const { value, errors, warnings } = validateRecord(def, row.data ?? {});

      // Módulo: el seleccionado, el indicado en el archivo o el predeterminado del lote.
      if (row.module && !moduleIds.has(String(row.module))) row.module = null;
      if (!row.module) {
        if (row.moduleName) {
          const id = moduleByName.get(normalizeKey(row.moduleName));
          if (id) row.module = new Types.ObjectId(id);
          else {
            errors.push({
              field: 'module',
              message: `El módulo "${row.moduleName}" no existe en el proyecto. Selecciónelo o regístrelo en Catálogos.`,
            });
          }
        } else {
          row.module = batch.defaultModule;
        }
      }

      if (value.code) {
        const codes = batchCodes.get(row.type) ?? new Map<string, number[]>();
        codes.set(value.code as string, [...(codes.get(value.code as string) ?? []), row.index]);
        batchCodes.set(row.type, codes);
      }
      work.push({ row, errors, warnings, value });
    }

    for (const w of work) {
      const { row, value, errors, warnings } = w;
      const def = getDefinition(row.type)!;
      const code = value.code as string | null;

      if (code) {
        const same = batchCodes.get(row.type)!.get(code)!;
        if (same.length > 1) {
          errors.push({
            field: 'code',
            message: `El código ${code} se repite en el lote (filas ${same.map((i) => i + 1).join(', ')}).`,
          });
        }
        const existingId = existing.get(row.type)!.get(code) ?? null;
        row.duplicateOf = existingId;
        if (existingId) {
          warnings.push({
            field: 'code',
            message:
              row.duplicateAction === 'update'
                ? `El código ${code} ya existe en el proyecto: el registro se actualizará.`
                : `El código ${code} ya existe en el proyecto: el registro se omitirá.`,
          });
        }
      } else {
        row.duplicateOf = null;
      }

      for (const ref of collectReferences(def, value)) {
        const t = ref.field.refType!;
        if (!existing.get(t)!.has(ref.code) && !batchCodes.get(t)?.has(ref.code)) {
          warnings.push({
            field: ref.field.key,
            message: `${ref.field.label}: el código ${ref.code} no existe en el proyecto ni en el lote.`,
          });
        }
      }

      row.data = value;
      row.markModified('data');
      row.fieldErrors = errors.map((e) => ({ ...e, level: 'error' }));
      row.fieldWarnings = warnings.map((e) => ({ ...e, level: 'warning' }));
      row.status = errors.length ? 'error' : warnings.length ? 'warning' : 'valid';
    }

    for (const row of rows) {
      if (row.excluded) {
        row.status = 'excluded';
        row.fieldErrors = [];
        row.fieldWarnings = [];
      }
    }
    await this.rows.bulkSave(rows);

    const count = (s: RowStatus) => rows.filter((r) => r.status === s).length;
    batch.summary = {
      total: rows.length,
      valid: count('valid'),
      warning: count('warning'),
      error: count('error'),
      excluded: count('excluded'),
      duplicates: rows.filter((r) => !r.excluded && r.duplicateOf).length,
      ...Object.fromEntries(
        [...new Set(rows.map((r) => r.type))].map((t) => [t, rows.filter((r) => r.type === t && !r.excluded).length]),
      ),
    };
    batch.markModified('summary');
    await batch.save();
  }

  /** Guarda en la base de conocimiento las filas del lote. */
  async confirm(id: string, user: AuthUser) {
    const batch = await this.getEditableBatch(id);
    await this.revalidate(batch);
    if (batch.summary.error > 0) {
      throw new BadRequestException(
        `Hay ${batch.summary.error} fila(s) con errores. Corríjalas o exclúyalas antes de confirmar.`,
      );
    }
    const rows = await this.rows.find({ batch: batch._id, excluded: false }).sort({ index: 1 });
    const result = { created: 0, updated: 0, skipped: 0, failed: 0 };
    const userId = toObjectId(user.id);

    for (const row of rows) {
      const def = getDefinition(row.type)!;
      const model = this.knowledge.model(def);
      try {
        if (row.duplicateOf && row.duplicateAction === 'skip') {
          row.result = 'skipped';
        } else if (row.duplicateOf) {
          await model.updateOne(
            { _id: new Types.ObjectId(row.duplicateOf) },
            { ...row.data, module: row.module, updatedBy: userId },
          );
          row.result = 'updated';
        } else {
          await model.create({
            ...row.data,
            project: batch.project,
            module: row.module,
            origin: { type: 'MASIVO', fileName: row.source?.fileName, batchId: batch._id },
            createdBy: userId,
            updatedBy: userId,
          });
          row.result = 'created';
        }
      } catch (e) {
        row.result = 'failed';
        row.resultMessage =
          (e as { code?: number }).code === 11000
            ? 'El código fue registrado por otro usuario mientras se revisaba el lote.'
            : (e as Error).message;
      }
      result[row.result]++;
    }
    await this.rows.bulkSave(rows);
    batch.status = 'CONFIRMADO';
    batch.result = result;
    batch.confirmedBy = userId;
    batch.confirmedAt = new Date();
    await batch.save();
    return this.get(id);
  }

  async cancel(id: string) {
    const batch = await this.getEditableBatch(id);
    batch.status = 'CANCELADO';
    await batch.save();
    await this.rows.deleteMany({ batch: batch._id });
    return this.get(id);
  }
}
