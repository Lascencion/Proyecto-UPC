import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsMongoId, IsObject, IsOptional } from 'class-validator';

export class CreateImportDto {
  @ApiProperty() @IsMongoId({ message: 'Seleccione un proyecto válido.' })
  project!: string;

  @ApiProperty() @IsMongoId({ message: 'Seleccione un módulo válido.' })
  defaultModule!: string;

}

export class UpdateRowDto {
  @ApiPropertyOptional({ description: 'Valores corregidos del registro' }) @IsOptional() @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional() @IsOptional() @IsMongoId({ message: 'Módulo no válido.' })
  module?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  excluded?: boolean;

}
