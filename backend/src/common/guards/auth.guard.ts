import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../auth/auth.service';
import { PermissionsService } from '../../permissions/permissions.service';
import { UsersService } from '../../users/users.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/require-permission.decorator';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Guard global: valida el JWT, carga el usuario (para reflejar cambios de rol o
 * desactivación inmediatamente) y verifica el permiso requerido por el endpoint.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Debe iniciar sesión.');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('La sesión expiró o no es válida.');
    }
    const user = await this.users.findById(payload.sub).catch(() => null);
    if (!user || !user.active) throw new UnauthorizedException('Usuario no válido o desactivado.');

    request.user = { id: String(user._id), email: user.email, name: user.name, role: user.role } as AuthUser;

    const required = this.reflector.getAllAndOverride<RequiredPermission>(PERMISSION_KEY, targets);
    if (required && !this.permissions.can(user.role, required.module, required.action)) {
      throw new ForbiddenException('No tiene permiso para realizar esta acción.');
    }
    return true;
  }
}
