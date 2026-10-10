/**
 * Definición única de los tipos de información histórica. A partir de ella se
 * construyen los esquemas de MongoDB, la validación (formulario y carga masiva),
 * las plantillas descargables y los formularios dinámicos del frontend.
 */

export type EntityType = 'requirements' | 'business-rules' | 'test-cases' | 'defects';

export type FieldType =
  | 'code' // código único dentro del proyecto (p. ej. REQ-001)
  | 'string' // texto corto
  | 'text' // texto largo
  | 'enum' // valor de una lista cerrada
  | 'date' // fecha
  | 'list' // lista de textos (separados por ";" o salto de línea en los archivos)
  | 'ref' // código de otro registro
  | 'refList' // lista de códigos de otros registros
  | 'steps'; // pasos de un caso de prueba

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  refType?: EntityType;
  help?: string;
  /** Encabezados alternativos aceptados en los archivos. */
  aliases?: string[];
  /** Mostrar como columna en los listados. */
  listColumn?: boolean;
}

export interface EntityDefinition {
  type: EntityType;
  label: string;
  labelPlural: string;
  codePrefix: string;
  /** Campo que actúa como título del registro. */
  titleField: string;
  collection: string;
  modelName: string;
  /** Nombre de la hoja Excel / archivo CSV de la plantilla. */
  sheetName: string;
  /** Texto de la fila "Tipo" en las tablas de Word. */
  wordTypeLabel: string;
  fields: FieldDefinition[];
}

export const PRIORITY = ['Alta', 'Media', 'Baja'];

export const REQUIREMENT_DEFINITION: EntityDefinition = {
  type: 'requirements',
  label: 'Requerimiento',
  labelPlural: 'Requerimientos',
  codePrefix: 'REQ',
  titleField: 'title',
  collection: 'requirements',
  modelName: 'Requirement',
  sheetName: 'Requerimientos',
  wordTypeLabel: 'Requerimiento',
  fields: [
    { key: 'code', label: 'Código', type: 'code', required: true, help: 'Ej.: REQ-001', listColumn: true },
    { key: 'title', label: 'Título', type: 'string', required: true, listColumn: true },
    { key: 'description', label: 'Descripción', type: 'text', required: true, help: 'Qué debe hacer el sistema. Puede usar el formato "Como… quiero… para…".' },
    { key: 'type', label: 'Tipo', type: 'enum', options: ['Funcional', 'No funcional'], listColumn: true },
    { key: 'priority', label: 'Prioridad', type: 'enum', options: PRIORITY, listColumn: true },
    { key: 'acceptanceCriteria', label: 'Criterios de aceptación', type: 'list', help: 'Uno por línea (en archivos, separados por ";").', aliases: ['Criterios'] },
    { key: 'version', label: 'Versión', type: 'string' },
    { key: 'date', label: 'Fecha', type: 'date' },
    { key: 'source', label: 'Fuente', type: 'string', help: 'Documento, historia de usuario o ticket de origen.' },
  ],
};

export const BUSINESS_RULE_DEFINITION: EntityDefinition = {
  type: 'business-rules',
  label: 'Regla de negocio',
  labelPlural: 'Reglas de negocio',
  codePrefix: 'RN',
  titleField: 'name',
  collection: 'business_rules',
  modelName: 'BusinessRule',
  sheetName: 'ReglasNegocio',
  wordTypeLabel: 'Regla de negocio',
  fields: [
    { key: 'code', label: 'Código', type: 'code', required: true, help: 'Ej.: RN-001', listColumn: true },
    { key: 'name', label: 'Nombre', type: 'string', required: true, listColumn: true },
    { key: 'description', label: 'Descripción', type: 'text', required: true },
    {
      key: 'type',
      label: 'Tipo',
      type: 'enum',
      options: ['Validación', 'Cálculo', 'Restricción', 'Flujo', 'Autorización'],
      listColumn: true,
    },
    { key: 'condition', label: 'Condición', type: 'text', help: 'Cuándo aplica la regla ("Si…").' },
    { key: 'action', label: 'Acción / Resultado', type: 'text', help: 'Qué debe ocurrir ("Entonces…").', aliases: ['Acción', 'Resultado'] },
    { key: 'exceptions', label: 'Excepciones', type: 'text' },
    { key: 'criticality', label: 'Criticidad', type: 'enum', options: PRIORITY, listColumn: true },
    {
      key: 'relatedRequirements',
      label: 'Requerimientos relacionados',
      type: 'refList',
      refType: 'requirements',
      help: 'Códigos separados por ";". Ej.: REQ-001;REQ-002',
      listColumn: true,
    },
  ],
};

