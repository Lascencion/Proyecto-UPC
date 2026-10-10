import { SetMetadata } from '@nestjs/common';
import { Action, AppModule } from '../access.constants';

export const PERMISSION_KEY = 'requiredPermission';
export interface RequiredPermission {
  module: AppModule;
  action: Action;
}
/** Exige que el rol del usuario tenga la acción indicada sobre el módulo. */
export const RequirePermission = (module: AppModule, action: Action) =>
  SetMetadata(PERMISSION_KEY, { module, action } as RequiredPermission);
