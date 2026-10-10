import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { CatalogsService } from '../catalogs/catalogs.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { toObjectId } from '../common/utils/object-id';
import { escapeRegex } from '../common/utils/text';
import { ENTITY_DEFINITIONS, EntityDefinition, EntityType, getDefinition } from './definitions/entity-definitions';
import { OriginType } from './knowledge.schemas';
import { collectReferences, FieldIssue, validateRecord } from './validation/record-validator';

export interface ListQuery {
  project?: string;
  module?: string;
  search?: string;
  origin?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export interface RecordOrigin {
  type: OriginType;
  fileName?: string;
  batchId?: Types.ObjectId;
}

const POPULATE = [
  { path: 'project', select: 'name' },
  { path: 'module', select: 'name' },
  { path: 'createdBy', select: 'name' },
  { path: 'updatedBy', select: 'name' },
];

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly catalogs: CatalogsService,
  ) {}

  definition(type: string): EntityDefinition {
    const def = getDefinition(type);
    if (!def) throw new NotFoundException(`Tipo de información "${type}" no existe.`);
    return def;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model(def: EntityDefinition): Model<any> {
    return this.connection.model(def.modelName);
  }

  /** Convierte un documento poblado a la forma que consume el frontend. */
  serialize(doc: Record<string, any>) {
    const ref = (v: any) => (v && typeof v === 'object' && v._id ? { id: String(v._id), name: v.name } : v ? { id: String(v) } : null);
    const { _id, __v, project, module, createdBy, updatedBy, origin, ...rest } = doc;
    return {
      id: String(_id),
      ...rest,
      project: ref(project),
      module: ref(module),
      createdBy: ref(createdBy),
      updatedBy: ref(updatedBy),
      origin: origin ? { ...origin, batchId: origin.batchId ? String(origin.batchId) : undefined } : null,
    };
  }

  async list(type: string, q: ListQuery) {
    const def = this.definition(type);
    const filter: Record<string, unknown> = {};
    if (q.project) filter.project = toObjectId(q.project, 'proyecto');
    if (q.module) filter.module = toObjectId(q.module, 'módulo');
    if (q.origin) filter['origin.type'] = q.origin;
    if (q.search?.trim()) {
      const rx = new RegExp(escapeRegex(q.search.trim()), 'i');
      const textFields = def.fields.filter((f) => ['code', 'string', 'text'].includes(f.type)).map((f) => f.key);
      filter.$or = textFields.map((key) => ({ [key]: rx }));
    }
    const pageSize = Math.min(Math.max(Number(q.pageSize) || 20, 1), 200);
    const page = Math.max(Number(q.page) || 0, 0);
    const sortField = q.sort && (def.fields.some((f) => f.key === q.sort) || ['createdAt', 'updatedAt'].includes(q.sort)) ? q.sort : 'code';
    const model = this.model(def);
    const [items, total] = await Promise.all([
      model
        .find(filter)
        .sort({ [sortField]: q.direction === 'desc' ? -1 : 1, _id: 1 })
        .skip(page * pageSize)
        .limit(pageSize)
        .populate(POPULATE)
        .lean(),
      model.countDocuments(filter),
    ]);
    return { items: items.map((i) => this.serialize(i)), total, page, pageSize };
  }

  async get(type: string, id: string) {
    const def = this.definition(type);
    const doc = await this.model(def).findById(toObjectId(id)).populate(POPULATE).lean();
    if (!doc) throw new NotFoundException(`${def.label} no encontrado.`);
    return this.serialize(doc);
  }

  /** Verifica que el módulo exista y pertenezca al proyecto. */
  async resolveScope(projectId: unknown, moduleId: unknown) {
    const errors: FieldIssue[] = [];
    if (!projectId) errors.push({ field: 'project', message: 'Proyecto es obligatorio.' });
    if (!moduleId) errors.push({ field: 'module', message: 'Módulo es obligatorio.' });
    if (errors.length) throw new BadRequestException({ message: 'Hay campos con errores.', errors });
    const project = await this.catalogs.getProject(String(projectId));
    const module = await this.catalogs.getModule(String(moduleId));
    if (String(module.project) !== String(project._id)) {
      throw new BadRequestException({
        message: 'Hay campos con errores.',
        errors: [{ field: 'module', message: 'El módulo no pertenece al proyecto seleccionado.' }],
      });
    }
    return { project: project._id as Types.ObjectId, module: module._id as Types.ObjectId };
  }

  /** Códigos existentes por tipo dentro de un proyecto. */
  async existingCodes(projectId: Types.ObjectId, types: EntityType[] = ENTITY_DEFINITIONS.map((d) => d.type)) {
    const result = new Map<EntityType, Map<string, string>>();
    for (const type of types) {
      const def = this.definition(type);
      const docs = await this.model(def).find({ project: projectId }, { code: 1 }).lean();
      result.set(type, new Map(docs.map((d) => [d.code as string, String(d._id)])));
    }
    return result;
  }

  /** Advertencias por códigos referenciados que no existen en el proyecto. */
  async referenceWarnings(def: EntityDefinition, projectId: Types.ObjectId, value: Record<string, unknown>) {
    const refs = collectReferences(def, value);
    if (!refs.length) return [];
    const types = [...new Set(refs.map((r) => r.field.refType!))];
    const existing = await this.existingCodes(projectId, types);
    return refs
      .filter((r) => !existing.get(r.field.refType!)!.has(r.code))
      .map((r) => ({
        field: r.field.key,
        message: `${r.field.label}: el código ${r.code} no está registrado en el proyecto.`,
      }));
  }

  private conflict(def: EntityDefinition, code: unknown) {
    return new ConflictException({
      message: `Ya existe un ${def.label.toLowerCase()} con el código ${code} en el proyecto.`,
      errors: [{ field: 'code', message: 'El código ya existe en el proyecto.' }],
    });
  }

  async create(type: string, body: Record<string, unknown>, user: AuthUser, origin: RecordOrigin = { type: 'MANUAL' }) {
    const def = this.definition(type);
    const scope = await this.resolveScope(body.project, body.module);
    const { value, errors, warnings } = validateRecord(def, body);
    if (errors.length) throw new BadRequestException({ message: 'Hay campos con errores.', errors });
    try {
      const doc = await this.model(def).create({
        ...value,
        ...scope,
        origin,
        createdBy: toObjectId(user.id),
        updatedBy: toObjectId(user.id),
      });
      const record = await this.get(type, String(doc._id));
      return { record, warnings: [...warnings, ...(await this.referenceWarnings(def, scope.project, value))] };
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw this.conflict(def, value.code);
      throw e;
    }
  }

  async update(type: string, id: string, body: Record<string, unknown>, user: AuthUser) {
    const def = this.definition(type);
    const scope = await this.resolveScope(body.project, body.module);
    const { value, errors, warnings } = validateRecord(def, body);
    if (errors.length) throw new BadRequestException({ message: 'Hay campos con errores.', errors });
    try {
      const doc = await this.model(def).findByIdAndUpdate(
        toObjectId(id),
        { ...value, ...scope, updatedBy: toObjectId(user.id) },
        { new: true },
      );
      if (!doc) throw new NotFoundException(`${def.label} no encontrado.`);
      const record = await this.get(type, id);
      return { record, warnings: [...warnings, ...(await this.referenceWarnings(def, scope.project, value))] };
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw this.conflict(def, value.code);
      throw e;
    }
  }

  async remove(type: string, id: string) {
    const def = this.definition(type);
    const res = await this.model(def).deleteOne({ _id: toObjectId(id) });
    if (!res.deletedCount) throw new NotFoundException(`${def.label} no encontrado.`);
    return { ok: true };
  }

  async summary(projectId?: string) {
    const filter = projectId ? { project: toObjectId(projectId, 'proyecto') } : {};
    const counts = await Promise.all(
      ENTITY_DEFINITIONS.map(async (def) => ({
        type: def.type,
        label: def.labelPlural,
        total: await this.model(def).countDocuments(filter),
      })),
    );
    return counts;
  }
}
