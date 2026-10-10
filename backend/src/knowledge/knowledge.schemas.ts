import { Schema, SchemaDefinition, Types } from 'mongoose';
import { EntityDefinition, FieldDefinition } from './definitions/entity-definitions';

export const ORIGIN_TYPES = ['MANUAL', 'MASIVO'] as const;
export type OriginType = (typeof ORIGIN_TYPES)[number];

const StepSchema = new Schema(
  { number: Number, action: String, expectedResult: String },
  { _id: false },
);

const OriginSchema = new Schema(
  {
    type: { type: String, enum: ORIGIN_TYPES, required: true },
    fileName: String,
    batchId: { type: Types.ObjectId, ref: 'ImportBatch' },
  },
  { _id: false },
);

function fieldToMongoose(field: FieldDefinition) {
  switch (field.type) {
    case 'date':
      return { type: Date, default: null };
    case 'list':
    case 'refList':
      return { type: [String], default: [] };
    case 'steps':
      return { type: [StepSchema], default: [] };
    default:
      return { type: String, default: null };
  }
}

/** Construye el esquema de MongoDB de un tipo de información a partir de su definición. */
export function buildKnowledgeSchema(def: EntityDefinition): Schema {
  const shape: SchemaDefinition = {
    project: { type: Types.ObjectId, ref: 'Project', required: true, index: true },
    module: { type: Types.ObjectId, ref: 'FlowModule', required: true, index: true },
    origin: { type: OriginSchema, required: true },
    createdBy: { type: Types.ObjectId, ref: 'User' },
    updatedBy: { type: Types.ObjectId, ref: 'User' },
  };
  for (const field of def.fields) {
    shape[field.key] = fieldToMongoose(field);
  }
  const schema = new Schema(shape, { timestamps: true, collection: def.collection });
  // El código es único dentro de cada proyecto.
  schema.index({ project: 1, code: 1 }, { unique: true });
  return schema;
}
