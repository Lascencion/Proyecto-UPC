import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty() @IsString() @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' }) @MaxLength(150)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  description?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(150)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  active?: boolean;
}

export class CreateFlowModuleDto extends CreateProjectDto {
  @ApiProperty() @IsMongoId({ message: 'Proyecto no válido.' })
  project!: string;
}

export class UpdateFlowModuleDto extends UpdateProjectDto {}
