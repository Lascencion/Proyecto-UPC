import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { ENTITY_DEFINITIONS } from '../knowledge/definitions/entity-definitions';
import { toObjectId } from '../common/utils/object-id';
import { CreateFlowModuleDto, CreateProjectDto, UpdateFlowModuleDto, UpdateProjectDto } from './dto/catalog.dto';
import { FlowModule, Project } from './catalog.schemas';

const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;

@Injectable()
export class CatalogsService {
  constructor(
    @InjectModel(Project.name) private readonly projects: Model<Project>,
    @InjectModel(FlowModule.name) private readonly modules: Model<FlowModule>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private serialize(doc: Record<string, any>): { id: string; name: string; project?: string; [k: string]: unknown } {
    const { _id, __v, project, ...rest } = doc;
    return { id: String(_id), name: doc.name, ...rest, ...(project !== undefined ? { project: String(project) } : {}) };
  }

  /** Cuenta los registros de la base de conocimiento que usan el proyecto/módulo. */
  private async usageCount(filter: Record<string, Types.ObjectId>): Promise<number> {
    let total = 0;
    for (const def of ENTITY_DEFINITIONS) {
      total += await this.connection.collection(def.collection).countDocuments(filter);
    }
    return total;
  }

  // ----- Proyectos -----
  async listProjects(includeInactive = true) {
    const docs = await this.projects
      .find(includeInactive ? {} : { active: true })
      .collation({ locale: 'es' })
      .sort({ name: 1 })
      .lean();
    return docs.map((d) => this.serialize(d));
  }

  async getProject(id: string) {
    const doc = await this.projects.findById(toObjectId(id, 'proyecto')).lean();
    if (!doc) throw new NotFoundException('Proyecto no encontrado.');
    return doc;
  }

  async createProject(dto: CreateProjectDto) {
    try {
      const doc = await this.projects.create(dto);
      return this.serialize(doc.toObject());
    } catch (e) {
      if (isDuplicateKey(e)) throw new ConflictException('Ya existe un proyecto con ese nombre.');
      throw e;
    }
  }

  async updateProject(id: string, dto: UpdateProjectDto) {
    try {
      const doc = await this.projects.findByIdAndUpdate(toObjectId(id, 'proyecto'), dto, { new: true }).lean();
      if (!doc) throw new NotFoundException('Proyecto no encontrado.');
      return this.serialize(doc);
    } catch (e) {
      if (isDuplicateKey(e)) throw new ConflictException('Ya existe un proyecto con ese nombre.');
      throw e;
    }
  }

  async deleteProject(id: string) {
    const _id = toObjectId(id, 'proyecto');
    if ((await this.usageCount({ project: _id })) > 0) {
      throw new BadRequestException('El proyecto tiene información registrada; desactívelo en lugar de eliminarlo.');
    }
    await this.modules.deleteMany({ project: _id });
    await this.projects.deleteOne({ _id });
    return { ok: true };
  }

  // ----- Módulos / flujos -----
  async listModules(projectId?: string, includeInactive = true) {
    const filter: Record<string, unknown> = {};
    if (projectId) filter.project = toObjectId(projectId, 'proyecto');
    if (!includeInactive) filter.active = true;
    const docs = await this.modules.find(filter).collation({ locale: 'es' }).sort({ name: 1 }).lean();
    return docs.map((d) => this.serialize(d));
  }

  async getModule(id: string) {
    const doc = await this.modules.findById(toObjectId(id, 'módulo')).lean();
    if (!doc) throw new NotFoundException('Módulo no encontrado.');
    return doc;
  }

  /** Busca un módulo por nombre dentro de un proyecto, sin distinguir mayúsculas ni tildes. */
  findModuleByName(projectId: Types.ObjectId, name: string) {
    return this.modules
      .findOne({ project: projectId, name: name.trim() })
      .collation({ locale: 'es', strength: 1 })
      .lean();
  }

  async createModule(dto: CreateFlowModuleDto) {
    await this.getProject(dto.project);
    try {
      const doc = await this.modules.create({ ...dto, project: toObjectId(dto.project) });
      return this.serialize(doc.toObject());
    } catch (e) {
      if (isDuplicateKey(e)) throw new ConflictException('Ya existe un módulo con ese nombre en el proyecto.');
      throw e;
    }
  }

  async updateModule(id: string, dto: UpdateFlowModuleDto) {
    try {
      const doc = await this.modules.findByIdAndUpdate(toObjectId(id, 'módulo'), dto, { new: true }).lean();
      if (!doc) throw new NotFoundException('Módulo no encontrado.');
      return this.serialize(doc);
    } catch (e) {
      if (isDuplicateKey(e)) throw new ConflictException('Ya existe un módulo con ese nombre en el proyecto.');
      throw e;
    }
  }

  async deleteModule(id: string) {
    const _id = toObjectId(id, 'módulo');
    if ((await this.usageCount({ module: _id })) > 0) {
      throw new BadRequestException('El módulo tiene información registrada; desactívelo en lugar de eliminarlo.');
    }
    await this.modules.deleteOne({ _id });
    return { ok: true };
  }
}
