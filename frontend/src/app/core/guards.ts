import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ActionKey, AppModuleKey } from './models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).createUrlTree(['/inicio']) : true;
};

export const permissionGuard =
  (module: AppModuleKey, action: ActionKey): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    return auth.can(module, action) ? true : inject(Router).createUrlTree(['/inicio']);
  };