export const TEST_CASE_DEFINITION: EntityDefinition = {
  type: 'test-cases',
  label: 'Caso de prueba',
  labelPlural: 'Casos de prueba',
  codePrefix: 'CP',
  titleField: 'title',
  collection: 'test_cases',
  modelName: 'TestCase',
  sheetName: 'CasosPrueba',
  wordTypeLabel: 'Caso de prueba',
  fields: [
    { key: 'code', label: 'Código', type: 'code', required: true, help: 'Ej.: CP-001', listColumn: true },
    { key: 'title', label: 'Título', type: 'string', required: true, listColumn: true },
    {
      key: 'requirement',
      label: 'Requerimiento',
      type: 'ref',
      refType: 'requirements',
      required: true,
      help: 'Código del requerimiento que valida. Ej.: REQ-001',
      aliases: ['Requerimiento relacionado'],
      listColumn: true,
    },
    {
      key: 'relatedRules',
      label: 'Reglas de negocio',
      type: 'refList',
      refType: 'business-rules',
      help: 'Códigos separados por ";". Ej.: RN-001;RN-003',
      aliases: ['Reglas relacionadas'],
    },
    {
      key: 'scenarioType',
      label: 'Tipo de escenario',
      type: 'enum',
      options: ['Positivo', 'Negativo', 'Valor límite', 'Excepción'],
      required: true,
      listColumn: true,
    },
    {
      key: 'designTechnique',
      label: 'Técnica de diseño',
      type: 'enum',
      options: [
        'Partición de equivalencia',
        'Análisis de valores límite',
        'Tabla de decisión',
        'Transición de estados',
        'Casos de uso',
        'Conjetura de errores',
        'Otra',
      ],
    },
    { key: 'priority', label: 'Prioridad', type: 'enum', options: PRIORITY },
    { key: 'preconditions', label: 'Precondiciones', type: 'text' },
    { key: 'testData', label: 'Datos de prueba', type: 'text' },
    { key: 'steps', label: 'Pasos', type: 'steps', required: true },
    { key: 'expectedResult', label: 'Resultado esperado', type: 'text', required: true },
    { key: 'actualResult', label: 'Resultado obtenido', type: 'text' },
    {
      key: 'executionStatus',
      label: 'Estado de ejecución',
      type: 'enum',
      options: ['Exitoso', 'Fallido', 'Bloqueado', 'No ejecutado'],
      required: true,
      aliases: ['Estado'],
      listColumn: true,
    },
    { key: 'executionDate', label: 'Fecha de ejecución', type: 'date' },
    { key: 'executedBy', label: 'Ejecutado por', type: 'string' },
    {
      key: 'defect',
      label: 'Defecto asociado',
      type: 'ref',
      refType: 'defects',
      help: 'Código del defecto, si la ejecución falló. Ej.: DEF-001',
      aliases: ['Defecto'],
    },
  ],
};

export const DEFECT_DEFINITION: EntityDefinition = {
  type: 'defects',
  label: 'Defecto',
  labelPlural: 'Defectos',
  codePrefix: 'DEF',
  titleField: 'title',
  collection: 'defects',
  modelName: 'Defect',
  sheetName: 'Defectos',
  wordTypeLabel: 'Defecto',
  fields: [
    { key: 'code', label: 'Código', type: 'code', required: true, help: 'Ej.: DEF-001', listColumn: true },
    { key: 'title', label: 'Título', type: 'string', required: true, listColumn: true },
    { key: 'description', label: 'Descripción', type: 'text', required: true },
    { key: 'stepsToReproduce', label: 'Pasos para reproducir', type: 'text' },
    { key: 'severity', label: 'Severidad', type: 'enum', options: ['Crítica', 'Alta', 'Media', 'Baja'], required: true, listColumn: true },
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      options: ['Abierto', 'En progreso', 'Resuelto', 'Cerrado', 'Rechazado'],
      required: true,
      listColumn: true,
    },
    { key: 'testCase', label: 'Caso de prueba', type: 'ref', refType: 'test-cases', help: 'Ej.: CP-002', listColumn: true },
    { key: 'requirement', label: 'Requerimiento', type: 'ref', refType: 'requirements', help: 'Ej.: REQ-002' },
    { key: 'reportedDate', label: 'Fecha de reporte', type: 'date' },
    { key: 'reportedBy', label: 'Reportado por', type: 'string' },
  ],
};

export const ENTITY_DEFINITIONS: EntityDefinition[] = [
  REQUIREMENT_DEFINITION,
  BUSINESS_RULE_DEFINITION,
  TEST_CASE_DEFINITION,
  DEFECT_DEFINITION,
];

export const ENTITY_TYPES = ENTITY_DEFINITIONS.map((d) => d.type);

export function getDefinition(type: string): EntityDefinition | undefined {
  return ENTITY_DEFINITIONS.find((d) => d.type === type);
}

/** Columna "Módulo" común a todas las hojas/tablas de carga masiva. */
export const MODULE_COLUMN = { key: 'module', label: 'Módulo', aliases: ['Módulo / Flujo', 'Flujo'] };

/** Columnas de la hoja de pasos de casos de prueba. */
export const STEP_COLUMNS = {
  sheetName: 'PasosCasoPrueba',
  testCaseCode: { key: 'testCaseCode', label: 'Código caso', aliases: ['Caso de prueba', 'Código del caso', 'Código'] },
  number: { key: 'number', label: 'N° paso', aliases: ['N°', 'Nro', 'Número', 'Paso', 'Nro paso'] },
  action: { key: 'action', label: 'Acción', aliases: ['Descripción'] },
  expectedResult: { key: 'expectedResult', label: 'Resultado esperado', aliases: ['Resultado'] },
};
