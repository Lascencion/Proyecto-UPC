import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { PermissionMap } from '../../common/access.constants';

export class UpdateRolePermissionsDto {
  @ApiProperty({
    description: 'Mapa módulo -> acciones permitidas',
    example: { KNOWLEDGE: ['VIEW', 'CREATE'], CATALOGS: ['VIEW'] },
  })
  @IsObject()
  permissions!: PermissionMap;
}
