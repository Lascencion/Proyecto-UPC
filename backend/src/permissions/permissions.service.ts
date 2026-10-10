import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Action,
  ACTION_LABELS,
  AppModule,
  DEFAULT_PERMISSIONS,
  MODULES,
  PermissionMap,
  Role,
  ROLE_LABELS,
} from '../common/access.constants';
import { RolePermission } from './role-permission.schema';

@Injectable()
export class PermissionsService implements OnModuleInit {
  /** Caché en memoria de la matriz rol -> módulo -> acciones. */
  private cache = new Map<Role, PermissionMap>();

  constructor(@InjectModel(RolePermission.name) private readonly model: Model<RolePermission>) {}

  async onModuleInit(): Promise<void> {
    for (const role of Object.values(Role)) {
      const exists = await this.model.exists({ role });
      if (!exists) {
        await this.model.create({ role, modules: this.toModules(DEFAULT_PERMISSIONS[role]) });
      }
    }
    await this.reload();
  }

  private toModules(map: PermissionMap) {
    return MODULES.map((m) => ({ module: m.module, actions: map[m.module] ?? [] }));
  }

  private async reload(): Promise<void> {
    const docs = await this.model.find().lean().exec();
    this.cache.clear();
    for (const doc of docs) {
      const map: PermissionMap = {};
      for (const m of doc.modules) map[m.module] = m.actions;
      this.cache.set(doc.role, map);
    }
  }

  forRole(role: Role): PermissionMap {
    return this.cache.get(role) ?? {};
  }

  can(role: Role, module: AppModule, action: Action): boolean {
    const descriptor = MODULES.find((m) => m.module === module);
    if (!descriptor?.available) return false;
    return (this.forRole(role)[module] ?? []).includes(action);
  }

  getMatrix() {
    return {
      roles: Object.values(Role).map((role) => ({ role, label: ROLE_LABELS[role] })),
      modules: MODULES,
      actions: Object.values(Action).map((action) => ({ action, label: ACTION_LABELS[action] })),
      permissions: Object.fromEntries(Object.values(Role).map((role) => [role, this.forRole(role)])),
    };
  }

  async updateRole(role: Role, permissions: PermissionMap) {
    if (!Object.values(Role).includes(role)) throw new BadRequestException('Rol no válido.');
    const clean: PermissionMap = {};
    for (const descriptor of MODULES) {
      const requested = permissions[descriptor.module] ?? [];
      if (!Array.isArray(requested)) throw new BadRequestException(`Acciones no válidas para ${descriptor.label}.`);
      clean[descriptor.module] = descriptor.actions.filter((a) => requested.includes(a));
    }
    // Evita que el sistema quede sin nadie capaz de administrar accesos.
    if (role === Role.ADMIN) {
      clean[AppModule.ADMIN] = MODULES.find((m) => m.module === AppModule.ADMIN)!.actions;
    }
    await this.model.updateOne({ role }, { modules: this.toModules(clean) }, { upsert: true });
    await this.reload();
    return this.getMatrix();
  }
}
