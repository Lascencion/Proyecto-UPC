/** Roles del sistema. */
export enum Role {
  ANALISTA_QA = 'ANALISTA_QA',
  LIDER_QA = 'LIDER_QA',
  ADMIN = 'ADMIN',
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.ANALISTA_QA]: 'Analista QA',
  [Role.LIDER_QA]: 'Líder QA',
  [Role.ADMIN]: 'Administrador',
};

/** Módulos funcionales a los que se controla el acceso. */
export enum AppModule {
  KNOWLEDGE = 'KNOWLEDGE',
  CATALOGS = 'CATALOGS',
  GENERATION = 'GENERATION',
  ADMIN = 'ADMIN',
}

/** Acciones que se pueden otorgar sobre un módulo. */
export enum Action {
  VIEW = 'VIEW',
  CREATE = 'CREATE',
  EDIT = 'EDIT',
  DELETE = 'DELETE',
  BULK_UPLOAD = 'BULK_UPLOAD',
}

export interface ModuleDescriptor {
  module: AppModule;
  label: string;
  description: string;
  /** Acciones que tienen sentido para el módulo. */
  actions: Action[];
  /** Módulos aún no implementados: se muestran pero no se pueden usar. */
  available: boolean;
}

export const MODULES: ModuleDescriptor[] = [
  {
    module: AppModule.KNOWLEDGE,
    label: 'Base de conocimiento',
    description: 'Registro individual y masivo de requerimientos, reglas de negocio, casos de prueba y defectos históricos.',
    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.BULK_UPLOAD],
    available: true,
  },
  {
    module: AppModule.CATALOGS,
    label: 'Catálogos',
    description: 'Proyectos y módulos/flujos usados para clasificar la información.',
    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE],
    available: true,
  },
  {
    module: AppModule.GENERATION,
    label: 'Generación de casos de prueba',
    description: 'Generación de casos de prueba funcionales con LLM (próxima iteración).',
    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE],
    available: false,
  },
  {
    module: AppModule.ADMIN,
    label: 'Administración',
    description: 'Gestión de usuarios y permisos de acceso a los módulos.',
    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE],
    available: true,
  },
];

export const ACTION_LABELS: Record<Action, string> = {
  [Action.VIEW]: 'Ver',
  [Action.CREATE]: 'Crear',
  [Action.EDIT]: 'Editar',
  [Action.DELETE]: 'Eliminar',
  [Action.BULK_UPLOAD]: 'Carga masiva',
};

export type PermissionMap = Partial<Record<AppModule, Action[]>>;

const all = (m: AppModule) => MODULES.find((d) => d.module === m)!.actions;

/** Permisos iniciales por rol (configurables luego por el administrador). */
export const DEFAULT_PERMISSIONS: Record<Role, PermissionMap> = {
  [Role.ADMIN]: {
    [AppModule.KNOWLEDGE]: all(AppModule.KNOWLEDGE),
    [AppModule.CATALOGS]: all(AppModule.CATALOGS),
    [AppModule.GENERATION]: all(AppModule.GENERATION),
    [AppModule.ADMIN]: all(AppModule.ADMIN),
  },
  [Role.LIDER_QA]: {
    [AppModule.KNOWLEDGE]: all(AppModule.KNOWLEDGE),
    [AppModule.CATALOGS]: all(AppModule.CATALOGS),
    [AppModule.GENERATION]: all(AppModule.GENERATION),
    [AppModule.ADMIN]: [],
  },
  [Role.ANALISTA_QA]: {
    [AppModule.KNOWLEDGE]: [Action.VIEW, Action.CREATE, Action.EDIT, Action.BULK_UPLOAD],
    [AppModule.CATALOGS]: [Action.VIEW],
    [AppModule.GENERATION]: [Action.VIEW, Action.CREATE],
    [AppModule.ADMIN]: [],
  },
};
