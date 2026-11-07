import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type GenerationStatus = 'GENERANDO' | 'GENERADO' | 'ERROR';
/** Paso en curso de la generación (para mostrar el progreso). */
export type GenerationStep = 'contexto' | 'instruccion' | 'respuesta' | 'completado';

@Schema({ _id: false })
export class RequirementSnapshot {
  @Prop({ enum: ['registrado', 'nuevo'], required: true }) source!: 'registrado' | 'nuevo';
  @Prop() code?: string;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) description!: string;
  @Prop({ type: [String], default: [] }) acceptanceCriteria!: string[];
}

@Schema({ _id: false })
export class ContextSnapshot {
  @Prop({ required: true }) type!: string;
  @Prop({ required: true }) code!: string;
  @Prop({ required: true }) title!: string;
  /** Similitud (0 a 100) al momento de la solicitud; null si se agregó manualmente. */
  @Prop({ type: Number, default: null }) score!: number | null;
  @Prop({ enum: ['directa', 'similitud', 'manual'], required: true }) relation!: string;
  /** Contenido exacto enviado al LLM (trazabilidad). */
  @Prop({ required: true }) content!: string;
}

@Schema({ _id: false })
export class GenerationParams {
  @Prop({ type: [String], required: true }) scenarioTypes!: string[];
  @Prop({ type: [String], default: [] }) techniques!: string[];
  @Prop({ required: true }) maxCases!: number;
  @Prop({ default: '' }) instructions!: string;
}

/** Solicitud de generación de casos de prueba (GEN-###). */
@Schema({ timestamps: true, collection: 'generation_requests' })
export class GenerationRequest {
  @Prop({ required: true }) code!: string;
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true }) project!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'FlowModule', required: true }) module!: Types.ObjectId;
  @Prop({ type: SchemaFactory.createForClass(RequirementSnapshot), required: true }) requirement!: RequirementSnapshot;
  @Prop({ type: [SchemaFactory.createForClass(ContextSnapshot)], default: [] }) context!: ContextSnapshot[];
  @Prop({ type: SchemaFactory.createForClass(GenerationParams), required: true }) params!: GenerationParams;
  @Prop({ required: true, enum: ['GENERANDO', 'GENERADO', 'ERROR'], default: 'GENERANDO' }) status!: GenerationStatus;
  @Prop({ enum: ['contexto', 'instruccion', 'respuesta', 'completado'], default: 'contexto' }) step!: GenerationStep;
  @Prop({ default: 1 }) version!: number;
  @Prop() provider?: string;
  @Prop() model?: string;
  @Prop() durationMs?: number;
  @Prop({ type: Object }) usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
  @Prop({ default: '' }) observations!: string;
  @Prop({ type: [String], default: [] }) missingScenarioTypes!: string[];
  @Prop({ default: 0 }) caseCount!: number;
  @Prop() error?: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) createdBy!: Types.ObjectId;
}
export type GenerationRequestDocument = HydratedDocument<GenerationRequest>;
export const GenerationRequestSchema = SchemaFactory.createForClass(GenerationRequest);
GenerationRequestSchema.index({ project: 1, code: 1 }, { unique: true });

/** Caso de prueba generado por el LLM. */
@Schema({ timestamps: true, collection: 'generated_cases' })
export class GeneratedCaseDoc {
  @Prop({ type: Types.ObjectId, ref: 'GenerationRequest', required: true, index: true }) request!: Types.ObjectId;
  @Prop({ default: 1 }) version!: number;
  @Prop({ required: true }) number!: number;
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) objective!: string;
  @Prop({ required: true }) scenarioType!: string;
  @Prop({ default: '' }) technique!: string;
  @Prop({ default: 'Media' }) priority!: string;
  @Prop({ default: '' }) preconditions!: string;
  @Prop({ default: '' }) testData!: string;
  @Prop({ type: [{ number: Number, action: String, expectedResult: String, _id: false }], default: [] })
  steps!: { number: number; action: string; expectedResult: string }[];
  @Prop({ required: true }) expectedResult!: string;
  @Prop({ type: [String], default: [] }) sources!: string[];
  @Prop({ default: 'GENERADO' }) status!: string;
}
export const GeneratedCaseSchema = SchemaFactory.createForClass(GeneratedCaseDoc);
