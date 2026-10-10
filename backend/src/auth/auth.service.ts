import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PermissionsService } from '../permissions/permissions.service';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/user.schema';

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly permissions: PermissionsService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }
    if (!user.active) throw new UnauthorizedException('El usuario está desactivado.');
    await this.users.touchLogin(String(user._id));
    const accessToken = await this.jwt.signAsync({ sub: String(user._id), role: user.role } as JwtPayload);
    return { accessToken, ...this.profile(user) };
  }

  profile(user: UserDocument) {
    return {
      user: UsersService.toPublic(user),
      permissions: this.permissions.forRole(user.role),
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.users.findById(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('La contraseña actual es incorrecta.');
    }
    await this.users.setPassword(userId, newPassword);
    return { ok: true };
  }
}
