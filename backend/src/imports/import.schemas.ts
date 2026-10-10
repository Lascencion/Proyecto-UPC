import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { ENTITY_TYPES, EntityType } from '../knowledge/definitions/entity-definitions';

export type BatchStatus = 'EN_REVISION' | 'CONFIRMADO' | 'CANCELADO';
export type DuplicateAction = 'skip' | 'update';
export type RowStatus = 'valid' | 'warning' | 'error' | 'excluded';
export type RowResult = 'created' | 'updated' | 'skipped' | 'failed';

@Schema({ _id: false })
class Issue {
  @Prop() fileName?: string;
  @Prop() field?: string;
  @Prop({ default: 'error' }) level?: 'error' | 'warning';
  @Prop({ required: true }) message!: string;
}
const IssueSchema = SchemaFactory.createForClass(Issue);

/** Lote de carga masiva: agrupa las filas leídas de uno o más archivos hasta que el usuario las confirma. */
@Schema({ timestamps: true, collection: 'import_batches' })
export class ImportBatch {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  project!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'FlowModule', required: true })
  defaultModule!: Types.ObjectId;

  @Prop({ type: [{ name: String, size: Number, _id: false }], default: [] })
  files!: { name: string; size: number }[];

  @Prop({ required: true, default: 'EN_REVISION', enum: ['EN_REVISION', 'CONFIRMADO', 'CANCELADO'] })
  status!: BatchStatus;

  @Prop({ default: 'skip', enum: ['skip', 'update'] })
  duplicateStrategy!: DuplicateAction;

  @Prop({ type: [IssueSchema], default: [] })
  issues!: Issue[];

  @Prop({ type: Object, default: {} })
  summary!: Record<string, number>;

  @Prop({ type: Object })
  result?: { created: number; updated: number; skipped: number; failed: number };

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  confirmedBy?: Types.ObjectId;

  @Prop()
  confirmedAt?: Date;
}
export type ImportBatchDocument = HydratedDocument<ImportBatch>;
export const ImportBatchSchema = SchemaFactory.createForClass(ImportBatch);

@Schema({ collection: 'import_rows' })
export class ImportRow {
  @Prop({ type: Types.ObjectId, ref: 'ImportBatch', required: true, index: true })
  batch!: Types.ObjectId;

  @Prop({ required: true })
  index!: number;

  @Prop({ required: true, enum: ENTITY_TYPES })
  type!: EntityType;

  @Prop({ type: { fileName: String, location: String, _id: false } })
  source!: { fileName: string; location: string };

  /** Valores del registro (normalizados en cada validación). */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  data!: Record<string, unknown>;

  @Prop()
  moduleName?: string;

  @Prop({ type: Types.ObjectId, ref: 'FlowModule', default: null })
  module?: Types.ObjectId | null;

  @Prop({ default: 'valid', enum: ['valid', 'warning', 'error', 'excluded'] })
  status!: RowStatus;

  @Prop({ type: [IssueSchema], default: [] })
  fieldErrors!: Issue[];

  @Prop({ type: [IssueSchema], default: [] })
  fieldWarnings!: Issue[];

  @Prop({ default: false })
  excluded!: boolean;

  /** Id del registro existente con el mismo código en el proyecto. */
  @Prop({ type: String, default: null })
  duplicateOf?: string | null;

  @Prop({ default: 'skip', enum: ['skip', 'update'] })
  duplicateAction!: DuplicateAction;

  @Prop({ enum: ['created', 'updated', 'skipped', 'failed'] })
  result?: RowResult;

  @Prop()
  resultMessage?: string;
}
export type ImportRowDocument = HydratedDocument<ImportRow>;
export const ImportRowSchema = SchemaFactory.createForClass(ImportRow);
ImportRowSchema.index({ batch: 1, index: 1 });
