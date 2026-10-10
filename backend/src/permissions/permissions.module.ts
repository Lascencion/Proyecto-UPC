import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { RolePermission, RolePermissionSchema } from './role-permission.schema';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: RolePermission.name, schema: RolePermissionSchema }])],
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
