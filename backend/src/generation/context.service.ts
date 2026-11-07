import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { escapeRegex } from '../common/utils/text';
import { ENTITY_DEFINITIONS, EntityType, getDefinition } from '../knowledge/definitions/entity-definitions';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ContextItem } from './llm/types';
import { similarityScores } from './similarity';

export const MAX_CONTEXT = 15;
const SUGGESTED = 8;
const MIN_SCORE = 0.05;
const MIN_SELECTED_SCORE = 0.15;

type Rec = Record<string, any> & { code: string; module?: Types.ObjectId };

export interface RequirementInput {
  code?: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
}

export interface ContextCandidate {
  type: EntityType;
  code: string;
  title: string;
  score: number | null;
  relation: 'directa' | 'similitud' | 'manual';
  selected: boolean;
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/** Texto de un registro, usado para calcular la similitud y como contexto del LLM. */
export function recordContent(type: EntityType, r: Rec): string {
  const lines: string[] = [];
  const add = (label: string, value: unknown) => {
    const v = Array.isArray(value) ? value.join('; ') : value;
    if (v !== null && v !== undefined && String(v).trim()) lines.push(`${label}: ${String(v).trim()}`);
  };
  switch (type) {
    case 'requirements':
      add('Título', r.title); add('Descripción', r.description); add('Criterios de aceptación', r.acceptanceCriteria);
      break;
    case 'business-rules':
      add('Nombre', r.name); add('Descripción', r.description); add('Tipo', r.type); add('Condición', r.condition);
      add('Acción', r.action); add('Excepciones', r.exceptions);
      break;
    case 'test-cases':
      add('Título', r.title); add('Tipo de escenario', r.scenarioType); add('Precondiciones', r.preconditions);
      add('Datos de prueba', r.testData);
      add('Pasos', (r.steps ?? []).map((s: { number: number; action: string; expectedResult: string }) => `${s.number}) ${s.action} → ${s.expectedResult}`));
      add('Resultado esperado', r.expectedResult); add('Estado de ejecución', r.executionStatus);
      break;
    case 'defects':
      add('Título', r.title); add('Descripción', r.description); add('Pasos para reproducir', r.stepsToReproduce);
      add('Severidad', r.severity);
      break;
  }
  return lines.join('\n');
}

const titleOf = (type: EntityType, r: Rec) => String(r[getDefinition(type)!.titleField] ?? '');

/**
 * Recupera la información histórica relacionada con un requerimiento (HU09):
 * primero los registros vinculados directamente y luego los más parecidos por texto.
 */
@Injectable()
export class ContextService {
  constructor(private readonly knowledge: KnowledgeService) {}

  private async records(projectId: Types.ObjectId): Promise<Map<EntityType, Rec[]>> {
    const result = new Map<EntityType, Rec[]>();
    for (const def of ENTITY_DEFINITIONS) {
      result.set(def.type, (await this.knowledge.model(def).find({ project: projectId }).lean()) as unknown as Rec[]);
    }
    return result;
  }

  async requirementByCode(projectId: Types.ObjectId, code: string): Promise<RequirementInput> {
    const def = getDefinition('requirements')!;
    const r = (await this.knowledge.model(def).findOne({ project: projectId, code: code.toUpperCase() }).lean()) as Rec | null;
    if (!r) throw new NotFoundException(`El requerimiento ${code} no existe en el proyecto.`);
    return { code: r.code, title: r.title, description: r.description ?? '', acceptanceCriteria: list(r.acceptanceCriteria) };
  }

  async candidates(projectId: Types.ObjectId, moduleId: Types.ObjectId | null, requirement: RequirementInput): Promise<ContextCandidate[]> {
    const all = await this.records(projectId);
    const code = requirement.code;
    const relatedCases = new Set(
      code ? all.get('test-cases')!.filter((c) => list(c.requirements).includes(code)).map((c) => c.code) : [],
    );
    const isDirect = (type: EntityType, r: Rec): boolean => {
      if (!code) return false;
      if (type === 'business-rules') return list(r.relatedRequirements).includes(code);
      if (type === 'test-cases') return relatedCases.has(r.code);
      if (type === 'defects') return list(r.requirements).includes(code) || list(r.testCases).some((c) => relatedCases.has(c));
      return false;
    };

    const items: { type: EntityType; r: Rec; text: string }[] = [];
    for (const [type, recs] of all) {
      for (const r of recs) {
        if (type === 'requirements' && r.code === code) continue;
        items.push({ type, r, text: recordContent(type, r) });
      }
    }
    const query = [requirement.title, requirement.description, ...requirement.acceptanceCriteria].join('\n');
    const scores = similarityScores(query, items.map((i) => i.text));
    const ranked = items
      .map((item, i) => {
        const direct = isDirect(item.type, item.r);
        const sameModule = moduleId && String(item.r.module) === String(moduleId);
        const score = direct ? 1 : Math.min(0.99, scores[i] + (sameModule && scores[i] > 0 ? 0.05 : 0));
        return { ...item, direct, score };
      })
      .filter((i) => i.direct || i.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CONTEXT);

    let selected = 0;
    return ranked.map((i) => {
      const select = selected < SUGGESTED && (i.direct || i.score >= MIN_SELECTED_SCORE);
      if (select) selected += 1;
      return {
        type: i.type,
        code: i.r.code,
        title: titleOf(i.type, i.r),
        score: Math.round(i.score * 100),
        relation: i.direct ? 'directa' : 'similitud',
        selected: select,
      };
    });
  }

  /** Búsqueda por código o título para agregar registros manualmente al contexto. */
  async search(projectId: Types.ObjectId, q: string): Promise<ContextCandidate[]> {
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    const out: ContextCandidate[] = [];
    for (const def of ENTITY_DEFINITIONS) {
      const docs = (await this.knowledge
        .model(def)
        .find({ project: projectId, $or: [{ code: rx }, { [def.titleField]: rx }] }, { code: 1, [def.titleField]: 1 })
        .sort({ code: 1 })
        .limit(10)
        .lean()) as unknown as Rec[];
      out.push(...docs.map((r) => ({ type: def.type, code: r.code, title: titleOf(def.type, r), score: null, relation: 'manual' as const, selected: true })));
    }
    return out.slice(0, 20);
  }

  /** Carga los registros elegidos y arma el contexto que se envía al LLM. */
  async resolve(projectId: Types.ObjectId, refs: { type: string; code: string }[]): Promise<ContextItem[]> {
    if (refs.length > MAX_CONTEXT) {
      throw new BadRequestException(`El contexto admite como máximo ${MAX_CONTEXT} registros.`);
    }
    const items: ContextItem[] = [];
    for (const ref of refs) {
      const def = getDefinition(ref.type);
      if (!def) throw new BadRequestException(`Tipo de registro no válido: ${ref.type}.`);
      const r = (await this.knowledge.model(def).findOne({ project: projectId, code: ref.code }).lean()) as Rec | null;
      if (!r) throw new BadRequestException(`El registro ${ref.code} no existe en el proyecto.`);
      items.push({ type: def.type, code: r.code, title: titleOf(def.type, r), content: recordContent(def.type, r) });
    }
    return items;
  }
}
