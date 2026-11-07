import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SCENARIO_TYPES, TECHNIQUES } from '../llm/types';

export class NewRequirementDto {
  @ApiProperty() @IsString() @MaxLength(300)
  title!: string;

  @ApiProperty() @IsString() @MaxLength(10000)
  description!: string;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true })
  acceptanceCriteria?: string[];
}

export class ContextQueryDto {
  @ApiProperty() @IsMongoId({ message: 'Seleccione un proyecto válido.' })
  project!: string;

  @ApiPropertyOptional() @IsOptional() @IsMongoId({ message: 'Seleccione un módulo válido.' })
  module?: string;

  @ApiPropertyOptional({ description: 'Código de un requerimiento registrado' }) @IsOptional() @IsString()
  requirementCode?: string;

  @ApiPropertyOptional({ type: NewRequirementDto }) @IsOptional() @ValidateNested() @Type(() => NewRequirementDto)
  requirement?: NewRequirementDto;
}

export class ContextRefDto {
  @ApiProperty() @IsString()
  type!: string;

  @ApiProperty() @IsString()
  code!: string;
}

export class CreateGenerationDto extends ContextQueryDto {
  @ApiProperty() @IsMongoId({ message: 'Seleccione un módulo válido.' })
  declare module: string;

  @ApiProperty({ type: [ContextRefDto] }) @IsArray() @ArrayMaxSize(15, { message: 'El contexto admite como máximo 15 registros.' })
  @ValidateNested({ each: true }) @Type(() => ContextRefDto)
  context!: ContextRefDto[];

  @ApiProperty({ enum: SCENARIO_TYPES, isArray: true })
  @IsArray() @ArrayMinSize(1, { message: 'Seleccione al menos un tipo de escenario.' }) @IsIn([...SCENARIO_TYPES], { each: true })
  scenarioTypes!: string[];

  @ApiPropertyOptional({ enum: TECHNIQUES, isArray: true }) @IsOptional() @IsArray() @IsIn([...TECHNIQUES], { each: true })
  techniques?: string[];

  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(20, { message: 'La cantidad máxima de casos es 20.' })
  maxCases!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  instructions?: string;
}
