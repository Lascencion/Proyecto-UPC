import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Action, AppModule, Role } from '../common/access.constants';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { UpdateRolePermissionsDto } from './dto/update-permissions.dto';
import { PermissionsService } from './permissions.service';

@ApiTags('Administración - Permisos')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @RequirePermission(AppModule.ADMIN, Action.VIEW)
  getMatrix() {
    return this.permissions.getMatrix();
  }

  @Put(':role')
  @RequirePermission(AppModule.ADMIN, Action.EDIT)
  update(@Param('role') role: Role, @Body() dto: UpdateRolePermissionsDto) {
    return this.permissions.updateRole(role, dto.permissions);
  }
}
