import { UserRole } from '@prisma/client';
import { IsEmail, IsString, IsStrongPassword, IsEnum, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsStrongPassword({
    minLength: 8,
  })
  password: string;

  @IsString()
  name: string;

  @IsString()
  organizationId: string;

  @IsOptional()
  @IsEnum(UserRole)
  role: UserRole;
}
