import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Proyecto o sistema bajo prueba (p. ej. "Tienda del juego X"). */
@Schema({ timestamps: true, collection: 'projects' })
export class Project {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true, default: '' })
  description!: string;

  @Prop({ default: true })
  active!: boolean;
}
export type ProjectDocument = HydratedDocument<Project>;
export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ name: 1 }, { unique: true, collation: { locale: 'es', strength: 1 } });

/** Módulo o flujo funcional dentro de un proyecto (p. ej. "Compra de monedas virtuales"). */
@Schema({ timestamps: true, collection: 'flow_modules' })
export class FlowModule {
  @Prop({ type: Types.ObjectId, ref: Project.name, required: true, index: true })
  project!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true, default: '' })
  description!: string;

  @Prop({ default: true })
  active!: boolean;
}
export type FlowModuleDocument = HydratedDocument<FlowModule>;
export const FlowModuleSchema = SchemaFactory.createForClass(FlowModule);
FlowModuleSchema.index({ project: 1, name: 1 }, { unique: true, collation: { locale: 'es', strength: 1 } });
