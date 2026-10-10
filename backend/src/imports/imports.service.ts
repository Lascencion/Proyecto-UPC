import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CatalogsService } from '../catalogs/catalogs.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { toObjectId } from '../common/utils/object-id';
import { normalizeKey } from '../common/utils/text';
import { EntityType, getDefinition } from '../knowledge/definitions/entity-definitions';
import { CodeGeneratorService } from '../knowledge/code-generator.service';
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
    private readonly codes: CodeGeneratorService,
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
    await row.save();
    await this.revalidate(batch);
    return this.get(id);
  }

  /**
   * Valida todas las filas del lote: campos, módulo, referencias temporales
   * repetidas dentro del lote y referencias entre registros (del lote o ya
   * registrados en el proyecto).
   */
  async revalidate(batch: ImportBatchDocument): Promise<void> {
    const rows = await this.rows.find({ batch: batch._id }).sort({ index: 1 });
    const existing = await this.knowledge.existingCodes(batch.project);
    const modules = await this.catalogs.listModules(String(batch.project));
    const moduleIds = new Set(modules.map((m) => m.id));
    const moduleByName = new Map(modules.map((m) => [normalizeKey(m.name), m.id]));

    type Work = { row: ImportRowDocument; errors: FieldIssue[]; warnings: FieldIssue[]; value: Record<string, unknown> };
    const work: Work[] = [];
    const batchRefs = new Map<EntityType, Map<string, number[]>>();

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
        const refs = batchRefs.get(row.type) ?? new Map<string, number[]>();
        refs.set(value.code as string, [...(refs.get(value.code as string) ?? []), row.index]);
        batchRefs.set(row.type, refs);
      }
      work.push({ row, errors, warnings, value });
    }

    for (const w of work) {
      const { row, value, errors, warnings } = w;
      const def = getDefinition(row.type)!;
      const ref = value.code as string | null;

      if (ref) {
        const same = batchRefs.get(row.type)!.get(ref)!;
        if (same.length > 1) {
          errors.push({
            field: 'code',
            message: `La referencia ${ref} se repite en el lote (filas ${same.map((i) => i + 1).join(', ')}).`,
          });
        }
      }

      // Una referencia apunta primero a un registro del lote y, si no está, a uno ya registrado.
      for (const r of collectReferences(def, value)) {
        const t = r.field.refType!;
        if (!batchRefs.get(t)?.has(r.code) && !existing.get(t)!.has(r.code)) {
          warnings.push({
            field: r.field.key,
            message: `${r.field.label}: ${r.code} no está en el lote ni registrado en el proyecto; se descartará al guardar.`,
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
      ...Object.fromEntries(
        [...new Set(rows.map((r) => r.type))].map((t) => [t, rows.filter((r) => r.type === t && !r.excluded).length]),
      ),
    };
    batch.markModified('summary');
    await batch.save();
  }

  /**
   * Guarda las filas del lote en la base de conocimiento: asigna a cada registro
   * su código definitivo y traduce las referencias temporales a esos códigos.
   */
  async confirm(id: string, user: AuthUser) {
    const batch = await this.getEditableBatch(id);
    await this.revalidate(batch);
    if (batch.summary.error > 0) {
      throw new BadRequestException(
        `Hay ${batch.summary.error} fila(s) con errores. Corríjalas o exclúyalas antes de confirmar.`,
      );
    }
    const rows = await this.rows.find({ batch: batch._id, excluded: false }).sort({ index: 1 });
    const existing = await this.knowledge.existingCodes(batch.project);

    // 1. Códigos definitivos para todas las filas (las referencias pueden apuntar hacia adelante).
    const finalCodes = new Map<EntityType, Map<string, string>>();
    for (const row of rows) {
      row.finalCode = await this.codes.next(getDefinition(row.type)!, batch.project);
      const ref = row.data.code as string | null;
      if (ref) {
        const map = finalCodes.get(row.type) ?? new Map<string, string>();
        map.set(ref, row.finalCode);
        finalCodes.set(row.type, map);
      }
    }

    // 2. Inserción con las referencias traducidas.
    const result = { created: 0, failed: 0 };
    const userId = toObjectId(user.id);
    for (const row of rows) {
      const def = getDefinition(row.type)!;
      const { code: _ref, ...fields } = row.data;
      for (const field of def.fields.filter((f) => f.type === 'refList' || f.type === 'ref')) {
        const t = field.refType!;
        const resolve = (c: string) => finalCodes.get(t)?.get(c) ?? (existing.get(t)!.has(c) ? c : null);
        if (field.type === 'refList') {
          fields[field.key] = [...new Set(((fields[field.key] as string[]) ?? []).map(resolve).filter((c): c is string => !!c))];
        } else {
          fields[field.key] = fields[field.key] ? resolve(fields[field.key] as string) : null;
        }
      }
      try {
        await this.knowledge.model(def).create({
          ...fields,
          code: row.finalCode,
          project: batch.project,
          module: row.module,
          origin: { type: 'MASIVO', fileName: row.source?.fileName, batchId: batch._id },
          createdBy: userId,
          updatedBy: userId,
        });
        row.result = 'created';
      } catch (e) {
        row.result = 'failed';
        row.resultMessage =
          (e as { code?: number }).code === 11000
            ? `El código ${row.finalCode} ya estaba ocupado en el proyecto.`
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
