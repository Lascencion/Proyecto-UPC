import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@qa.local' }) @IsEmail({}, { message: 'El correo no es válido.' })
  email!: string;

  @ApiProperty({ example: 'Admin123!' }) @IsString() @MinLength(1)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString()
  currentPassword!: string;

  @ApiProperty() @IsString() @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  newPassword!: string;
}
