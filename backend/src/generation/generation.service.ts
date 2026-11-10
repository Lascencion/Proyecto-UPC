import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { toObjectId } from '../common/utils/object-id';
import { escapeRegex } from '../common/utils/text';
import { CodeGeneratorService, CodeSequence } from '../knowledge/code-generator.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ContextService, RequirementInput } from './context.service';
import { ContextQueryDto, CreateGenerationDto } from './dto/generation.dto';
import { GeneratedCaseDoc, GenerationRequest, GenerationRequestDocument, GenerationStep } from './generation.schemas';
import { GenerationError, GenerationInput, LLM_PROVIDER, LlmProvider } from './llm/types';

const SEQUENCE: CodeSequence = { prefix: 'GEN', collection: 'generation_requests', name: 'generation' };

@Injectable()
export class GenerationService implements OnModuleInit {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    @InjectModel(GenerationRequest.name) private readonly requests: Model<GenerationRequest>,
    @InjectModel(GeneratedCaseDoc.name) private readonly cases: Model<GeneratedCaseDoc>,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly context: ContextService,
    private readonly knowledge: KnowledgeService,
    private readonly codes: CodeGeneratorService,
  ) {}

  /** Las generaciones que quedaron en curso al reiniciar el servidor no continuarán. */
  async onModuleInit(): Promise<void> {
    await this.requests.updateMany(
      { status: 'GENERANDO' },
      { status: 'ERROR', error: 'La generación se interrumpió por un reinicio del servidor. Vuelva a intentarla.' },
    );
  }

  config() {
    return { provider: this.llm.name, simulated: this.llm.name === 'simulado' };
  }

  private async requirementOf(projectId: Types.ObjectId, dto: ContextQueryDto): Promise<RequirementInput> {
    if (dto.userStoryCode) return this.context.userStoryByCode(projectId, dto.userStoryCode);
    if (dto.requirementCode) return this.context.requirementByCode(projectId, dto.requirementCode);
    const r = dto.requirement;
    if (!r?.title?.trim() || !r.description?.trim()) {
      throw new BadRequestException({
        message: 'Hay campos con errores.',
        errors: [{ field: 'requirement', message: 'Ingrese el título y la descripción del requerimiento.' }],
      });
    }
    return {
      title: r.title.trim(),
      description: r.description.trim(),
      acceptanceCriteria: (r.acceptanceCriteria ?? []).map((c) => c.trim()).filter(Boolean),
    };
  }

  /** HU09: registros históricos sugeridos como contexto. */
  async suggestContext(dto: ContextQueryDto) {
    const projectId = toObjectId(dto.project, 'proyecto');
    const requirement = await this.requirementOf(projectId, dto);
    const moduleId = dto.module ? toObjectId(dto.module, 'módulo') : null;
    return { requirement, candidates: await this.context.candidates(projectId, moduleId, requirement) };
  }

  searchRecords(project: string, q: string) {
    if (!q?.trim()) return [];
    return this.context.search(toObjectId(project, 'proyecto'), q);
  }

  /** HU10: registra la solicitud y genera los casos en segundo plano. */
  async create(dto: CreateGenerationDto, user: AuthUser) {
    const scope = await this.knowledge.resolveScope(dto.project, dto.module);
    const requirement = await this.requirementOf(scope.project, dto);
    const contextItems = await this.context.resolve(scope.project, dto.context);
    const suggested = await this.context.candidates(scope.project, scope.module, requirement);
    const byCode = new Map(suggested.map((c) => [`${c.type}:${c.code}`, c]));

    const request = await this.requests.create({
      code: await this.codes.next(SEQUENCE, scope.project),
      project: scope.project,
      module: scope.module,
      requirement: { source: dto.userStoryCode ? 'historia' : requirement.code ? 'registrado' : 'nuevo', ...requirement },
      context: contextItems.map((c) => {
        const s = byCode.get(`${c.type}:${c.code}`);
        return { ...c, score: s?.score ?? null, relation: s?.relation ?? 'manual' };
      }),
      params: {
        scenarioTypes: dto.scenarioTypes,
        techniques: dto.techniques ?? [],
        maxCases: dto.maxCases,
        instructions: dto.instructions?.trim() ?? '',
      },
      createdBy: toObjectId(user.id),
    });

    const input: GenerationInput = {
      requirement,
      context: contextItems,
      scenarioTypes: dto.scenarioTypes,
      techniques: dto.techniques ?? [],
      maxCases: dto.maxCases,
      instructions: dto.instructions,
    };
    void this.run(request, input);
    return this.get(String(request._id));
  }

  private async setStep(request: GenerationRequestDocument, step: GenerationStep) {
    request.step = step;
    await request.save();
  }

  private async run(request: GenerationRequestDocument, input: GenerationInput): Promise<void> {
    const started = Date.now();
    try {
      await this.setStep(request, 'instruccion');
      await this.setStep(request, 'respuesta');
      const output = await this.llm.generate(input);
      await this.cases.insertMany(
        output.cases.map((c, i) => ({
          ...c,
          request: request._id,
          version: request.version,
          number: i + 1,
          steps: c.steps.map((s, j) => ({ number: j + 1, ...s })),
        })),
      );
      const covered = new Set(output.cases.map((c) => c.scenarioType));
      Object.assign(request, {
        status: 'GENERADO',
        step: 'completado',
        provider: output.provider,
        model: output.model,
        usage: output.usage,
        observations: output.observations,
        caseCount: output.cases.length,
        missingScenarioTypes: input.scenarioTypes.filter((t) => !covered.has(t)),
        durationMs: Date.now() - started,
      });
      await request.save();
    } catch (e) {
      const message = e instanceof GenerationError ? e.message : 'Error inesperado al generar los casos de prueba.';
      if (!(e instanceof GenerationError)) this.logger.error(e);
      Object.assign(request, { status: 'ERROR', error: message, durationMs: Date.now() - started, provider: this.llm.name });
      await request.save();
    }
  }

  async list(query: { project?: string; status?: string; search?: string; mine?: string }, user: AuthUser) {
    const filter: Record<string, unknown> = {};
    if (query.project) filter.project = toObjectId(query.project, 'proyecto');
    if (query.status) filter.status = query.status;
    if (query.mine === 'true') filter.createdBy = toObjectId(user.id);
    if (query.search?.trim()) {
      const rx = new RegExp(escapeRegex(query.search.trim()), 'i');
      filter.$or = [{ code: rx }, { 'requirement.code': rx }, { 'requirement.title': rx }];
    }
    const docs = await this.requests
      .find(filter, { context: 0 })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate([
        { path: 'project', select: 'name' },
        { path: 'module', select: 'name' },
        { path: 'createdBy', select: 'name' },
      ])
      .lean();
    return docs.map((d) => this.serialize(d));
  }

  async get(id: string) {
    const doc = await this.requests
      .findById(toObjectId(id, 'solicitud'))
      .populate([
        { path: 'project', select: 'name' },
        { path: 'module', select: 'name' },
        { path: 'createdBy', select: 'name' },
      ])
      .lean();
    if (!doc) throw new NotFoundException('Solicitud de generación no encontrada.');
    const cases = await this.cases.find({ request: doc._id, version: doc.version }).sort({ number: 1 }).lean();
    return {
      request: this.serialize(doc),
      cases: cases.map(({ _id, __v, request, ...c }) => ({ id: String(_id), ...c })),
    };
  }

  private serialize(doc: Record<string, any>) {
    const ref = (v: any) => (v && v._id ? { id: String(v._id), name: v.name } : null);
    const { _id, __v, project, module, createdBy, ...rest } = doc;
    return { id: String(_id), ...rest, project: ref(project), module: ref(module), createdBy: ref(createdBy) };
  }
}
