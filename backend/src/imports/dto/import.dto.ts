import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsMongoId, IsObject, IsOptional } from 'class-validator';
import { DuplicateAction } from '../import.schemas';

export class CreateImportDto {
  @ApiProperty() @IsMongoId({ message: 'Seleccione un proyecto válido.' })
  project!: string;

  @ApiProperty() @IsMongoId({ message: 'Seleccione un módulo válido.' })
  defaultModule!: string;

  @ApiPropertyOptional({ enum: ['skip', 'update'] }) @IsOptional() @IsIn(['skip', 'update'])
  duplicateStrategy?: DuplicateAction;
}

export class UpdateBatchDto {
  @ApiProperty({ enum: ['skip', 'update'] }) @IsIn(['skip', 'update'])
  duplicateStrategy!: DuplicateAction;
}

export class UpdateRowDto {
  @ApiPropertyOptional({ description: 'Valores corregidos del registro' }) @IsOptional() @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional() @IsOptional() @IsMongoId({ message: 'Módulo no válido.' })
  module?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  excluded?: boolean;

  @ApiPropertyOptional({ enum: ['skip', 'update'] }) @IsOptional() @IsIn(['skip', 'update'])
  duplicateAction?: DuplicateAction;
}
