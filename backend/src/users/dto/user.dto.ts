import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '../../common/access.constants';

export class CreateUserDto {
  @ApiProperty() @IsEmail({}, { message: 'El correo no es válido.' })
  email!: string;

  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @ApiProperty() @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password!: string;

  @ApiProperty({ enum: Role }) @IsEnum(Role, { message: 'Rol no válido.' })
  role!: Role;
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: Role }) @IsOptional() @IsEnum(Role, { message: 'Rol no válido.' })
  role?: Role;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password?: string;
}
