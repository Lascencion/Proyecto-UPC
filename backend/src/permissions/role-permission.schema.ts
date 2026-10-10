import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Action, AppModule, Role } from '../common/access.constants';

@Schema({ _id: false })
export class ModulePermission {
  @Prop({ required: true, enum: Object.values(AppModule) })
  module!: AppModule;

  @Prop({ type: [String], enum: Object.values(Action), default: [] })
  actions!: Action[];
}

@Schema({ timestamps: true, collection: 'role_permissions' })
export class RolePermission {
  @Prop({ required: true, unique: true, enum: Object.values(Role) })
  role!: Role;

  @Prop({ type: [SchemaFactory.createForClass(ModulePermission)], default: [] })
  modules!: ModulePermission[];
}

export const RolePermissionSchema = SchemaFactory.createForClass(RolePermission);
