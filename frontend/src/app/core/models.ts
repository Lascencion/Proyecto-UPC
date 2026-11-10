export type Role = 'ANALISTA_QA' | 'LIDER_QA' | 'ADMIN';
export type AppModuleKey = 'KNOWLEDGE' | 'CATALOGS' | 'GENERATION' | 'ADMIN';
export type ActionKey = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE' | 'BULK_UPLOAD';
export type PermissionMap = Partial<Record<AppModuleKey, ActionKey[]>>;

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  roleLabel: string;
  active: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface Session {
  user: User;
  permissions: PermissionMap;
}

export type EntityType = 'requirements' | 'user-stories' | 'business-rules' | 'test-cases' | 'defects';
export type FieldType = 'code' | 'string' | 'text' | 'enum' | 'date' | 'list' | 'ref' | 'refList' | 'steps';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  refType?: EntityType;
  help?: string;
  listColumn?: boolean;
}

export interface EntityDefinition {
  type: EntityType;
  label: string;
  labelPlural: string;
  codePrefix: string;
  titleField: string;
  sheetName: string;
  fields: FieldDefinition[];
}

export interface NamedRef {
  id: string;
  name?: string;
}

export interface TestStep {
  number: number;
  action: string;
  expectedResult: string;
}

export interface KnowledgeRecord {
  id: string;
  project: NamedRef;
  module: NamedRef;
  origin: { type: 'MANUAL' | 'MASIVO'; fileName?: string; batchId?: string };
  createdBy?: NamedRef;
  updatedBy?: NamedRef;
  createdAt: string;
  updatedAt: string;
  [field: string]: unknown;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FieldIssue {
  field?: string;
  message: string;
  level?: 'error' | 'warning';
  fileName?: string;
}

export interface SaveResult {
  record: KnowledgeRecord;
  warnings: FieldIssue[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface FlowModule extends Project {
  project: string;
}

export interface RecordOption {
  code: string;
  title: string;
}

export type RefOptions = Partial<Record<EntityType, RecordOption[]>>;

export type BatchStatus = 'EN_REVISION' | 'CONFIRMADO' | 'CANCELADO';
export type RowStatus = 'valid' | 'warning' | 'error' | 'excluded';

export interface ImportBatch {
  id: string;
  project: NamedRef;
  defaultModule?: NamedRef;
  files: { name: string; size: number }[];
  status: BatchStatus;
  issues: FieldIssue[];
  summary: Record<string, number>;
  result?: { created: number; failed: number };
  createdBy: NamedRef;
  confirmedBy?: NamedRef;
  confirmedAt?: string;
  createdAt: string;
}

export interface ImportRow {
  id: string;
  index: number;
  type: EntityType;
  source: { fileName: string; location: string };
  data: Record<string, unknown>;
  moduleName?: string;
  module: string | null;
  status: RowStatus;
  fieldErrors: FieldIssue[];
  fieldWarnings: FieldIssue[];
  excluded: boolean;
  /** Código definitivo asignado al confirmar el lote. */
  finalCode?: string;
  result?: 'created' | 'failed';
  resultMessage?: string;
}

export interface ImportDetail {
  batch: ImportBatch;
  rows: ImportRow[];
}

export interface ModuleDescriptor {
  module: AppModuleKey;
  label: string;
  description: string;
  actions: ActionKey[];
  available: boolean;
}

export interface PermissionMatrix {
  roles: { role: Role; label: string }[];
  modules: ModuleDescriptor[];
  actions: { action: ActionKey; label: string }[];
  permissions: Record<Role, PermissionMap>;
}

// ----- Generación de casos de prueba -----

export const SCENARIO_TYPES = ['Positivo', 'Negativo', 'Alternativo', 'Excepción'];
export const TECHNIQUES = [
  'Partición de equivalencia',
  'Análisis de valores límite',
  'Tabla de decisión',
  'Transición de estados',
  'Casos de uso',
  'Conjetura de errores',
];

export type GenerationStatus = 'GENERANDO' | 'GENERADO' | 'ERROR';
export type GenerationStep = 'contexto' | 'instruccion' | 'respuesta' | 'completado';

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

export interface GenerationRequest {
  id: string;
  code: string;
  project: NamedRef;
  module: NamedRef;
  requirement: RequirementInput & { source: 'registrado' | 'historia' | 'nuevo' };
  context: (Omit<ContextCandidate, 'selected'> & { content: string })[];
  params: { scenarioTypes: string[]; techniques: string[]; maxCases: number; instructions: string };
  status: GenerationStatus;
  step: GenerationStep;
  version: number;
  provider?: string;
  model?: string;
  durationMs?: number;
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
  observations: string;
  missingScenarioTypes: string[];
  caseCount: number;
  error?: string;
  createdBy: NamedRef;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedCase {
  id: string;
  number: number;
  title: string;
  objective: string;
  scenarioType: string;
  technique: string;
  priority: string;
  preconditions: string;
  testData: string;
  steps: TestStep[];
  expectedResult: string;
  sources: string[];
  status: string;
}

export interface GenerationDetail {
  request: GenerationRequest;
  cases: GeneratedCase[];
}
